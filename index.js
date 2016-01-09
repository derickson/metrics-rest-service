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
var dateFormat = require('dateformat');

// data back end
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: config.es_host
});




/**  ################ The app ########### */


//load data handlers (transformers)
var transformers = [];
transformers.push( require('./transformers/iftttAutomaticTransformer').transformer );
transformers.push( require('./transformers/zapierWeatherTransformer').transformer );
transformers.push( require('./transformers/identicalTransformer').transformer );

var transform = function( body ){
  var t_len = transformers.length;
  var transformer = null;
  for(var t = 0; t< t_len; ++t){
    transformer = transformers[t];
    // console.log(transformer.name);
    if(transformer.isForMe(body)){
      // console.log('yes');
      return transformer.handle(body);
    }
    // console.log('no');
  }
  console.log("Transformer: should have never gotten here, no valid transformers found.");
};





app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

// views is directory for all template files
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');


fitbitApp.init(app, client);



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

// do the work of raw logging all payloads wih natural timestamps
var rawLogger = function(body, request, response, next) {
  var now = new Date();

  var n_body = {}
  n_body['@timestamp'] = now;
  n_body['body'] = body;

  

  var now = new Date();
  var indexName = 'raw-' +  dateFormat(now,"yyyy.mm");
  client.index({
    index: indexName,
    type: 'raw',
    body: n_body
  }, function(error, res){
    if(!error){
      eslog.log(client, request, '  raw logging success');
      next();
    } else {
      eslog.log(client, request, '  raw logging error');
      response.status(500).send('Error');
      next();
    }
  });
};

// given a body, write out the log assuming we know what to do with it
var metricLogger = function(body, request, response, next) {
  
  // required
  var metric_source = body.metric_source || null;
  if( !metric_source ){
    response.status(400).send('post body requires metric_source field');
    eslog.log(client, request, 'Error: post body requires metric_source field');
    next(); return;
  }
  

  var metric_channel = body.metric_channel || null;
  if( !metric_channel ){
    response.status(400).send('post body requires metric_channel field');
    eslog.log(client, request, 'Error: post body requires metric_channel field');
    next(); return;
  }

  // big transform, document may not be modified if any of the specialize transformers pass on it
  var mod_bod = transform(body);
  
  // console.log(mod_bod);


  var timestamp = null;

  var checkTime = mod_bod.ifttt_checkTime || null;
  if( checkTime ) {
    var m = moment(checkTime + config.ifttt_tz, "MMM DD, YYYY [at] hh:mmA Z");
    if(m.isValid()) {
      timestamp = m.format();
    }
  }

  if( mod_bod.unixtimestamp ) timestamp = mod_bod.unixtimestamp;
  if( mod_bod.iso8601_time) timestamp = mod_bod.iso8601_time;

  if(!timestamp) {
    var ifttt_date = mod_bod.ifttt_date || null;
    if( ifttt_date ){
      var m = moment( ifttt_date + config.ifttt_tz, "D/M/YYYY Z" );
      if(m.isValid()) {
        timestamp = m.format();
      }
    }

    var fitbit_date = mod_bod.fitbit_date || null;
    if( fitbit_date ){
      var m = moment( fitbit_date + config.ifttt_tz, "MMM DD, YYYY Z" );
      if(m.isValid()) {
        timestamp = m.format();
      }
    }
  }

  
  if( !timestamp ){
    //response.status(400).send('post payload requires a timestamp field such as: checkTime');
    //eslog.log(client, request, 'Error: post payload requires a timestamp field such as: checkTime');
    // just use now as the timestamp
    timestamp = new Date();
  }
  
  // body HAS to have a payload section
  // TODO : wouldn't it be nice if this could just handle raw feeds with no formatting assumptions
  if( !mod_bod.payload) {
    response.status(400).send('post field payload required ');
    eslog.log(client, request, 'Error: post field payload required');
    next(); return;
  }


  var n_body = {}
  n_body['@timestamp'] = timestamp;
  n_body['source'] = metric_source;
  n_body['channel'] = metric_channel;
  if(mod_bod['location'] !== null) n_body['location'] = mod_bod['location'];
  n_body[metric_channel] = mod_bod.payload;
  
  var now = new Date();
  var indexName = 'metric-' +  dateFormat(timestamp,"yyyy.mm");
  
  client.index({
    index: indexName,
    type: "metric",
    body: n_body
  }, function(error, res){
    if(!error){
      eslog.log(client, request, '  metric logging success: '+ metric_channel + ' ' + metric_source);
      next();
    } else {
      eslog.log(client, request, '  metric logging error');
      response.status(500).send('Error');
      next();
    }
  });
  
};

//raw handler
app.post('/raw', auth, function(request, response) {
  var now = new Date();
  eslog.log(client, request, 'raw service');

  var body = request.body;

  rawLogger(body, request, response, function() {
    if(response.statusCode !== 500 && response.statusCode !== 400) {
      response.status(200).send('Done');
    } 
  });

});



//metric handler
app.post('/metric', auth, function(request, response) {
  var now = new Date();
  eslog.log(client, request, 'metric service');

  var body = request.body;

  rawLogger(body, request, response, function() {
    metricLogger(body, request, response, function() {
      if(response.statusCode !== 500 && response.statusCode !== 400) {
        response.status(200).send('Done');
      }
    });
  }); 
});

app.post('/metricOnly', auth, function(request, response) {
  var now = new Date();
  eslog.log(client, request, 'metricOnly service');


  var body = request.body;
  console.log(  body )

  
  metricLogger(body, request, response, function() {
    if(response.statusCode !== 500 && response.statusCode !== 400) {
      response.status(200).send('Done');
    }
  });

});

app.post('/zapier/weather', auth, function(request,response){
  var now = new Date()
  eslog.log(client, request, 'zapier custom service');

  var body = request.body;
  body['metric_source'] = 'zapier';
  body['metric_channel'] = 'weather';


  rawLogger(body, request, response, function() {
    metricLogger(body, request, response, function() {
      if(response.statusCode !== 500 && response.statusCode !== 400) {
        response.status(200).send('Done');
      }
    });
  }); 

});

app.post('/ifttt/automatic', auth, function(request,response){

  var now = new Date()
  eslog.log(client, request, 'ifttt automatic custom service');

  var body = request.body;
  body['metric_source'] = 'ifttt';
  body['metric_channel'] = 'automatic_trip';


  rawLogger(body, request, response, function() {
    metricLogger(body, request, response, function() {
      if(response.statusCode !== 500 && response.statusCode !== 400) {
        response.status(200).send('Done');
      }
    });
  });

});


// SET UP THE FITBIT APP
var fitbitApp = require('./fitbitApp').app;
fitbitApp.init(app, client);
app.get('/test', function(request, response){
  fitbitApp.steps( function(err, profile) {
    if(err){
      response.status(500).send('error');
      
    } else {
      response.status(200);
      response.setHeader('Content-Type', 'application/json');
      response.send(JSON.stringify(profile));
    }
  });
});


// app.get('/', auth, function(request, response) {
//   response.status(200).send('Helo world!');
//   eslog.log(client, request, 'Received request for metics-rest-service');
// });

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


