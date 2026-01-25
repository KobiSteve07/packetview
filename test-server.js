const server = require('http').createServer();

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(3001, () => {
  console.log('Test server listening on 3001');
});

server.on('request', (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});