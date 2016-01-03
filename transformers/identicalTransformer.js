//identicalTransformer.js  basically a pass through

exports.transformer = {
	'name': 'identical',
	'isForMe' : function ( body ){
		return !( !body || !body.metric_source || !body.metric_channel);
	},
	'handle' : function( body ){
		return body;
	}
}

