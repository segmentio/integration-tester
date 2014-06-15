
/**
 * Module dependencies.
 */

var types = require('segmentio-facade');
var inspect = require('util').inspect;
var channels = require('./channels');
var actions = require('./actions');
var fmt = require('util').format;
var assert = require('assert');
var utils = require('./utils');
var select = utils.select;
var qs = require('qs');
var type = utils.type;

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
    if (!err) return fn(new Error('expected integration to error'));
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
  assert(this._facade, 'you must call .identify() / .alias() etc..');
  var integration = this.integration;
  var facade = this._facade;
  var action = facade.action();
  var self = this;

  integration[action](facade, this.settings, function(err, res){
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
 * Assert that the integration is enabled for `facade`.
 *
 * @param {Facade|Object} facade
 * @param {Object} settings [optional]
 * @return {Boolean}
 * @api public
 */

Assertion.prototype.enabled = function(facade, settings){
  var settings = settings || this.settings;
  var facade = createFacade(facade);
  return this.integration.enabled(facade, settings);
};

/**
 * Assert that the integration is disabled for `facade`.
 *
 * @param {Facade|Object} facade
 * @api public
 */

Assertion.prototype.disabled = function(facade){
  var facade = createFacade(facade);
  return ! this.integration.enabled(facade);
};

/**
 * Assert that all channels are enabled.
 *
 * @param {Object} msg
 * @return {Boolean}
 * @api public
 */

Assertion.prototype.all = function(msg){
  var msg = msg || {};
  var self = this;
  return channels.every(function(channel){
    msg.channel = channel;
    return self.enabled(msg);
  });
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
 * Actions.
 */

actions.forEach(function(action){
  var Action = types[action[0].toUpperCase() + action.slice(1)];
  Assertion.prototype[action] = function(facade, settings){
    if ('function' != typeof facade.action) facade = new Action(facade);
    if (2 == arguments.length) this.set(settings);
    this._facade = facade;
    return this;
  };
});

/**
 * Channels
 */

channels.forEach(function(channel){
  Assertion.prototype[channel] = function(msg){
    msg = createFacade(msg || {});
    msg.obj.channel = channel;
    return this.enabled(msg);
  };
});

/**
 * Create facade from `msg`.
 *
 * @param {Facade|Object} msg
 * @return {Facade}
 * @api private
 */

function createFacade(msg){
  if ('function' == typeof msg.action) return msg;
  var type = msg.action || msg.type || 'track';
  type = type[0].toUpperCase() + type.slice(1);
  return new types[type](msg);
}
