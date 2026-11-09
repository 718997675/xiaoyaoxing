// tools/shot.js · 无依赖 CDP 驱动（Node 22 内置 WebSocket）
// 用法: node tools/shot.js "<url>" <outPrefix> [evalFile]
// 输出: <outPrefix>.png, 并打印页面 console/异常 与自定义求值结果

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const url = process.argv[2] || 'http://127.0.0.1:8124/';
const outPrefix = process.argv[3] || 'shot';
const evalFile = process.argv[4];

function get(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ensureChrome() {
  try { await get('/json/version'); return null; } catch (e) { }
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--window-size=1000,620', '--hide-scrollbars',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-first-run', '--no-default-browser-check', '--user-data-dir=/tmp/cdp-xiaoyao',
    'about:blank',
  ], { detached: false, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try { await get('/json/version'); return proc; } catch (e) { }
  }
  throw new Error('chrome 启动失败');
}

(async () => {
  const proc = await ensureChrome();
  const list = JSON.parse(await get('/json/list'));
  let page = list.find(t => t.type === 'page');
  if (!page) throw new Error('没有可用页面');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push('[console.' + msg.params.type + '] ' + msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      logs.push('[EXCEPTION] ' + (d.exception && d.exception.description || d.text));
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push('[log.' + msg.params.entry.level + '] ' + msg.params.entry.text);
    }
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  // 关缓存：复用同一个 Chrome 实例反复测同一条 URL 时，浏览器会拿旧脚本，
  // 让人误以为改动没生效（打包文件尤其容易踩这个坑）
  await send('Network.enable').catch(() => { });
  await send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => { });
  // 视口可用 SHOT_W / SHOT_H 覆盖（模拟手机横屏：SHOT_W=812 SHOT_H=375）
  const VW = +(process.env.SHOT_W || 1000), VH = +(process.env.SHOT_H || 620);
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: +(process.env.SHOT_DPR || 1), mobile: !!process.env.SHOT_MOBILE });
  await send('Page.navigate', { url });
  await sleep(+(process.env.SHOT_WAIT || 2200));

  if (evalFile) {
    const code = fs.readFileSync(evalFile, 'utf8');
    const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) logs.push('[EVAL ERROR] ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    console.log('--- eval result ---');
    console.log(JSON.stringify(r.result && r.result.value, null, 2));
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = path.isAbsolute(outPrefix) ? outPrefix + '.png' : path.join(process.cwd(), outPrefix + '.png');
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('--- screenshot ---');
  console.log(out);
  console.log('--- logs ---');
  console.log(logs.join('\n') || '(none)');
  ws.close();
  if (proc) { /* 保持浏览器，供后续复用 */ }
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
