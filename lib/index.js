
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
 * @return {Boolean}
 * @api public
 */

Assertion.prototype.enabled = function(facade){
  var facade = createFacade(facade);
  return this.integration.enabled(facade);
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
 * @api public
 */

Assertion.prototype.all = function(){
  var self = this;
  channels.forEach(function(channel){
    self[channel]();
  });
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
  Assertion.prototype[channel] = function(){
    var msg = fmt('expected integration to be enabled for "%s"', channel);
    assert(this.enabled({ channel: channel }), msg);
    return this;
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
  return new types.Track(msg);
}