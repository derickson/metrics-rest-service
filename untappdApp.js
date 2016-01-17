var config = require('./config').config.untappd;

var request = require( 'request' );
var moment  = require( 'moment' );

var async = require( 'async' );

var expressApp = null;
var esClient = null;
var metricsService = null;

var esIndexName = "untappd_token_store";
var esTypeName = "tokens";


var tfile = 'untappd-token.json';
var lastCheck = 'untappd-lastCheck.json';
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



var _init = function( app, client, metrics ) {
	expressApp = app;
	esClient = client;
	metricsService = metrics;

};

var _requestAPI = function(api, cb){

	var auth = '&client_id='+config.creds.clientID+'&client_secret='+config.creds.clientSecret;
	var uri = api + auth;

	console.log(uri);

	request({
		'uri':  uri,
		'method': 'GET'
	}, function(err,res,body){
		if(err) {
			console.log(err);
			return cb(error,null);
		}
		cb(null,body);
	});
};

var _processCheckins = function( checkins_count, checkins, cb){
	var q = async.queue(function(elem, callback){
		//do things
		console.log( elem.beer.beer_name);
		
		var _id = elem.checkin_id;
		var tsStr = elem.created_at;

		// Sat, 16 Jan 2016 18:05:33 -0500
		console.log(tsStr);
		var m = moment(tsStr, "ddd, DD MMM YYYY HH:mm:ss Z");

		var doc = {
			'metric_source' : 'untappd',
			'metric_channel' : 'untappd_checkins',
			'iso8601_time': m.toISOString(),
			'_id': _id,
			'payload': {
				'checkin_id': _id,
				'comment': elem.checkin_comment,
				'rating': elem.rating_score,
				'beer': elem.beer,
				'brewery': elem.brewery
			}
		};

		if(doc.payload.brewery['location'] && doc.payload.brewery['location'].lat && doc.payload.brewery['location'].lng){
			doc.payload['brewery_location'] = [elem.brewery['location'].lng, elem.brewery['location'].lat];
		}

		if(elem.venue && elem.venue['location'] && elem.venue['location'].lng && elem.venue['location'].lat) {
			doc['venue'] = elem.venue;
			doc['location'] = [elem.venue['location'].lng, elem.venue['location'].lat];
		}

		// console.log( JSON.stringify(doc, null, 2) );
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
				callback();
			});
		});

	}, 1);

	// what happens when the queue is done
	q.drain = cb;

	q.push( checkins, function(err){
		if(err) {
			console.log("Error on one of the queued items");
			console.log(err);
		}
	});			
};

var _recurseBeer = function( api, recursionsLeft ){

	if(recursionsLeft === 0) {
		return console.log("Recursions Exhausted")
	} else {
		console.log("Recursions Left: "+ recursionsLeft);
	}

	var pageSize = 50;
	var params =   '&limit='+pageSize;

	_requestAPI( api + params , function(err, body){
		if(err) return console.log(err);

		// console.log(res);
		// console.log("");
		console.log(body.response);
		var response = JSON.parse(body).response;
		
		// console.log( JSON.stringify(response, null, 2) );
		
		var nextUrl = response.pagination.next_url;


		var checkins = response.checkins.items;
		var checkins_count = response.checkins.count;

		console.log(checkins_count);
		console.log(checkins.length);

		_processCheckins( checkins_count, checkins, function(){
			if(checkins_count === pageSize) {
				setTimeout(function() {
					_recurseBeer( nextUrl, recursionsLeft -1 );
				}, config.sleep);
			} else {
				console.log('stopping as I think there is no more data');
			}
		} );


	});

}


var _repopulate = function( ) {
	console.log("untappd test");

	var api = 'https://api.untappd.com/v4/user/checkins/'+config.userName+'?'

	_recurseBeer( api, 30);

};

var _checkForMore = function( cb ) {

	// find the latest checkin
	esClient.search({
		"_source": ["untappd_checkins.checkin_id", "@timestamp"],
		"index": 'metric-untappd_checkins-*',
		"body": { 
			"sort": [{"untappd_checkins.checkin_id":{"order":"desc"}}],
			"size": 1
		}
	}, function(err, response){
		if(err) return console.log(err);

		var len = response.hits.hits.length;
		if(len > 0){
			var checkin_id = response.hits.hits[0]['_source'].untappd_checkins.checkin_id;


			console.log(checkin_id);
			var api = 'https://api.untappd.com/v4/user/checkins/Azathought?min_id=' + checkin_id;
			var pageSize = 50;
			var params =   '&limit='+pageSize;

			_requestAPI( api + params , function(err, body){
				if(err) return console.log(err);

				var response = JSON.parse(body).response;

				var checkins = response.items;
				var checkins_count = response.count;

				console.log("beers since last check: " + checkins_count);

				_processCheckins( checkins_count, checkins, function(){

					cb(checkins);
				});
				
				
			});

		}
	});

};


exports.app = {
	init : _init,
	repopulate : _repopulate,
	checkForMore : _checkForMore
};

