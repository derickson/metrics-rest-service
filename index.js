var config = require('./config').config;

var express = require('express');
var app = express();
var elasticsearch = require('elasticsearch');
var dateFormat = require('dateformat');

var client = new elasticsearch.Client({
  host: config.host
});


app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');


app.get('/', function(request, response) {
  response.send('Helo world!');
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


