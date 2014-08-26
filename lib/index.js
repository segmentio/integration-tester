
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
  this.createRequest = integration.request;
  integration.request = this.request.bind(this);
  this.integration = integration;
  this.mapper(integration.mapper || {});
  this.settings = integration.settings;
  this.dirname = dirname;
  this.assertions = [];
  this.reqs = [];
  this.q = {};
}

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
 * @param {String} fixture
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.maps = function(fixture, settings){
  var settings = settings || this.settings;
  var json = this.fixture(fixture);
  var actual = json.input;
  var type = actual.type;
  var expected = json.output;

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
  var all = this.integration.constructor.validations;
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
 * @param {Facade|Object} msg
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.valid = function(msg, settings){
  var msg = toMessage(msg);
  var settings = settings || this.settings;
  var err = this.integration.constructor.validate(msg, settings);
  if (err) throw err;
};

/**
 * Assert the integration is invalid with `msg`, `settings`.
 *
 * @param {Facade|Object} msg
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.invalid = function(msg, settings){
  var msg = toMessage(msg);
  var settings = settings || this.settings;
  var err = this.integration.constructor.validate(msg, settings);
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

  this.assertions.push(function(){
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
  var self = this;

  this.assertions.push(function(req){
    var pathname = req.req.path.split('?')[0];
    if (pathname == value) return;
    return errorf('expected request pathname '
      + 'to be "%s" '
      + 'but got "%s"'
      , value.toString()
      , pathname);
  });

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
  var noop = function(_){ return _; };
  var self = this;

  // obj
  if (1 == arguments.length) {
    for (var k in key) this.query(k, key[k]);
    return this;
  }

  // key, value
  this.q[key] = [value, parse || noop];

  if (!this.pushedQueryAssertion) {
    this.pushedQueryAssertion = true;
    this.assertions.push(function(req){
      var query = req.req.path.split('?')[1];
      if (!query) return new Error('expected request to include query string but no query string was found');

      // actual
      var actual = qs.parse(query);

      // expected
      var expected = Object.keys(self.q)
        .reduce(function(_, key){
          var arr = self.q[key];
          var expected = arr.shift();
          var parse = arr.shift();
          actual[key] = parse(actual[key]);
          _[key] = expected;
          return _;
        }, {});

      // compare
      return utils.equals(actual, expected);
    });
  }

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

  this.assertions.push(function(req){
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

  this.assertions.push(function(_, res){
    if (2 == arguments.length) return utils.header(res, args);
    if ('object' == type(value)) return utils.equals(res.body, value);
    if ('regexp' == type(value)) return utils.match(res.text, value);
    if ('string' == type(value)) return utils.equals(res.text, value);
    if ('number' == type(value)) return utils.equals(res.status, value);
    return errorf('unknown assertion "%s"', inspect(args));
  });

  return this;
};

/**
 * Assert that the integration errors.
 *
 * @param {Function} fn
 * @api public
 */

Assertion.prototype.error = function(fn){
  this.end(function(err){
    if (err) return fn();
    fn(new Error('expected integration to error'));
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

  integration[type](msg, function(err, res){
    if (err) return fn(err);
    self.assert(self.req, res, fn);
  });

  return this;
};

/**
 * Create request with `path`.
 *
 * @param {...} args
 * @return {Request}
 * @api private
 */

Assertion.prototype.request = function(){
  this.req = this.createRequest.apply(this.integration, arguments);
  this.reqs.push(this.req);
  return this.req;
};

/**
 * Assert with `req`, `res` and `fn(err, res)`.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Function} fn
 * @api private
 */

Assertion.prototype.assert = function(req, res, fn){
  var err = select(this.assertions, function(assert){
    return assert(req, res, fn);
  });

  fn(err, res);
};

/**
 * Add message types.
 */

types.forEach(function(type){
  var Message = Facade[type[0].toUpperCase() + type.slice(1)];
  Assertion.prototype[type] = function(msg, settings){
    if ('function' != typeof msg.type) msg = new Message(msg);
    if (2 == arguments.length) this.set(settings);
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
  type = type[0].toUpperCase() + type.slice(1);
  return new Facade[type](msg);
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
