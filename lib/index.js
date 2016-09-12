
/**
 * Module dependencies.
 */

var Facade = require('segmentio-facade');
var events = require('analytics-events');
var inspect = require('util').inspect;
var clone = require('clone-component');
var fmt = require('util').format;
var join = require('path').join;
var assert = require('assert');
var utils = require('./utils');
var parse = require('ms');
var select = utils.select;
var qs = require('qs');
var type = utils.type;

/**
 * Message channels.
 */

var channels = [
  'server',
  'client',
  'mobile'
];

/**
 * Message types.
 */

var types = [
  'identify',
  'screen',
  'group',
  'alias',
  'track',
  'page'
];

/**
 * Expose `Assertion`
 */

module.exports = Assertion;

/**
 * Initialize a new `Assertion`.
 *
 * @param {Integration} integration
 * @param {String} dirname
 * @api public
 */

function Assertion(integration, dirname){
  if (!(this instanceof Assertion)) return new Assertion(integration, dirname);
  assert(integration, 'expected integration');
  var createRequest = integration.request;
  var self = this;
  this.integration = integration;
  this.Integration = integration.constructor;
  this.mapper(integration.mapper || {});
  this.settings = integration.settings;
  this.dirname = dirname;
  this.assertions = {};
  this.reqIndex = 0;
  this.maxIndex = 0;
  this.reqs = [];
  this.q = {};

  integration.request = function(){
    var req = createRequest.apply(this, arguments);
    var end = req.end;
    self.reqs.push(req);
    // we can't `.on('response')` bc superagent
    // doesn't emit `response` sometimes.
    // meh..
    req.end = function(fn){
      end.call(this, function(err, res){
        req.response = res;
        fn(err, res);
      });
    };
    return req;
  };
}

/**
 * Set request `i` to push assertions on.
 *
 * @param {Number} i
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.request = function(i){
  assert(0 <= i, 'request index must be >= 0, got "' + i + '"');
  this.reqIndex = parseInt(i);
  this.maxIndex = Math.max(this.maxIndex, this.reqIndex);
  return this;
};

/**
 * Set / Get the `mapper`.
 *
 * @param {Object} mapper
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.mapper = function(mapper){
  if (0 == arguments.length) return this._mapper;
  this._mapper = mapper;
  return this;
};

/**
 * Assert that `fixture` is correct.
 *
 * TODO: remove once we remove `Integration.mapper()` magic.
 *
 * @param {String} fixture
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.maps = function(fixture, settings, options){
  var settings = settings || this.settings;
  var json = this.fixture(fixture);
  var actual = json.input;
  var type = actual.type;
  var expected = json.output;
  options = options || {};

  // to message
  assert(actual.type, 'input.type must be specified');
  var msg = toMessage(actual);
  var mapper = this.mapper();
  var map = mapper[type];

  // method
  if ('track' == type) {
    var event = msg.event();
    for (var method in events) {
      var regexp = events[method];
      var fn = mapper[method];
      if (!fn || !regexp.test(event)) continue;
      map = fn;
      break;
    }
  }

  // make sure map() exists.
  assert(map, 'integration.mapper.' + type + '() is missing');

  // merge settings if available.
  if (json.settings) {
    for (var k in json.settings) {
      settings[k] = json.settings[k];
    }
  }

  // map
  actual = map.call(this.integration, msg, settings);

  // make sure map returned something
  assert(actual, 'integration.mapper.' + type + '() returned "' + utils.type(actual) + '"');

  // transform dates
  actual = JSON.parse(JSON.stringify(actual));

  // strip out any keys we are ignoring
  if (options.ignored) {
    utils.stripIgnoredFromObject(actual, options.ignored);
  }

  // compare
  try {
    assert.deepEqual(actual, expected);
  } catch (e) {
    e.showDiff = true;
    throw e;
  }
};

/**
 * Get a fixture as an object by `name`.
 *
 * @param {String} name
 * @return {Object}
 * @api public
 */

Assertion.prototype.fixture = function(name){
  assert(this.dirname, 'you must pass dirname to Test(integration, __dirname)');
  return clone(require(join(this.dirname, 'fixtures', name + '.json')));
};

/**
 * Assert the integration will ensure `path` with `expected` meta.
 *
 * @param {String} path
 * @param {Object} expected
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.ensure = function(path, expected){
  var all = this.Integration.validations;
  var parts = path.split('.');
  var type = parts.shift();
  var key = parts.join('.');

  // find meta
  var actual = select(all, function(obj){
    return type == obj.type
      && key == obj.path
      && obj;
  });

  // missing
  if (!actual) throw errorf('expected integration to have validation for "%s"', path);
  if ('function' == typeof actual) return;

  // clean
  actual = clone(actual);
  delete actual.validate;
  delete actual.path;
  delete actual.type;

  // compare
  try {
    assert.deepEqual(actual, expected || {});
  } catch (e) {
    e.message = 'validation meta mismatch ' + e.message;
    e.showDiff = true;
    throw e;
  }

  return this;
};

/**
 * Assert the integration is enabled on `channels`.
 *
 * @param {Array} chans
 * @api public
 */

Assertion.prototype.channels = function(expected){
  var actual = this.integration.channels;
  var err = utils.equals(actual.sort(), expected.sort());
  if (err) throw err;
  return this;
};

/**
 * Assert the integration is valid with `msg`, `settings`.
 *
 * TODO: remove settings arg.
 *
 * @param {Facade|Object} msg
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.valid = function(msg, settings){
  var msg = toMessage(msg);
  var settings = settings || this.settings;
  var err = this.Integration.validate(msg, settings);
  if (err) throw err;
};

/**
 * Assert the integration is invalid with `msg`, `settings`.
 *
 * TODO: remove settings arg.
 *
 * @param {Facade|Object} msg
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.invalid = function(msg, settings){
  var msg = toMessage(msg);
  var settings = settings || this.settings;
  var err = this.Integration.validate(msg, settings);
  if (!err) throw new Error('expected .validate(msg, settings) to return an error.');
};

/**
 * Assert requests `n`.
 *
 * @param {Number} n
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.requests = function(n){
  var reqs = this.reqs;

  this.push('all', function(){
    if (n == reqs.length) return;
    return errorf('expected number of requests to be "%d", but it\'s "%d"', n, reqs.length);
  });

  return this;
};

/**
 * Assert retries `n`.
 *
 * @param {Number} n
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.retries = function(n){
  var retries = this.integration.retries;
  if (n == retries) return this;
  throw errorf('expected retries to be "%s" but it\'s "%s"', n, retries);
};

/**
 * Assert name `name`.
 *
 * @param {String} name
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.name = function(name){
  var actual = this.integration.name;
  if (name == actual) return this;
  throw errorf('expected name to be "%s" but it\'s "%s"', name, actual);
};

/**
 * Assert timeout `ms`.
 *
 * @param {String|Number} ms
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.timeout = function(ms){
  var timeout = this.integration.timeout;
  if ('string' == typeof ms) ms = parse(ms);
  if (ms == timeout) return this;
  throw errorf('expected timeout to be "%s" but it\'s "%s"', ms, timeout);
};

/**
 * Assert the endpoint to be `url`
 *
 * @param {String} url
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.endpoint = function(url){
  var endpoint = this.integration.endpoint;
  if (url == endpoint) return this;
  throw errorf('expected endpoint to be "%s" but it\'s "%s"', url, endpoint);
};

/**
 * Set settings `key, `value`.
 *
 * @param {String|Object} key
 * @param {Mixed} value
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.set = function(key, value){
  if ('object' == typeof key) {
    for (var k in key) this.set(k, key[k]);
    return this;
  }

  this.settings = this.settings || {};
  this.settings[key] = value;
  return this;
};

/**
 * Assert the request `path`.
 *
 * Example:
 *
 *      assertion(integration)
 *        .track({ event: 'my event' })
 *        .pathname('/track')
 *        .expects(200, done);
 *
 * @param {Object} obj
 * @return {Assertion}
 * @api private
 */

Assertion.prototype.pathname = function(value){
  return this.push(function(req){
    var pathname = req.req.path.split('?')[0];
    if (pathname == value) return;
    return errorf('expected request pathname '
      + 'to be "%s" '
      + 'but got "%s"'
      , value.toString()
      , pathname);
  });
};

/**
 * Push an assertion `fn` on `i`.
 *
 * @param {Number} i
 * @param {Function} fn
 * @api public
 */

Assertion.prototype.push = function(i, fn){
  if (1 == arguments.length) fn = i, i = this.reqIndex;
  (this.assertions[i] = this.assertions[i] || []).push(fn);
  return this;
};

/**
 * Add query.
 *
 * Example:
 *
 *      assertion(integration)
 *        .track({ event: 'my event' })
 *        .query({ one: 1 })
 *        .query({ two: 2 })
 *        .expects(200, done);
 *
 * @param {String} key
 * @param {Mixed} value
 * @return {Assertion}
 * @api private
 */

Assertion.prototype.query = function(key, value, parse){
  var q = this.q[this.reqIndex] = this.q[this.reqIndex] || {};
  var assertions = this.assertions[this.reqIndex] || [];
  var noop = function(_){ return _; };
  var self = this;

  // obj
  if (1 == arguments.length) {
    for (var k in key) this.query(k, key[k]);
    return this;
  }

  // key, value
  q[key] = [value, parse || noop];

  this.push(function(req, _, i){
    var expect = self.q[i];
    var query = req.req.path.split('?')[1];
    if (!query) return new Error('expected request to include query string but no query string was found');

    // actual
    var actual = qs.parse(query);

    // expected
    var expected = Object
      .keys(expect)
      .reduce(function(_, key){
        var arr = expect[key];
        var expected = arr[0];
        var parse = arr[1];
        actual[key] = parse(actual[key]);
        _[key] = expected;
        return _;
      }, {});

    // compare
    return utils.equals(actual, expected);
  });

  return this;
};

/**
 * Integration sends `...`.
 *
 * @param {...}
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.sends = function(){
  var args = [].slice.call(arguments);
  var value = args[0];

  this.push(function(req){
    if (2 == args.length) return utils.header(req, args);
    if ('object' == type(value)) return utils.equals(req._data, value);
    if ('regexp' == type(value)) return utils.match(req._data, value);
    if ('?' == value[0]) return utils.query(req, value);
    if ('string' == type(value)) return utils.equals(req._data, value);
    return errorf('unknown assertion "%s"', inspect(args));
  });

  return this;
};


/**
 * Integration sendsAlmost `...`.
 *
 * Check that the integration sends almost `obj`, modulo some options
 *
 * @param {Object} obj
 * @param {Object} options
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.sendsAlmost = function(obj, options){
  ignoredKeys = options && options.ignored;
  this.push(function(req){
    return utils.equals(req._data, obj, ignoredKeys);
  });

  return this;
};

/**
 * Integration expects `...`
 *
 * @param {...}
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.expects = function(){
  var args = [].slice.call(arguments);
  var value = args[0];
  var self = this;
  var fn;

  if ('function' == typeof args[1]) {
    fn = args.pop();
    process.nextTick(function(){
      self.end(fn);
    });
  }

  this.push(function(_, res){
    if (2 == args.length) return utils.header(res, args);
    if ('object' == type(value)) return utils.equals(res.body, value);
    if ('regexp' == type(value)) return utils.match(res.text, value);
    if ('string' == type(value)) return utils.equals(res.text, value);
    if ('number' == type(value)) return utils.equals(res.status, value);
    return errorf('unknown assertion "%s"', inspect(args));
  });

  return this;
};

/**
 * Assert that the integration errors with optional `msg`.
 *
 * @param {String} msg
 * @param {Function} fn
 * @api public
 */

Assertion.prototype.error = function(msg, fn){
  if (1 == arguments.length) fn = msg, msg = null;
  this.end(function(err, responses){
    if (!err) return fn(new Error('expected integration to error'), responses);
    if (msg) return fn(utils.equals(err.message, msg));
    fn();
  });
};

/**
 * End.
 *
 * @param {Function} fn
 * @api public
 */

Assertion.prototype.end = function(fn){
  assert(this.msg, 'you must call .identify() / .alias() etc..');
  var integration = this.integration;
  var msg = this.msg;
  var type = msg.type();
  var self = this;

  if (!integration[type]) return fn(errorf('%s() is not implemented', type));

  integration[type](msg, function(err, responses){
    if (err) return fn(err, responses);
    if (!Array.isArray(responses)) responses = [responses];
    if (self.maxIndex + 1 > self.reqs.length) {
      return fn(new Error('Assertions made for ' + (self.maxIndex + 1)
                          + ' requests but only ' + self.reqs.length + ' requests were made'));
    }

    // all requests
    var err = self.assert('all');

    // each request
    for (var i = 0; i < self.reqs.length; ++i) {
      var req = self.reqs[i];
      if (err) break;
      err = self.assert(i, req, req.response);
    }

    fn(err, responses);
  });

  return this;
};

/**
 * Assert with `req`, `res`.
 *
 * @param {Request} req
 * @param {Response} res
 * @api private
 */

Assertion.prototype.assert = function(i, req, res){
  var all = this.assertions[i] || [];
  return select(all, function(assert){
    return assert(req, res, i);
  });
};

/**
 * Add message types.
 */

types.forEach(function(type){
  var Message = Facade[uppercase(type)];
  Assertion.prototype[type] = function(msg){
    if ('function' != typeof msg.type) msg = new Message(msg);
    this.msg = msg;
    return this;
  };
});

/**
 * Create `Facade` message from `obj`.
 *
 * @param {Facade|Object} msg
 * @return {Facade}
 * @api private
 */

function toMessage(msg){
  var msg = msg || {};
  if ('function' == typeof msg.type) return msg;
  var type = msg.action || msg.type || 'track';
  type = uppercase(type);
  return new Facade[type](msg, {
    traverse: false,
    clone: false
  });
}

/**
 * Errorf `...`
 *
 * @param {String} ...
 * @return {Error}
 * @api private
 */

function errorf(){
  return new Error(fmt.apply(null, arguments));
}

/**
 * Uppercase.
 */

function uppercase(s){
  s = s.toLowerCase();
  return s[0].toUpperCase() + s.slice(1);
}
