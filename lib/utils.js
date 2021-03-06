
/**
 * Module dependencies.
 */

var assert = require('assert');
var util = require('util');

/**
 * Return the first truthy value from `arr`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @return {Mixed}
 * @api public
 */

exports.select = function(arr, fn){
  for (var i = 0, j; j = arr[i]; ++i) {
    if (j = fn(j)) return j;
  }
};

/**
 * Get typeof `value`.
 *
 * @param {Mixed} value
 * @return {String}
 * @api private
 */

exports.type = function(value){
  return ({}).toString.call(value)
    .slice(8, -1)
    .toLowerCase();
};

/**
 * Compare header `[key, value]` with `req`.
 *
 * @param {Request} req
 * @param {Array} header
 * @return {Error}
 * @api public
 */

exports.header = function(req, header){
  var actual = req.get(header[0]);
  var expected = header[1];
  var t = exports.type(expected);
  if ('regexp' == t && expected.test(actual)) return;
  if (expected == actual) return;
  return exports.error(''
    + 'expected header ' + inspect(header[0])
    + ': ' + inspect(actual) + ' to match ' + inspect(expected)
    , actual
    , expected);
};

/**
 * Match the given `actual` with `expected`.
 *
 * @param {Mixed} actual
 * @param {RegExp} expected
 * @return {Error}
 * @api public
 */

exports.match = function(actual, expected){
  if ('string' == typeof actual && expected.test(actual)) return;
  return exports.error(''
    + 'expected ' + inspect(actual) + ' '
    + 'to match ' + inspect(expected)
    , actual
    , expected);
};

/*
 * Recursively strip all keys given in `ignored` from `obj`, and from
 * all objects contained in or nested under obj.
 *
 * @param {Mixed} actual
 * @param {Array} ignoredKeys
 * @api public
 */

exports.stripIgnoredFromObject = function(obj, ignoredKeys) {
  // If obj is an array: strip out any ignored values and recurse if necessary
  if (obj instanceof Array) {
    for (var i = obj.length - 1; i >= 0; i--) {
      if (ignoredKeys.indexOf(obj[i]) != -1) {
        obj.splice(i, 1);
      } else if (typeof obj[i] === 'object') { // recurse on contained objs
        exports.stripIgnoredFromObject(obj[i], ignoredKeys);
      }
    }
  } else {
    // Otherwise, basically do the same thing (but with object syntax)
    for (var prop in obj) {
      if (ignoredKeys.indexOf(prop) != -1) {
        delete obj[prop];
      } else if (typeof obj[prop] === 'object') { // recurse on contained objs
        exports.stripIgnoredFromObject(obj[prop], ignoredKeys);
      }
    }
  }
};

/**
 * Compare `actual` with `expected`, but ignore any keys in `actual` that
 * are present in `ignoredKeys`
 * @param {Mixed} actual
 * @param {Mixed} expected
 * @param {Array} ignoredKeys (optional)
 * @return {Error}
 * @api public
 */
exports.equals = function(actual, expected, ignoredKeys){
  if (ignoredKeys !== undefined) {
    exports.stripIgnoredFromObject(actual, ignoredKeys);
  }
  try {
    assert.deepEqual(actual, expected);
  } catch (e) {
    return exports.error('expected ' + inspect(expected)
      + ' but got ' + inspect(actual) + ''
      , actual
      , expected);
  }
};

exports.contains = function(actual, expected){
  for (var key in expected) {
    try {
      assert.deepEqual(actual[key], expected[key])
    } catch(e) {
      return exports.error('expected ' + inspect(expected)
        + ' to exist in ' + inspect(actual) + ''
        , actual
        , expected);
    }
  }
}

/**
 * Compare `str` with `req.query`.
 *
 * @param {Request} req
 * @param {String} str
 * @return {Error}
 * @api public
 */

exports.query = function(req, str){
  var query = req.req.path.split('?')[1];
  if ('?' == str[0]) str = str.slice(1);
  if (query && ~query.indexOf(str)) return;
  return exports.error(''
    + 'expected ' + inspect(query) + ' '
    + 'to include ' + inspect(str)
    , query
    , str);
};

/**
 * Error with `msg` and `actual`, `expected`.
 *
 * @param {String} msg
 * @param {Mixed} actual
 * @param {Mixed} expected
 * @return {Error}
 * @api public
 */

exports.error = function(msg, actual, expected){
  var err = new Error(msg);
  err.actual = actual;
  err.expected = expected;
  err.showDiff = true;
  return err;
};

/**
 * Inspect `value`.
 *
 * @param {Mixed} value
 * @return {String}
 * @api private
 */

function inspect(value){
  return util.inspect(value).trim();
}
