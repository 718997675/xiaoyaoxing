// tools/play.js · 真人操作模拟：开始游戏 → 按 J 攻击 → T 道行 → Tab 行囊 → 点技能格
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(p) { return new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(b)); }).on('error', rej)); }

(async () => {
  try { await get('/json/version'); } catch (e) {
    spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1000,620',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--no-first-run', '--user-data-dir=/tmp/cdp-xiaoyao2', 'about:blank'], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { await sleep(250); try { await get('/json/version'); break; } catch (e) { } }
  }
  const list = JSON.parse(await get('/json/list'));
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  const send = (m, p) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); return m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8124/' });
  await sleep(2200);

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'ERR ' + JSON.stringify(r.exceptionDetails.text);
    return r.result.value;
  };
  const key = async (code, keyStr, kc) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyStr, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc });
    await sleep(60);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyStr, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc });
    await sleep(120);
  };

  // 开新局（清档）
  await ev("localStorage.clear()");
  await send('Page.reload'); await sleep(1800);
  await ev("document.getElementById('btnNew').click()");
  await sleep(500);

  const out = {};
  out.stateAfterNew = await ev('window.__game.state');
  out.enemies = await ev('window.__game.enemies.length');

  // 走到最近怪身边再按 J
  await ev(`(()=>{const g=window.__game;const e=g.enemies.filter(x=>!x.dead&&x.type!=='boss'&&x.type!=='treant')[0];g.setPos(e.x-16,e.y);g.setDir('right');return e.type;})()`);
  const hpBefore = await ev('(()=>{const g=window.__game;const e=g.enemies.filter(x=>!x.dead&&x.type!=="boss"&&x.type!=="treant")[0];return e.hp;})()');
  out.cds = [];
  // 注意：headless 里页面不可见，requestAnimationFrame 会被节流/暂停，
  // 冷却与输入缓冲都靠 update() 推进，所以这里手动 tick 补帧，
  // 不能只 sleep（否则 atkCd 永远停在 0.30，缓冲永不消费，连按只能命中一次）。
  const adv = frames => ev(`(()=>{const g=window.__game;for(let i=0;i<${frames};i++)g.tick(1/60);return g.player.atkCd.toFixed(2);})()`);
  for (let i = 0; i < 4; i++) {
    await key('KeyJ', 'j', 74);
    await adv(24); // 0.4s >> 攻击间隔 0.30s
    out.cds.push(await ev('window.__game.player.atkCd.toFixed(2) + "/buf" + window.__game.player.atkBuf.toFixed(2) + "/step" + window.__game.player.atkStep + "/combo" + window.__game.combo + "/hp" + Math.round(window.__game.enemies.filter(x=>!x.dead&&x.type!=="boss"&&x.type!=="treant")[0].hp)'));
  }
  await sleep(300);
  const hpAfter = await ev('(()=>{const g=window.__game;const e=g.enemies.filter(x=>!x.dead&&x.type!=="boss"&&x.type!=="treant")[0];return e.hp;})()');
  out.jDamage = [Math.round(hpBefore), Math.round(hpAfter)];
  out.geom = await ev(`(()=>{const g=window.__game;const e=g.enemies.filter(x=>!x.dead&&x.type!=="boss"&&x.type!=="treant")[0];
    return {px:Math.round(g.player.x),py:Math.round(g.player.y),ex:Math.round(e.x),ey:Math.round(e.y),d:Math.round(Math.hypot(e.x-g.player.x,e.y-g.player.y)),dir:g.player.dir,steps:g.player.atkStep,reach:g.WEAPONS.sword.reach};})()`);
  out.combo = await ev('window.__game.combo');
  out.swingFam = await ev('window.__game.player.equip.weapon ? window.__game.player.equip.weapon.fam : "none"');

  // 点击技能栏（第 2 格 = 剑气）
  const rect = await ev(`(()=>{const c=document.getElementById('ov');const r=c.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};})()`);
  const sx = rect.l + rect.w * (192 / 480), sy = rect.t + rect.h * (247 / 270);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx, y: sy, button: 'left', clickCount: 1 });
  await sleep(200);
  out.qiCdAfterClick = await ev('window.__game.skills.qi.cd');

  // T 道行 / Tab 行囊
  await key('KeyT', 't', 84);
  out.skillPanel = await ev("!document.getElementById('skills').classList.contains('hidden')");
  await key('KeyT', 't', 84);
  await key('Tab', 'Tab', 9);
  out.invPanel = await ev("document.getElementById('inv').style.display");
  await key('Tab', 'Tab', 9);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/xy-play.png', Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify(out, null, 2));
  console.log('logs:', logs.length ? logs.join('\n') : '(none)');
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
