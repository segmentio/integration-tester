
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

exports.send = function(facade, settings, fn){
  var type = 'json';
  var header = 'application/json';
  var payload = facade.json();
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

  this
    .post(type + '/' + facade.action())
    .query('baz=foo')
    .set('Content-Type', header)
    .set('X-Key', settings.key)
    .send(payload)
    .end(fn);
};
