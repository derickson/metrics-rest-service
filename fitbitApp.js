
var Fitbit  = require( 'fitbit-oauth2' );

var config = {
        "timeout": 10000,
        "creds": {
            "clientID": "227HX7",
            "clientSecret": "a5b9a3db6338e111d9f1eb6d96bcc89c"
        },
        "uris": {
            "authorizationUri": "https://www.fitbit.com",
            "authorizationPath": "/oauth2/authorize",
            "tokenUri": "https://api.fitbit.com",
            "tokenPath": "/oauth2/token"
        },
        "authorization_uri": {
            "redirect_uri": "https://azathought-metrics.herokuapp.com/fitbit_auth_callback",
            "response_type": "code",
            "scope": "activity nutrition profile settings sleep social weight heartrate",
            "state": "3(#0/!~"
        }
    };

var expressApp = null;
var esClient = null;

var esIndexName = "fitbit_token_store";
var esTypeName = "tokens";


var tfile = 'fb-token.json';
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

var _init = function( app, client ) {
	expressApp = app;
	esClient = client;


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
	    console.log("entering callback");
	    var code = req.query.code;
	    console.log("the code was: " + code);
	    fitbit.fetchToken( code, function( err, token ) {
	        if ( err ) return next( err );
			console.log("fetch token happened now I have  token to persist");
	        // persist the token
	        esPersist.write( tfile, token, function( err ) {
	            if ( err ) return next( err );

	            console.log("persist probably succeeded, redirecting to profile");
	            res.redirect( '/fb-profile' );
	        });
	    });
	});

	// Call an API.  fitbit.request() mimics nodejs request() library, automatically
	// adding the required oauth2 headers.  The callback is a bit different, called
	// with ( err, body, token ).  If token is non-null, this means a refresh has happened
	// and you should persist the new token.
	//
	app.get( '/fb-profile', function( req, res, next ) {
		console.log("entering fb-profile");
	    fitbit.request({
	        uri: "https://api.fitbit.com/1/user/-/profile.json",
	        method: 'GET',
	    }, function( err, body, token ) {
	        if ( err ) return next( err );
	        var profile = JSON.parse( body );
	        // if token is not null, a refesh has happened and we need to persist the new token
	        if ( token )
	            esPersist.write( tfile, token, function( err ) {
	                if ( err ) return next( err );
	                    res.send( '<pre>' + JSON.stringify( profile, null, 2 ) + '</pre>' );
	            });
	        else
	            res.send( '<pre>' + JSON.stringify( profile, null, 2 ) + '</pre>' );
	    });
	});

};

exports.app = {
	init : _init
};