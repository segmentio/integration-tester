
/**
 * Module dependencies.
 */

var assert = require('assert');
var Batch = require('batch');

/**
 * Respond with text
 */

exports.text = function(req, res, next){
  var str = '';
  req.setEncoding('utf-8');
  req.on('data', function(c){ str += c; });
  req.on('error', next);
  req.on('end', function(){
    var obj = JSON.parse(str);
    if (!obj.key) return res.send(200, 'key required');
    res.send(200, 'success=true');
  });
};

/**
 * Respond with json
 */

exports.json = function(req, res){
  if (!req.body.key) return res.json(400, { error: 'key required' });
  res.json(200, { success: true });
};

/**
 * Send
 */

exports.send = function(msg, fn){
  var settings = this.settings;
  var type = 'json';
  var header = 'application/json';
  var payload = msg.json();
  var text = settings.text;

  payload.key = settings.key;

  if (settings.handle) {
    fn = this.handle(fn);
  }

  if (settings.text) {
    payload = JSON.stringify(payload);
    header = 'text/plain';
    type = 'text';
  }

  var req = this
    .post(type + '/' + msg.type())
    .query(settings.query || msg.proxy('context.q') || 'baz=foo')
    .set('Content-Type', header)

  if (settings.key) {
    req.set('X-Key', settings.key)
  }

  req
    .send(payload)
    .end(fn);
};

/**
 * Multi
 */

exports.multi = function(msg, fn){
  var settings = this.settings;
  var Message = msg.constructor;
  var batch = new Batch;
  var send = exports.send;
  var self = this;

  assert('number' == typeof settings.times, '.times must be a number');

  for (var i = 0; i < settings.times; ++i) {
    (function(i){
      batch.push(function(done){
        var json = msg.json();
        json.context = { i: i, q: 'foo=' + i };
        send.apply(self, [
          new Message(json),
          done
        ]);
      });
    })(i);
  }

  batch.end(fn);
};
