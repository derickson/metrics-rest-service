exports.config = {
  'ifttt_tz': " -0500",
  'es_host' :   process.env.ES_HOST || "localhost:9201",
  'user': {
    'name': process.env.SERVICE_USERNAME || "foo",
    'pass': process.env.SERVICE_PASSWORD || "bar"
  },
  'untappd': {
        "sleep": 10000,
        "userName": process.env.UNTAPPD_USERNAME || 'xxx',
        "creds": {
            "clientID": process.env.UNTAPPD_CLIENTID || "xxx", // will fail locally
            "clientSecret": process.env.UNTAPPD_CLIENT_SECRET || "xxx" // will fail locally
        }
}