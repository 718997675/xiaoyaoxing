// tools/run.js · 无头浏览器跑页面脚本
//
// 用法：
//   node tools/run.js devtest            跑 devtest.js 的全量断言，打印 #devout
//   node tools/run.js eval tools/weapons.js   在页面里执行某个 IIFE 片段并打印返回值
//   node tools/run.js shot out.png 1280 720   截图
//
// 为什么要自建 http server：nohup 起的静态服务会随 shell 退出被回收，
// 脚本自己 listen 才不会被半路掐掉。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_BIN ||
  'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe';
const PORT = 8137 + (process.pid % 200);
const DBG = 9400 + (process.pid % 200);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.svg': 'image/svg+xml',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? '/index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404); return res.end('nope');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      return;
    }
    events.push(m);
  };
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  return { send, events, close: () => ws.close() };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error('超时：' + label);
    await sleep(150);
  }
}

(async () => {
  const mode = process.argv[2] || 'devtest';
  const srv = await serve();
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu-sandbox', '--no-sandbox', '--no-first-run',
    '--no-proxy-server', '--proxy-bypass-list=*',
    '--remote-debugging-port=' + DBG,
    '--user-data-dir=' + path.join(require('os').tmpdir(), 'cdp-run-' + process.pid),
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });

  let api;
  try {
    const list = await waitFor(async () => {
      try {
        const r = await fetch('http://127.0.0.1:' + DBG + '/json/list');
        const j = await r.json();
        const p = j.find(t => t.type === 'page');
        return p ? p.webSocketDebuggerUrl : null;
      } catch { return null; }
    }, 15000, '等 Chrome 起来');

    api = await cdp(list);
    await api.send('Page.enable');
    await api.send('Runtime.enable');
    const logs = [];
    const drainLogs = () => {
      for (const m of api.events.splice(0)) {
        if (m.method === 'Runtime.exceptionThrown') {
          logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
          logs.push('console.error ' + m.params.args.map(a => a.value ?? a.description).join(' '));
        }
      }
    };

    const url = 'http://127.0.0.1:' + PORT + '/index.html?' + (process.env.QS || 'dev=1');
    await api.send('Page.navigate', { url });
    await sleep(500);
    await waitFor(() => api.send('Runtime.evaluate', { expression: '!!window.__game', returnByValue: true })
      .then(r => r.result.value).catch(() => false), 25000, '等 __game 就绪');

    if (mode === 'devtest') {
      const out = await waitFor(async () => {
        const r = await api.send('Runtime.evaluate', {
          expression: `(() => { const b = document.getElementById('devout'); return b ? b.innerText : ''; })()`,
          returnByValue: true,
        });
        return r.result.value && r.result.value.length > 40 ? r.result.value : null;
      }, 60000, '等 devtest 出结果');
      console.log(out);
    } else if (mode === 'eval') {
      const file = process.argv[3];
      const code = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
      const r = await api.send('Runtime.evaluate', {
        expression: code, returnByValue: true, awaitPromise: true,
      });
      const v = r.result.value;
      if (v && v.checks) console.log(v.checks.join('\n') + '\nok=' + v.ok);
      else console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    } else if (mode === 'shot') {
      const out = process.argv[3] || 'shot.png';
      const w = +(process.argv[4] || 1440), h = +(process.argv[5] || 900);
      await api.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      // POS=x,y 可以先把角色挪到指定位置再截，省得为了看一眼营地专门写个 scene 模式
      // SETUP="..." 在 POS 之后、截图之前跑一段页面代码 —— 想拍"招式正在放"的瞬间
      // 只能靠它（毒雾只亮三秒，手速跟不上）。
      if (process.env.POS || process.env.SETUP) {
        const [px, py] = (process.env.POS || '').split(',').map(Number);
        const clk = process.env.CLOCK ? `g.setClock(${process.env.CLOCK},3);` : '';
        const pos = process.env.POS ? `g.setPos(${px},${py});` : '';
        const setup = process.env.SETUP ? ';' + process.env.SETUP : '';
        await api.send('Runtime.evaluate', {
          expression: `(()=>{const g=window.__game;g.startGame(false);${clk}${pos}`
            + `for(let i=0;i<30;i++)g.tick(0.016);${setup};return 1})()`,
          returnByValue: true,
        });
      }
      await sleep(700);
      const r = await api.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.resolve(ROOT, out), Buffer.from(r.data, 'base64'));
      console.log('saved ' + out);
    } else if (mode === 'expr') {
      const r = await api.send('Runtime.evaluate', {
        expression: process.argv[3], returnByValue: true, awaitPromise: true,
      });
      console.log(JSON.stringify(r.result.value, null, 2));
    }
    drainLogs();
    if (logs.length) console.log('\n--- 页面报错 ---\n' + logs.join('\n'));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    if (api) api.close();
    chrome.kill();
    srv.close();
  }
})();
