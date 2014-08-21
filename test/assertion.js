
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
    segment = Segment({});
  })

  after(function(){
    server.close();
  })

  describe('()', function(){
    it('should throw', function(){
      throws(Assertion, 'expected integration');
    })
  })

  describe('.fixture(name)', function(){
    it('should return a fixture by its name', function(){
      var json = Assertion(segment, __dirname).fixture('equal');
      assert(json.input);
      assert(json.output);
    });
  });

  describe('.maps(name, settings)', function(){
    beforeEach(function(){
      var map = { identify: identify };
      Segment = integration('Segment').mapper(map);
      segment = Segment();

      function identify(msg) {
        msg = msg.json();
        msg.timestamp = msg.timestamp.getTime();
        return msg;
      }
    })

    it('should not throw when input == output', function(){
      Assertion(segment, __dirname).maps('equal');
    });

    it('should throw an error when input != output', function(){
      var err;

      try {
        Assertion(segment, __dirname).maps('not-equal');
      } catch (e) {
        err = e;
      }

      assert(err, 'expected integration to throw');
      assert(err.actual, 'err must have .actual');
      assert(err.expected, 'err must have .expected');
      assert.equal(true, err.showDiff, 'err must have .showDiff = true');
    });

    it('should merge settings when available', function(){
      segment.mapper.identify = function(_, s){ return s; };
      Assertion(segment, __dirname).maps('settings', {
        a: 1,
        b: 2
      });
    });

    it('should map ecommerce events', function(){
      segment.mapper.completedOrder = function(t){ return t.properties(); };
      Assertion(segment, __dirname).maps('ecommerce');
    });

    it('should throw when the mapper is missing', function(){
      segment.mapper.identify = null;
      var a = Assertion(segment, __dirname);
      var fixture = a.maps.bind(a, 'equal');
      throws(fixture, 'integration.mapper.identify() is missing');
    });

    it('should throw when the mapper returns falsey value', function(){
      segment.mapper.identify = Function('return null');
      var a = Assertion(segment, __dirname);
      var fixture = a.maps.bind(a, 'equal');
      throws(fixture, 'integration.mapper.identify() returned "null"')
    });
  });

  describe('.valid(msg, settings)', function(){
    beforeEach(function(){
      Segment.ensure('message.userId');
      Segment.ensure('settings.apiKey');
    });

    it('should not throw if message.userId and settings.apiKey exists', function(){
      Assertion(segment).valid({ userId: 1 }, { apiKey: 'key' });
    });

    it('should throw if message.userId is missing', function(){
      var a = Assertion(segment);
      var valid = a.valid.bind(a, {}, { apiKey: 'key' });
      throws(valid, 'Segment: message attribute "userId" is required');
    });

    it('should throw if settings.apiKey is missing', function(){
      var a = Assertion(segment);
      var valid = a.valid.bind(a, { userId: 0 });
      throws(valid, 'Segment: setting "apiKey" is required');
    });
  });

  describe('.invalid(msg, settings)', function(){
    beforeEach(function(){
      Segment.ensure('message.userId');
      // TODO: more tests
    });

    it('should throw when the method doesnt return an error', function(){
      var a = Assertion(segment);
      var invalid = a.invalid.bind(a, { userId: 1 });
      throws(invalid, 'expected .validate(msg, settings) to return an error.');
    });

    it('should not throw if the method returns an error', function(){
      Assertion(segment).invalid({ userId: null });
    });
  });

  describe('.retries(n)', function(){
    beforeEach(function(){
      Segment.retries(2);
      segment = new Segment();
    })

    it('should not throw when number of retries is correct', function(){
      Assertion(segment).retries(2);
    })

    it('should throw when number of retries is incorrect', function(){
      var a = Assertion(segment);
      throws(a.retries.bind(a, 3), 'expected retries to be "3" but it\'s "2"');
    })
  })

  describe('.name(name)', function(){
    it('should not throw when the name is correct', function(){
      Assertion(segment).name('Segment');
    })

    it('should throw when the name is incorrect', function(){
      var a = Assertion(segment);
      throws(a.name.bind(a, 'segment'), 'expected name to be "segment" but it\'s "Segment"');
    })
  })

  describe('.timeout(ms)', function(){
    beforeEach(function(){
      Segment.timeout(2000);
      segment = new Segment();
    })

    it('should not thow when given correct timeout', function(){
      Assertion(segment).timeout(2000);
    })

    it('should accept strings', function(){
      Assertion(segment).timeout('2s');
    })

    it('should throw on incorrect timeout', function(){
      var a = Assertion(segment);
      throws(a.timeout.bind(a, 1), 'expected timeout to be "1" but it\'s "2000"');
    })
  })

  describe('.endpoint(url)', function(){
    it('should not throw when given correct url', function(){
      Assertion(segment).endpoint(segment.endpoint);
    })

    it('should throw on incorrect url', function(){
      var a = Assertion(segment);
      throws(a.endpoint.bind(a, 'foo'), 'expected endpoint to be "foo" but it\'s "http://localhost:3000/"');
    })
  })

  describe('.channels()', function(){
    it('should assert integration is enabled on the given channels', function(){
      var Segment = integration('Segment').channels(['client', 'server']);
      var segment = Segment();
      Assertion(segment).channels(['client', 'server']);
    });

    it('should throw on mismatch', function(){
      var Segment = integration('Segment').channels(['server']);
      var segment = Segment();
      var a = Assertion(segment);
      var chans = a.channels.bind(a, ['one', 'two']);
      throws(chans, "expected [ 'one', 'two' ] but got [ 'server' ]");
    });
  });

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

    it('should throw on mismatch', function(done){
      Assertion(segment)
        .set({ query: 'foo=baz' })
        .set({ key: 'baz' })
        .identify({})
        .query({ foo: 'wee' })
        .end(error('expected { foo: \'wee\' } but got { foo: \'baz\' }', done));
    });
  })

  describe('.query(key, value)', function(){
    it('should assert sent query correctly', function(done){
      Assertion(segment)
        .set({ query: 'foo=baz' })
        .set({ key: 'baz' })
        .identify({})
        .query('foo', 'baz')
        .expects(200, done);
    });

    it('should error on mismatch', function(done){
      Assertion(segment)
        .set({ query: 'foo=baz' })
        .set({ key: 'baz' })
        .identify({})
        .query('foo', 'wee')
        .end(error('expected { foo: \'wee\' } but got { foo: \'baz\' }', done));
    });
  });

  describe('.query(key, value, parse)', function(){
    it('should assert sent query correctly', function(done){
      Assertion(segment)
        .set({ query: 'foo=[1,2,3]' })
        .set({ key: 'baz' })
        .identify({})
        .query('foo', [1, 2, 3], JSON.parse)
        .expects(200, done);
    });

    it('should error on mismatch', function(done){
      Assertion(segment)
        .set({ query: 'foo=[1,2,3]' })
        .set({ key: 'baz' })
        .identify({})
        .query('foo', [1], JSON.parse)
        .end(error('expected { foo: [ 1 ] } but got { foo: [ 1, 2, 3 ] }', done));
    });
  });

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

  describe('.end(fn)', function(){
    it('should supply (err, res)', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .identify({})
        .end(function(err, res){
          assert.equal('Response', res.constructor.name);
          done();
        });
    });

    it('should supply err when the method is not implemented', function(done){
      segment.identify = null;
      Assertion(segment)
        .set('key', 'baz')
        .identify({})
        .end(error('identify() is not implemented', done));
    });
  });

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

  describe('.pathname(value)', function(){
    it('should assert request path', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .track({})
        .pathname('/json/track')
        .expects(200, done);
    });

    it('should error on mismatch', function(done){
      Assertion(segment)
        .set('key', 'baz')
        .track({})
        .pathname('/json/trac')
        .end(error('expected request pathname to be "/json/trac" but got "/json/track"', done));
    });
  });

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

  describe('multi', function(){
    beforeEach(function(){
      Segment.prototype.track = support.multi;
      segment = Segment({});
    });

    describe('.requests(n)', function(){
      it('should succeed on match', function(done){
        Assertion(segment)
          .set('key', 'baz')
          .set('times', 2)
          .track({ userId: '1' })
          .requests(2)
          .end(done);
      });
    });
  });
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
