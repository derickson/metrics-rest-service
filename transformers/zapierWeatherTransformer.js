// transform handler for zapier weather

var convertTime = function(timeStr){
	return new Date(Number(timeStr) * 1000)
};

var convertNum = function( theString ){
	return Number(theString);
}

exports.transformer = {
	'name': 'zapierWeather',
	'isForMe' : function (body ){
		if( !body || !body.metric_channel || !body.metric_source){
			return false;
		} else {
			return ( body.metric_source === 'zapier' && body.metric_channel === 'weather');
		}
	},
	'handle' : function( body ){
		console.log('handling zapier Weather Transformer');

		var n_body = {
			'mertric_channel' : 'weather',
			'mertric_source' : 'zapier',
			'unixtimestamp': convertTime(body['time']),
			'payload': {
				"apparentTemperatureMinTime": 	convertTime( body.apparentTemperatureMinTime ), //"2016-01-03T11:00:00.000Z",
				"temperatureMinTime": 			convertTime( body.temperatureMinTime ), //"2016-01-03T09:00:00.000Z",
				"cloudCover": 					convertNum( body.cloudCover ), //"0.03",
				"temperatureMin": 				convertNum( body.temperatureMin ), //"29.98",
				"humidity": 					convertNum( body.humidity ), //"0.67",
				"dewPoint": 					convertNum( body.dewPoint ), //"27.74",
				"apparentTemperatureMax": 		convertNum( body.apparentTemperatureMax ), //"51.75",
				"temperatureMax": 				convertNum( body.temperatureMax ), //"51.75",
				"temperatureMaxTime": 			convertTime( body.temperatureMaxTime ), //"2016-01-03T20:00:00.000Z",
				"windBearing": 					convertNum( body.windBearing ), //"278",
				"moonPhase": 					convertNum( body.moonPhase ), //"0.79",
				"visibility": 					convertNum( body['visibility'] ), //"9.79",
				"sunsetTime": 					convertTime( body.sunsetTime ), //"2016-01-03T21:58:44.000Z",
				"pressure": 					convertNum( body.pressure ), //"1014.03",
				"apparentTemperatureMin": 		convertNum( body.apparentTemperatureMin ), //"25.15",
				"precipProbabilityRaw": 		convertNum( body.precipProbabilityRaw ), //"0",
				"precipIntensityMax": 			convertNum( body.precipIntensityMax ), //"0",
				"icon": 						body.icon, //"clear-day",
				"apparentTemperatureMaxTime": 	convertTime( body.apparentTemperatureMaxTime ), //"2016-01-03T20:00:00.000Z",
				"summary": 						body['summary'], //"Clear throughout the day.",
				"ozone": 						convertNum( body.ozone ), //"298.43",
				"windSpeed": 					convertNum( body.windSpeed ), //"4.94",
				"precipIntensity": 				convertNum( body.precipIntensity ), //"0",
				"sunriseTime": 					convertTime( body.sunriseTime ), //"2016-01-03T12:27:58.000Z",
				"precipProbability": 			convertNum( body.precipProbability )//"0",
			}
		}
		//console.log( JSON.stringify(n_body, null, '\t'));

		return n_body;
	}
}

