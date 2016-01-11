
var Fitbit  = require( './fitbit-oauth2/Fitbit' );

var async = require( 'async' );

var dateFormat = require('dateformat');
var moment = require('moment');

var config = {
        "startingFitBitBackDate": '2016-01-01',
        "timeout": 10000,
        "creds": {
            "clientID": process.env.FITBIT_CLIENTID || "ABC", // will fail locally
            "clientSecret": process.env.FITBIT_CLIENT_SECRET || "DEF" // will fail locally
        },
        "uris": {
            "authorizationUri": "https://www.fitbit.com",
            "authorizationPath": "/oauth2/authorize",
            "tokenUri": "https://api.fitbit.com",
            "tokenPath": "/oauth2/token"
        },
        "authorization_uri": {
            "redirect_uri": process.env.FITBIT_CALLBACK || "http://localhost:5000/fitbit_auth_callback",
            "response_type": "code",
            "scope": "activity nutrition profile settings sleep social weight heartrate",
            "state": "3(#0/!~"
        }
    };

var expressApp = null;
var esClient = null;
var metricsService = null;

var esIndexName = "fitbit_token_store";
var esTypeName = "tokens";


var tfile = 'fb-token.json';
var lastCheck = 'fb-lastCheck.json';
var esPersist = {
	read: function( filename, cb ) {
		esClient.get({
			index: esIndexName,
			type: esTypeName,
			id: filename
		}, function(error, response) {
			if(error) return cb(error);
			try {
				cb( null, response['_source'] );
			} catch(error) {
				cb( error );
			}
		});
	},
    write: function( filename, token, cb ) {
        console.log( 'persisting new token:', JSON.stringify( token ) );
        esClient.index({
			index: esIndexName,
			type: esTypeName,
			id: filename,
			body: token
        }, function( error, response) {
			if(error) return cb(error);
			try {
				cb( null, response );
			} catch(error) {
				cb( error );
			}
		});
        // fs.writeFile( filename, JSON.stringify( token ), cb );
    }
};

var fitbit = null;

var _init = function( app, client, metrics ) {
	expressApp = app;
	esClient = client;
	metricsService = metrics;


	// Instantiate a fitbit client.  See example config below.
	//
	fitbit = new Fitbit( config ); 


	// In a browser, http://localhost:4000/fitbit to authorize a user for the first time.
	//
	expressApp.get('/fitbit', function (req, res) {
	    res.redirect( fitbit.authorizeURL() );
	});

	// Callback service parsing the authorization token and asking for the access token.  This
	// endpoint is refered to in config.fitbit.authorization_uri.redirect_uri.  See example
	// config below.
	//
	app.get('/fitbit_auth_callback', function (req, res, next) {
	    // console.log("entering callback");
	    var code = req.query.code;
	    // console.log("the code was: " + code);
	    fitbit.fetchToken( code, function( err, token ) {
	    	// if(err) console.log("there was an error yo");
	        if ( err ) return next( err );
			// console.log("fetch token happened now I have  token to persist");
	        // persist the token
	        esPersist.write( tfile, token, function( err ) {
	            if ( err ) return next( err );

	            // console.log("persist probably succeeded, redirecting to profile");
	            res.redirect( '/fb-success.html' );
	        });
	    });
	});



};


var handledAPICall = function (uri, cb){
	esPersist.read( tfile, function(err, token){
		if(err) {
			console.log("error retrieving token");
		} else {
			fitbit.setToken( token );

			fitbit.request({
        		uri: uri,
        		method: 'GET',
    		}, function( err, body, token ) {
		        if ( err ) {
		            console.log( err );
		            return cb( err );
		        }

		        cb(null, JSON.parse( body ));
        		//console.log( JSON.stringify( JSON.parse( body ), null, 2 ) );

		        // If the token arg is not null, then a refresh has occured and
		        // we must persist the new token.
		        if ( token ) {
		        	esPersist.write( tfile, token, function( err ) {
		            if ( err ) console.log( err );
		                console.log("error writing token");
		            });
		        }
    		});

		}
	});
};

var mocMetric = function( day, time, steps, cb){
	var tsStr = day+"T"+time+"-0500";

	var doc = {
		'metric_source' : 'fitbit',
		'metric_channel' : 'fitbit_intraday_steps',
		'iso8601_time': tsStr,
		'payload': {
			'steps': steps
		}
	};
	// console.log(JSON.stringify(doc, null, 2));
	metricsService.rawLogger(doc, '/metric', function(err){
		if(err) {
			console.log( err );
			return cb(err);
		}
		metricsService.metricLogger( doc, function(err){
			if(err) {
				console.log( err );
				return cb(err);
			}
			cb(null);
		});
	});

	
};

var mocSaveLastCall= function( dateStr, timeStr, cb ){
	var lastCallDoc = {
		'day' : dateStr,
		'time': timeStr
	};
	esPersist.write( lastCheck, lastCallDoc, function( err, lc ){
		if(err) {
			console.log('error persisting last call');
			console.log(err);
			return cb(err);
		}
		// console.log(JSON.stringify(lastCallDoc, null, 2));
		return cb(null);
	});
	
}



// This is the complicated one.  This is the polling algorithm
var handleDeltaCall =  function( cb ) {
	var ret = null;

	esPersist.read( lastCheck, function( err, lc ){
		// if there isn't a lastCheck in there yet, put in the config default and try again
		if(err) {
			console.log('no lastCheck found');
			mocSaveLastCall( config.startingFitBitBackDate, '00:00:00', function(err){
				if(err){
					console.log(err);
					return cb(err);
				} else
					return handleDeltaCall( cb );
			});
		} else {
			var now = Date();

			console.log('a last check was found');
			console.log( '  today is: ' + dateFormat(now,"yyyy-mm-dd") );
			console.log( '  current time is: ' + dateFormat(now,"HH:MM:ss"));
			console.log( '  data day is: ' + lc.day );
			console.log( '  data last time is: ' + lc['time'] );
			
			var tsStr = lc.day+"T"+lc['time']+"-0500";
			var lastTime = new Date(tsStr);

			var n = moment();

			var nextInterest = moment(tsStr).add(1,'m');
			var endOfNextInterestDay = moment(nextInterest).endOf('day');
			var twentyMinutesAgo = moment(n).subtract(20, 'm');
			var endMoment = moment.min( endOfNextInterestDay, twentyMinutesAgo );
			var startDay = nextInterest.format("YYYY-MM-DD");
			var startTime = nextInterest.format("HH:mm");
			var endTime = endMoment.format("HH:mm");
			var uri = "https://api.fitbit.com/1/user/-/activities/steps/date/"+startDay+"/1d/1min/time/"+startTime+"/"+endTime+".json"
			console.log(uri);

			handledAPICall( uri , function(err, resp){
				if(err) return cb(err);
				
				if(resp['activities-steps'] && resp['activities-steps'].length > 0){
					var dateStr = resp['activities-steps'][0]['dateTime'];
					var dataSet = resp['activities-steps-intraday']['dataset'];

					console.log("Inserting  "+ dataSet.length +" records");

					// queue with restricted concurrency
					var q = async.queue(function(task, callback){
						//do things
						mocMetric( dateStr, task['time'], task['value'], callback);
					}, 2);

					// what happens when the queue is done
					q.drain = function(){
						console.log("all callbacks have occurred??")
						
						var lastDP =  dataSet[ dataSet.length - 1];
						var t = moment( dateStr + "T" + lastDP['time'] + "-0500");
						console.log("lastTimeRead: " + t.format());

						mocSaveLastCall( t.format('YYYY-MM-DD'), t.format('HH:mm:ss'), function(err){
							if(err) return cb(err);

							cb(null, lastDP);

						});
					};

					q.push( dataSet, function(err){
						if(err) {
							console.log("Error on one of the queued items");
							console.log(err);
						}
					});

				}
			});

		}


	});

	
};


exports.app = {
	init : _init,
	profile : function( cb ){
		handledAPICall( "https://api.fitbit.com/1/user/-/profile.json", cb );
	},
	steps : function(cb){
		handledAPICall( "https://api.fitbit.com/1/user/-/activities/steps/date/today/7d.json", cb );
	},
	intraSteps : function(cb){
		handledAPICall( "https://api.fitbit.com/1/user/-/activities/steps/date/today/1d/15min.json", cb );
	},
	intraDeltaSteps : handleDeltaCall
};

//handledAPICall( "https://api.fitbit.com/1/user/-/activities/steps/date/today/7d.json", cb );