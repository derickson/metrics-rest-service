// transform handler for zapier weather
var moment = require('moment');
var config = require('../config').config;


var convertTime = function(timeStr){
	return new Date(Number(timeStr) * 1000)
};

var convertNum = function( theString ){
	return Number(theString);
}

var convertIftttTime = function( theString ){
    var timestamp = null;
    var m = moment(theString + config.ifttt_tz, "MMM DD, YYYY [at] hh:mmA Z");
    if(m.isValid()) {
      timestamp = m.format();
    }
    return timestamp;
}

exports.transformer = {
	'name': 'iftttAutomatic',
	'isForMe' : function (body ){
		if( !body || !body.metric_channel || !body.metric_source){
			return false;
		} else {
			return ( body.metric_source === 'ifttt' && body.metric_channel === 'automatic_trip');
		}
	},
	'handle' : function( body ){
		console.log('handling ifttt Automatic Transformer');

		var n_body = {
			'mertric_channel' : 'ifttt',
			'mertric_source' : 'automatic_trip',
			'iso8601_time': convertIftttTime(body.tripStartedAt),
			'payload':  body
		};

		n_body.payload.tripStartedAt = 	convertIftttTime(body.tripStartedAt);
		n_body.payload.tripEndedAt = 	convertIftttTime(body.tripEndedAt);

		n_body['location'] = [ convertNum(body.startLocationLon), convertNum(body.startLocationLat) ];

		//console.log( JSON.stringify(n_body, null, '\t'));

		return n_body;
	}
}

// Data Sample
/**
{
	"vehicleName": "Shawty",
	"tripStartedAt": "January 06, 2016 at 07:23AM",
	"tripEndedAt": "January 06, 2016 at 07:28AM",
	"tripDistanceMiles": 0.66,
	"tripDuration": "0:05",
	"averageMPG": 10.95,
	"fuelCostUSD": "$0.19",
	"fuelVolumeGal": "0.06",
	"hardBrakeCount": 0,
	"hardAccelCount": 0,
	"durationOver70MPH": 0,
	"durationOver75MPH": 0,
	"durationOver80MPH": 0,
	"tripPathImageMapURL": "http://ift.tt/1mBFbem",
	"startLocationLon": "-77.0066378",
	"startLocationLat": "38.9046998",
	"startLocationMapURL": "http://ift.tt/1PK8UuM",
	"endLocationLon": "-77.0064475",
	"endLocationLat": "38.9051552",
	"endLocationMapURL": "http://ift.tt/1PK8UuO"
}
*/