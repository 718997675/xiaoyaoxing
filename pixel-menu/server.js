const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      fs.writeFileSync(path.join(dir, 'menu-1920x1080.png'), Buffer.from(b, 'base64'));
      res.end('ok');
      console.log('saved menu-1920x1080.png');
    });
    return;
  }
  const f = req.url === '/' ? '/index.html' : req.url;
  try {
    const data = fs.readFileSync(path.join(dir, f));
    res.setHeader('Content-Type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = 404;
    res.end('not found');
  }
}).listen(8123, '127.0.0.1', () => console.log('server up on 8123'));