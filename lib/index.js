
/**
 * Module dependencies.
 */

var Facade = require('segmentio-facade');
var inspect = require('util').inspect;
var fmt = require('util').format;
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
 * @api public
 */

function Assertion(integration){
  if (!(this instanceof Assertion)) return new Assertion(integration);
  assert(integration, 'expected integration');
  this.createRequest = integration.request;
  integration.request = this.request.bind(this);
  this.integration = integration;
  this.assertions = [];
  this.settings = {};
  this.q = {};
}

/**
 * Assert name `name`.
 *
 * @param {String} name
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.name = function(name){
  if (name == this.integration.name) return this;
  throw new Error('expected name to be "' + name + '" but it\'s "' + this.integration.name + '"');
};

/**
 * Assert timeout `ms`.
 *
 * @param {String|Number} ms
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.timeout = function(ms){
  if ('string' == typeof ms) ms = parse(ms);
  if (ms == this.integration.timeout) return this;
  throw new Error('expected timeout to be "' + ms + '" but it\'s "' + this.integration.timeout + '"');
};

/**
 * Assert the endpoint to be `url`
 *
 * @param {String} url
 * @return {Assertion}
 * @api public
 */

Assertion.prototype.endpoint = function(url){
  if (url == this.integration.endpoint) return this;
  throw new Error('expected endpoint to be "' + url + '" but it\'s "' + this.integration.endpoint + '"');
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
 * @param {Object} obj
 * @return {Assertion}
 * @api private
 */

Assertion.prototype.query = function(obj){
  var self = this;

  for (var k in obj) this.q[k] = obj[k];

  if (!this.pushedQueryAssertion) {
    this.pushedQueryAssertion = true;
    this.assertions.push(function(req){
      var query = req.req.path.split('?')[1];
      if (!query) return new Error('expected request to include query string but no query string was found');
      var expected = self.q;
      var actual = qs.parse(query);
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
    return new Error('unknown assertion "' + inspect(args) + '"');
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
    return new Error('unknown assertion "' + inspect(args) + '"');
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

  integration[type](msg, this.settings, function(err, res){
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
  return this.req;
};

/**
 * Assert that the integration is enabled for `msg`.
 *
 * @param {Facade|Object} msg
 * @param {Object} settings [optional]
 * @return {Boolean}
 * @api public
 */

Assertion.prototype.enabled = function(msg, settings){
  var settings = settings || this.settings;
  var msg = createFacade(msg);
  if (this.integration.enabled(msg, settings)) return this;
  throw new Error('expected integration to be enabled with "' + inspect(msg.json()) + '", "' + inspect(settings) + '"');
};

/**
 * Assert that the integration is disabled for `msg`.
 *
 * @param {Facade|Object} msg
 * @param {Object} settings
 * @api public
 */

Assertion.prototype.disabled = function(msg, settings){
  var settings = settings || this.settings;
  var msg = createFacade(msg);
  if (!this.integration.enabled(msg, settings)) return this;
  throw new Error('expected integration to be disabled with "' + inspect(msg.json()) + '", "' + inspect(settings) + '"');
};

/**
 * Assert that all channels are enabled.
 *
 * @param {Object} msg
 * @param {Object} settings
 * @return {Boolean}
 * @api public
 */

Assertion.prototype.all = function(msg, settings){
  var settings = settings || this.settings;
  var msg = createFacade(msg || {});
  var self = this;

  var disabled = channels.filter(function(channel){
    msg.obj.channel = channel;
    return !self.integration.enabled(msg, settings);
  });

  if (disabled.length) {
    throw new Error('expected message to be enabled on all channels, '
      + 'but it is disabled on "' + disabled.join(', ') + '"');
  }

  return this;
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
 * Add message channels.
 */

channels.forEach(function(channel){
  Assertion.prototype[channel] = function(msg){
    msg = createFacade(msg);
    msg.obj.channel = channel;
    if (this.integration.enabled(msg)) return this;
    throw new Error('expected integration to be enabled on "' + channel + '"');
  };
});

/**
 * Create `Facade` from `obj`.
 *
 * @param {Facade|Object} msg
 * @return {Facade}
 * @api private
 */

function createFacade(msg){
  var msg = msg || {};
  if ('function' == typeof msg.type) return msg;
  var type = msg.action || msg.type || 'track';
  type = type[0].toUpperCase() + type.slice(1);
  return new Facade[type](msg);
}
