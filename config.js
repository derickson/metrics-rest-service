exports.config = {
  'ifttt_tz': " -0500",
  'es_host' :   process.env.ES_HOST || "localhost:9201",
  'user': {
    'name': process.env.SERVICE_USERNAME || "foo",
    'pass': process.env.SERVICE_PASSWORD || "bar"
  }
}