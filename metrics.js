var dateFormat = require('dateformat');
var moment = require('moment');


/**  ################ local Variables ########### */
var _esClient = null;
var _config = null;
var _transformers = [];

/**  ################ local contants ########### */
var RAW_INDEX = "raw";
var RAW_TYPE = "raw";

var METRIC_INDEX = "metric";
var METRIC_TYPE = "metric";

/**  ################ Data Transformers ########### */
//load data handlers (transformers)

_transformers.push( require('./transformers/iftttAutomaticTransformer').transformer );
_transformers.push( require('./transformers/zapierWeatherTransformer').transformer );
_transformers.push( require('./transformers/identicalTransformer').transformer );

var transform = function( body ){
  var t_len = _transformers.length;
  var transformer = null;
  for(var t = 0; t< t_len; ++t){
    transformer = _transformers[t];
    // console.log(transformer.name);
    if(transformer.isForMe(body)){
      // console.log('yes');
      return transformer.handle(body);
    }
    // console.log('no');
  }
  console.log("Transformer: should have never gotten here, no valid transformers found.");
};

/**  ################ RAW LOGGING ########### */

var _rawMapping = function( cb ){

	var template = {
	    "template" : "raw-*",
	    "settings" : {
	        "number_of_shards" : 1,
	        "number_of_replicas": 0
	    },
	    "mappings": {
	        "_default_": {
	            "dynamic_templates": [
	                {
	                    "string_fields": {
	                        "mapping": {
	                            "index": "not_analyzed",
	                            "omit_norms": true,
	                            "type": "string",
	                            "doc_values": true
	                        },
	                        "match_mapping_type": "string",
	                        "match": "*"
	                    }
	                }
	            ]
	        },
	        "raw": {
	            "_all": {
	                "enabled": true
	            },
	            "properties": {
	                "@timestamp": {
	                    "type": "date",
	                    "format": "strict_date_optional_time||epoch_millis"
	                },
	                "body": {
	                	"enabled": false

	                }
	            }
	        }
	    }
	};

	_esClient.indices.putTemplate({
		'create': false,
		'name': 'raw_temp',
		'body': template
	}, cb);
};


// do the work of raw logging all payloads wih natural timestamps
var _rawLogger = function(body, path, cb) {
  var now = new Date();

  var n_body = {}
  n_body['@timestamp'] = now;
  n_body['path'] = path;
  n_body['body'] = JSON.stringify(body);

  var now = new Date();
  var indexName = RAW_INDEX + '-' +  dateFormat(now,"yyyy.mm");
  _esClient.index({
    index: indexName,
    type: RAW_TYPE,
    body: n_body
  }, function(error, res){
    if(error){
      console.log('  raw logging error');
      cb(error, res);
    } else {
      console.log('  raw logging success');
      cb(null, res);
    }
  });
};

/**  ################ METRICS LOGGING ########### */

var _metricMapping = function( cb ){

	var template = {
    "template" : "metric-*",
    "settings" : {
        "number_of_shards" : 1,
        "number_of_replicas": 0
    },
    "mappings": {
        "_default_": {
            "dynamic_templates": [
                {
                    "string_fields": {
                        "mapping": {
                            "index": "not_analyzed",
                            "omit_norms": true,
                            "type": "string",
                            "doc_values": true
                        },
                        "match_mapping_type": "string",
                        "match": "*"
                    }
                }
            ]
        },
        "metric": {
            "_all": {
                "enabled": true
            },
            "properties": {
                "@timestamp": {
                    "type": "date",
                    "format": "strict_date_optional_time||epoch_millis"
                },
                
                "location": {
                    "type": "geo_point"
                }
                
            }
        }
    }
};

	_esClient.indices.putTemplate({
		'create': false,
		'name': 'metric_temp',
		'body': template
	}, cb);
};


var errorGen = function( code, message ){
	var msg = "Error: " + message;
	console.log(msg);
	return { errorCode: code, message: msg };  
};


var _metricLogger = function(body, cb) {

	if(!body) return cb( errorGen(400, "_metricsLogger required body"));

	// required
  var metric_source = body.metric_source || null;
  if( !metric_source ) return cb(errorGen( 400, "_meticsLogger requres metric_source field"));

 
  var metric_channel = body.metric_channel || null;
  if( !metric_channel ) return cb(errorGen( 400, "_meticsLogger requres metric_channel field"));

  // big transform, document may not be modified if any of the specialize transformers pass on it
  var mod_bod = transform(body);
  
  // console.log(mod_bod);
  var timestamp = null;

  var checkTime = mod_bod.ifttt_checkTime || null;
  if( checkTime ) {
    var m = moment(checkTime + _config.ifttt_tz, "MMM DD, YYYY [at] hh:mmA Z");
    if(m.isValid()) {
      timestamp = m.format();
    }
  }

  if( mod_bod.unixtimestamp ) timestamp = mod_bod.unixtimestamp;
  if( mod_bod.iso8601_time) timestamp = mod_bod.iso8601_time;

  if(!timestamp) {
    var ifttt_date = mod_bod.ifttt_date || null;
    if( ifttt_date ){
      var m = moment( ifttt_date + _config.ifttt_tz, "D/M/YYYY Z" );
      if(m.isValid()) {
        timestamp = m.format();
      }
    }

    var fitbit_date = mod_bod.fitbit_date || null;
    if( fitbit_date ){
      var m = moment( fitbit_date + _config.ifttt_tz, "MMM DD, YYYY Z" );
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
  if( !mod_bod.payload ) return cb(errorGen( 400, "_meticsLogger post field payload required after transformation"));
  

  var n_body = {}
  n_body['@timestamp'] = timestamp;
  n_body['source'] = metric_source.toLowerCase();
  n_body['channel'] = metric_channel.toLowerCase();
  if(mod_bod['location'] !== null) n_body['location'] = mod_bod['location'];
  n_body[metric_channel.toLowerCase()] = mod_bod.payload;
  
  var now = new Date();
  var indexName = METRIC_INDEX + '-' + metric_channel.toLowerCase() + '-' + dateFormat(timestamp,"yyyy");
  
  _esClient.index({
    index: indexName,
    type: METRIC_TYPE,
    body: n_body
  }, function(error, res){
    if(!error){
    	console.log('  metric logging success: '+ metric_channel + ' ' + metric_source);
    	return cb(null);
    } else {
    	console.log(error);
    	return cb( errorGen(500, 'metric logging error') );
    }
  });
};


exports.metrics = {
	init: function( esClient , config, cb) {
		_esClient = esClient;
		_config = config;

		// re-apply the mappings on every node reboot
		_rawMapping( function (cb) {
			_metricMapping( cb );
		});

	},
	rawLogger: _rawLogger,
	metricLogger: _metricLogger
}