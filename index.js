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


//raw handler
app.post('/raw', auth, function(request, response) {
  // eslog.log(client, request, 'raw service');

  var body = request.body;

  metrics.rawLogger(body, null, function(err, resp) {
    _handleErr(err, response);
  });

});



//metric handler
app.post('/metric', auth, function(request, response) {
  // eslog.log(client, request, 'metric service');

  var body = request.body;

  metrics.rawLogger(body, '/metric', function(err, resp) {
    if(err) return _handleErr(err, response);

    metrics.metricLogger(body, function(err, resp) {
        _handleErr(err, response);
    });
    
  }); 
});

app.post('/metricOnly', auth, function(request, response) {
  // eslog.log(client, request, 'metricOnly service');

  var body = request.body;

  metrics.metricLogger(body, function(err, resp) {
    _handleErr(err, response);
  });

});

app.post('/zapier/weather', auth, function(request,response){
  // eslog.log(client, request, 'zapier custom service');

  var body = request.body;
  body['metric_source'] = 'zapier';
  body['metric_channel'] = 'weather';


  metrics.rawLogger(body, '/zapier/weather', function(err, resp) {
    if(err) return _handleErr(err, response);

    metrics.metricLogger(body, function(err, resp) {
        _handleErr(err, response);
    });
    
  }); 

});

app.post('/ifttt/automatic', auth, function(request,response){
  //eslog.log(client, request, 'ifttt automatic custom service');

  var body = request.body;
  body['metric_source'] = 'ifttt';
  body['metric_channel'] = 'automatic_trip';


  metrics.rawLogger(body, '/ifttt/automatic', function(err, resp) {
    if(err) return _handleErr(err, response);

    metrics.metricLogger(body, function(err, resp) {
        _handleErr(err, response);
    });
    
  }); 

});


var fitbitApp = require('./fitbitApp').app;
fitbitApp.init(app, client);
app.get('/test', function(request, response){
  fitbitApp.intraSteps( function(err, profile) {
    if(err){
      response.status(500).send('error');
      
    } else {
      response.status(200);
      response.setHeader('Content-Type', 'application/json');
      response.send(JSON.stringify(profile));
    }
  });
});


/**  ################ Start Express Server ########### */

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

