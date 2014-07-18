
var integration = require('segmentio-integration');
var facade = require('segmentio-facade');
var support = require('./support');
var express = require('express');
var assert = require('assert');
var Assertion = require('..');
var Track = facade.Track;

describe('Assertion', function(){
  var Segment;
  var segment;
  var server;

  before(function(done){
    var app = express();
    app.use(express.urlencoded());
    app.use(express.json());
    app.all('/text/:action', support.text);
    app.all('/json/:action', support.json);
    server = app.listen(3000, done);
  })

  beforeEach(function(){
    Segment = integration('Segment');
    Segment.endpoint('http://localhost:3000/');
    Segment.prototype.identify = support.send;
    Segment.prototype.group = support.send;
    Segment.prototype.screen = support.send;
    Segment.prototype.track = support.send;
    Segment.prototype.alias = support.send;
    Segment.prototype.page = support.send;
    segment = Segment();
  })

  after(function(){
    server.close();
  })

  describe('()', function(){
    it('should throw', function(){
      assert.throws(Assertion, 'expected integration');
    })
  })

  describe('.endpoint()', function(){
    it('should not throw when given correct url', function(){
      Assertion(segment).endpoint(segment.endpoint);
    })

    it('should throw on incorrect url', function(){
      var a = Assertion(segment);
      throws(a.endpoint.bind(a, 'foo'), "expected endpoint to be \"foo\" but it's \"http://localhost:3000/\"");
      Assertion(segment).endpoint('foo');
    })
  })

  describe('.CHANNEL()', function(){
    it('should assert integration enabled correctly', function(){
      Assertion(segment).server();
    })

    it('should respect optional `msg`', function(){
      segment.enabled = function(msg){
        assert('function' == typeof msg.action);
        assert('id' == msg.userId());
        return true;
      };
      Assertion(segment).server({ userId: 'id' });
    })

    it('should throw if integration is not enabled on channel', function(){
      var a = Assertion(segment);
      throws(a.mobile.bind(a), 'expected integration to be enabled on "mobile"');
    })

    it('should accept facade instance', function(){
      segment.enabled = function(msg){ return 'server' == msg.channel(); };
      assert(Assertion(segment).server(new Track({})));
    })

    it('should pick facade by `type` / `action`', function(){
      segment.enabled = function(msg){ return 'page' == msg.type(); };
      Assertion(segment).server({ type: 'page' });
    })
  })

  describe('.enabled(msg)', function(){
    it('should pass settings too', function(){
      segment.enabled = function(msg, conf){ return 1 == conf.setting; };
      Assertion(segment).set('setting', true).enabled({});
    })

    it('should accept facade instances', function(){
      Assertion(segment).enabled(new Track({ channel: 'server' }));
    })

    it('should throw in case the integration is not enabled', function(){
      segment.enabled = function(){ return false; };
      var a = Assertion(segment);
      throws(a.enabled.bind(a))
    })
  })

  describe('.all()', function(){
    it('should assert integration enabled on all channels', function(){
      segment.enabled = function(){ return true; };
      Assertion(segment).all();
    })

    it('should throw if integration is not enabled on all channels', function(){
      segment.enabled = function(msg){ return 'server' == msg.channel(); };
      var a = Assertion(segment);
      throws(a.all.bind(a), 'expected message to be enabled on all channels, but it is disabled on "client, mobile"');
    })
  })

  describe('.error(fn)', function(){
    it('should assert integration error', function(done){
      Assertion(segment)
        .identify({})
        .set({ handle: true })
        .error(done);
    })

    it('should throw if integration didnt error', function(done){
      Assertion(segment)
        .identify({})
        .set({ key: 'baz' })
        .error(function(err){
          assert(err);
          done();
        });
    })
  })

  describe('.query(obj)', function(){
    it('should assert sent query correctly', function(done){
      Assertion(segment)
        .set({ query: 'foo=baz' })
        .set({ key: 'baz' })
        .identify({})
        .query({ foo: 'baz' })
        .expects(200, done);
    })

    it('should buffer arguments', function(done){
      Assertion(segment)
        .set({ query: 'foo=baz&baz=foo' })
        .set({ key: 'baz' })
        .identify({})
        .query({ foo: 'baz', baz: 'foo' })
        .expects(200, done);
    })
  })

  describe('.sends(key, value)', function(){
    it('should assert sent headers correctly', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', 'application/json')
        .expects(200, done);
    })

    it('should accept regexp as header value', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', /json/)
        .expects(200, done);
    })

    it('should error if header doesnt match', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', 'baz')
        .end(error('expected header \'Content-Type\': \'application/json\' to match \'baz\'', done));
    })

    it('should error if regexp header doesnt match', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', /baz/)
        .end(error('expected header \'Content-Type\': \'application/json\' to match /baz/', done));
    })
  })

  describe('.sends(value)', function(done){
    it('should assert sent object body correctly', function(done){
      var date = new Date;
      Assertion(segment)
        .identify({ userId: 1, timestamp: date })
        .set('key', 'baz')
        .sends({ userId: 1, key: 'baz', timestamp: date, type: 'identify' })
        .expects(200, done);
    })

    it('should assert querystring correctly', function(done){
      Assertion(segment)
        .identify({ userId: 1 })
        .set('key', 'baz')
        .sends('?baz')
        .expects(200, done);
    })

    it('should error on querystring mismatch', function(done){
      Assertion(segment)
        .identify({ userId: 1 })
        .set('key', 'baz')
        .sends('?baz=wee')
        .end(error('expected \'baz=foo\' to include \'baz=wee\'', done));
    })

    it('should assert regexp request correctly', function(done){
      Assertion(segment)
        .set('text', true)
        .set('key', 'baz')
        .group({})
        .sends(/baz/)
        .expects(200, done);
    })
  })

  describe('.expects(value)', function(done){
    it('should assert status correctly', function(done){
      Assertion(segment)
        .identify({})
        .expects(400, done);
    })

    it('should assert object response correctly', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .track({})
        .expects({ success: true })
        .expects(200, done);
    })

    it('should assert string response correctly', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .set('text', true)
        .identify({})
        .expects('success=true', done);
    })

    it('should assert regexp response correctly', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .set('text', true)
        .identify({})
        .expects(/success/, done);
    })

    it('should error if object doesnt match response', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .alias({})
        .expects({ 0: 0 })
        .end(error('expected { \'0\': 0 } but got { success: true }', done));
    })

    it('should error if status doesnt match', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .identify({})
        .expects(500)
        .end(error('expected 500 but got 200', done));
    })

    it('should error if string doesnt match response', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .set('text', true)
        .identify({})
        .expects('weee')
        .end(error('expected \'weee\' but got \'success=true\'', done));
    })

    it('should error if regexp doesnt match response', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .set('text', true)
        .identify({})
        .expects(/wee/)
        .end(error('expected \'success=true\' to match /wee/', done));
    })
  })
})

/**
 * Expect an error
 */

function error(msg, done){
  return function(err, res){
    if (!err) return done(new Error('expected an error'));
    assert.equal(err.message, msg);
    done();
  };
}

/**
 * assert.throws() broken, doesn't compare messages.... :/
 */

function throws(fn, expected){
  var actual;

  try {
    fn();
  } catch (e) {
    actual = e.message;
  }

  if (!expected) {
    assert(actual, 'expected an error');
    return;
  }

  assert.equal(actual, expected);
}
