
/**
 * Module dependencies.
 */

var inspect = require('util').inspect;
var assert = require('assert');

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
    + 'expected header "' + header[0]
    + ': ' + actual + '" to match "' + expected + '"'
    , actual
    , expected);
};

/**
 * Compare numbers / strings / regexp with `body`.
 *
 * @param {Request} req
 * @param {Mixed} value
 * @return {Error}
 * @api public
 */

exports.other = function(req, value){
  var data = String(req._data);
  var t = exports.type(value);
  if ('regexp' == t && value.test(data)) return;
  if (value == data) return;
  return exports.error(''
    + 'expected body "' + data + '" '
    + 'to match "' + value + '"'
    , value
    , data);
};

/**
 * Compare `actual` with `expected`.
 *
 * @param {Mixed} actual
 * @param {Mixed} expected
 * @return {Error}
 * @api public
 */

exports.equals = function(actual, expected){
  try {
    assert.deepEqual(actual, expected);
  } catch (e) {
    return exports.error(''
      + 'expected "' + inspect(actual)
      + '" but got "' + inspect(expected) + '"'
      , actual
      , expected);
  }
};

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
  if (~query.indexOf(str)) return;
  return exports.error(''
    + 'expected "' + query + '" '
    + 'to include "' + str + '"'
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
