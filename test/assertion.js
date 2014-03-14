
var integration = require('segmentio-integration');
var support = require('./support');
var express = require('express');
var Assertion = require('..');

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

  before(function(){
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
      Assertion.should.throw('expected integration');
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

    it('should error if regexp doesnt match', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', /baz/)
        .end(error('expected header "Content-Type: application/json" to match "/baz/"', done));
    })

    it('should error on mismatch', function(done){
      Assertion(segment)
        .identify({})
        .set('key', 'baz')
        .sends('Content-Type', 'baz')
        .end(error('expected header "Content-Type: application/json" to match "baz"', done));
    })
  })

  describe('.sends(value)', function(done){
    it('should assert sent object body correctly', function(done){
      var date = new Date;
      Assertion(segment)
        .identify({ userId: 1, timestamp: date })
        .set('key', 'baz')
        .sends({ userId: 1, key: 'baz', timestamp: date })
        .expects(200, done);
    })
  })

  describe('.expects(value)', function(done){
    it('should assert status correctly', function(done){
      Assertion(segment)
        .identify({})
        .expects(400, done);
    })
  })
})

/**
 * Expect an error
 */

function error(msg, done){
  return function(err, res){
    if (!err) return done(new Error('expected an error'));
    err.message.should.eql(msg);
    done();
  };
}
