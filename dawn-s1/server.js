const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dir = __dirname;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      fs.writeFileSync(path.join(dir, 'screenshot.png'), Buffer.from(b, 'base64'));
      res.end('ok');
    });
    return;
  }
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const f = pathname === '/' ? '/index.html' : pathname;
  try {
    const data = fs.readFileSync(path.join(dir, f));
    res.setHeader('Content-Type', mime[path.extname(f)] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = 404; res.end('not found');
  }
}).listen(8124, '0.0.0.0', () => {
  console.log('dawn-s1 server up on 8124');
  console.log('  本机: http://127.0.0.1:8124/');
  // 监听 0.0.0.0 是为了用手机在同一局域网里直接测（虚拟摇杆只在触屏设备上自动出现）
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) console.log('  手机: http://' + n.address + ':8124/');
    }
  }
});