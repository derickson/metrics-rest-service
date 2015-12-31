// configs and libs
var config = require('./config').config;
var eslog = require('./eslog').eslog;

// express web server
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// express middleware kinds of things
var basicAuth = require('basic-auth');
var moment = require('moment');

// data back end
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: config.es_host
});

/**  ################ The app ########### */

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

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

app.post('/metric', auth, function(request, response) {
  var body = request.body;

  // required
  var metric_source = body.metric_source || null;
  if( !metric_source ){
    response.status(400).send('post payload requires metric_source field');
    eslog.log(client, request, 'Error: post payload requires metric_source field');
    return;
  }
  

  var metric_channel = body.metric_channel || null;
  if( !metric_channel ){
    response.status(400).send('post payload requires metric_channel field');
    eslog.log(client, request, 'Error: post payload requires metric_channel field');
    return;
  }

  var timestamp = null;
  var checkTime = body.checkTime || null;

  if( checkTime ) {
    var m = moment(checkTime + " EST", "MMM DD, YYYY [at] hh:mmA zz");
    if(m.isValid) {
      timestamp = m.toDate();
    }
  }
  
  if( !timestamp ){
    response.status(400).send('post payload requires a timestamp field such as: checkTime');
    eslog.log(client, request, 'Error: post payload requires a timestamp field such as: checkTime');
    return;
  }
  
  if( !body.payload) {
    response.status(400).send('post field payload required ');
    eslog.log(client, request, 'Error: post field payload required');
    return;
  }
  
  var n_body = {}
  n_body['@timestamp'] = timestamp;
  n_body['source'] = metric_source;
  n_body['channel'] = metric_channel;
  n_body[metric_channel] = body.payload;
  
  client.index({
    index: 'metric',
    type: metric_channel,
    body: n_body
  });
  
  console.log(request.body);
  console.log(n_body);
  
  response.status(200).send('Done');
  eslog.log(client, request, 'Metric: Done');
  
});


app.get('/', auth, function(request, response) {
  response.status(200).send('Helo world!');
  eslog.log(client, request, 'Received request for metics-rest-service');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


