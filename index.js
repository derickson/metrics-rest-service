// configs
var config = require('./config').config;

// express web server
var express = require('express');
var app = express();

// express middleware kinds of things
var basicAuth = require('basic-auth');

// data back end
var elasticsearch = require('elasticsearch');
var dateFormat = require('dateformat');

/**  ################ The app ########### */

var client = new elasticsearch.Client({
  host: config.es_host
});

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');


// authorization function, add as parameter in any routes you'd like authenticated
// code example from: https://davidbeath.com/posts/expressjs-40-basicauth.html
var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === config.user.name && user.pass === config.user.pass) {
    return next();
  } else {
    return unauthorized(res);
  };
};


app.get('/', auth, function(request, response) {
  response.send(200, 'Helo world!');
  var now = new Date();
  var indexName = 'logstash-' +  dateFormat(now,"yyyy.mm.dd");
  client.index({
    index: indexName,
    type: 'logs',
    body: {
      '@timestamp': now,
      'message': 'Received request for metics-rest-service',
      'hostname': request.hostname,
      'ip': request.ip,
      'originalUrl': request.originalUrl,
      'path': request.path,
      'protocol': request.protocol
    }
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


