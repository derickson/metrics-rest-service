// configs and libs
var config = require('./config').config;
//var eslog = require('./eslog').eslog;

// express web server
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// express middleware kinds of things
var basicAuth = require('basic-auth');
var moment = require('moment');

/**  ################ Elasticsearch connection ########### */
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: config.es_host
});

/**  ################ metrics service connection ########### */
var metrics = require('./metrics').metrics;
metrics.init( client , config);


/**  ################ Basic Express Setings ########### */

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

app.set('port', (process.env.PORT || 5000));
app.use('/', auth);
app.use('/', express.static(__dirname + '/public'));
app.use(bodyParser.json());


function _handleErr(err, response) {
  if(err){
    if(err.errorCode) {
      response.status(err.errorCode);
      response.send("Error: " + err.message);
    } else {
      response.status(500);
      response.send("Error: Error encountered");
    }
  } else {
    response.status(200);
    response.send("Done");
  }

  return;
};

function _rawOnly(body, path, response) {
  metrics.rawLogger(body, null, "null", function(err, resp) {
    _handleErr(err, response);
  });
};

function _metricOnly(body, response) {
  metrics.metricLogger(body, function(err, resp) {
      _handleErr(err, response);
  });
};

function _rawThenMetric(body, path, response) {
  metrics.rawLogger(body, path, function(err, resp) {
    if(err) return _handleErr(err, response);
    metrics.metricLogger(body, function(err, resp) {
        _handleErr(err, response);
    });
  }); 
};


//raw handler
app.post('/raw', auth, function(request, response) {
  var body = request.body;

  _rawOnly(body,response);
});


//metric handler
app.post('/metric', auth, function(request, response) {
  var body = request.body;

  _rawThenMetric(body,'/metric', response);
});


app.post('/metricOnly', auth, function(request, response) {
  var body = request.body;

  _metricOnly(body, response)

});

app.post('/zapier/weather', auth, function(request,response){
  var body = request.body;
  body['metric_source'] = 'zapier';
  body['metric_channel'] = 'weather';

  _rawThenMetric(body,'/zapier/weather', response);
});

app.post('/zapier/weatherOnly', auth, function(request,response){
  var body = request.body;
  body['metric_source'] = 'zapier';
  body['metric_channel'] = 'weather';

  _metricOnly(body, response);
});


app.post('/ifttt/automatic', auth, function(request,response){
  var body = request.body;
  body['metric_source'] = 'ifttt';
  body['metric_channel'] = 'automatic_trip';

  _rawThenMetric(body,'/ifttt/automatic', response);
});

app.post('/ifttt/automaticOnly', auth, function(request,response){
  var body = request.body;
  body['metric_source'] = 'ifttt';
  body['metric_channel'] = 'automatic_trip';

  _metricOnly(body, response);
});



var fitbitApp = require('./fitbitApp').app;
fitbitApp.init(app, client, metrics);
app.get('/test', function(request, response){
  fitbitApp.profile( function(err, profile) {
    if(err){
      response.status(500).send('error');
      
    } else {
      response.status(200);
      response.setHeader('Content-Type', 'application/json');
      response.send(JSON.stringify(profile));
    }
  });
});
app.get('/testFitbit', function(request, response){
  fitbitApp.intraDeltaSteps( function(err, resp) {
    if(err){
      console.log(err);
      response.status(500).send('error');
      
    } else {
      response.status(200);
      response.setHeader('Content-Type', 'application/json');
      response.send(JSON.stringify(resp));
    }
  });
});

// setInterval(function(){
//   console.log("Starting fitbit near real-time pull");
//   fitbitApp.intraDeltaSteps( function(err, resp){
//     if(err){
//       console.log('error in interval fitbit task');
//     } else {
//       console.log("fitbit interval task happened");
//     }
//   });

// }, 5 * 60 * 1000); 



/**  ################ Start Express Server ########### */

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

