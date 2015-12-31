var dateFormat = require('dateformat');

exports.eslog = {
  'log' : function(client, request, message) {
    
    var now = new Date();
    console.log(dateFormat(now,'yyyy-mm-dd HH:MM:SS') +": "+ message);
    
    var indexName = 'logstash-' +  dateFormat(now,"yyyy.mm.dd");
    client.index({
        index: indexName,
        type: 'logs',
        body: {
          '@timestamp': now,
          'message': message, 
          'hostname': request.hostname,
          'ip': request.ip,
          'originalUrl': request.originalUrl,
          'path': request.path,
          'protocol': request.protocol
        }
      });
  }
}