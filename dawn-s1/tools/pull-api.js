// tools/pull-api.js · github.com:443 不通时，走 Git Data API 把远端提交「拉」下来
//
// push-api.js 解决的是推，这个解决的是拉。git fetch 走 github.com 被干扰时
// （典型报错 `expected flush after ref listing` / `CONNECT tunnel failed 502`），
// api.github.com 仍然是通的，于是用 API 把缺失的 blob / tree / commit 逐个写进
// 本地对象库，再 fast-forward 到远端 SHA。
//
// 为什么不用「下载 tarball 覆盖工作区」：那样 git 里没有远端那几个提交对象，
// 下次 commit 的 parent 就断了，历史会被压成一个大提交，还会跟远端分叉。
// 这里逐字节重建，SHA 与远端完全一致，git log / diff / blame 都能用。
//
// 用法：
//   node tools/pull-api.js           拉到远端当前分支，并 fast-forward 工作区
//   node tools/pull-api.js --dry     只看差几个提交、要下载多少 blob
//
// 只处理 fast-forward。本地若有未提交改动或跟远端分叉，会拒绝执行。
const { execFileSync } = require('child_process');

const DRY = process.argv.includes('--dry');
const git = (args, input) => execFileSync('git', args, { encoding: input && !Buffer.isBuffer(input) ? 'utf8' : undefined, input, maxBuffer: 1 << 28 });
const gitText = (args, input) => execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 1 << 28 });

const remote = gitText(['remote', 'get-url', 'origin']).trim();
const m = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(remote);
if (!m) { console.error('origin 不是 GitHub 仓库：' + remote); process.exit(1); }
const [, OWNER, REPO] = m;
const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;

const cred = gitText(['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
const tok = (cred.split('\n').find(l => l.startsWith('password=')) || '').slice(9).trim();
if (!tok) { console.error('取不到 GitHub 凭据（git credential fill 没返回 password）'); process.exit(1); }

const H = {
  Authorization: 'token ' + tok,
  'User-Agent': 'xiaoyaoxing-pull-api',
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github+json',
};
async function api(method, path, body) {
  const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : {};
}

const has = sha => {
  try { execFileSync('git', ['cat-file', '-e', sha + '^{object}'], { stdio: 'ignore' }); return true; }
  catch (e) { return false; }
};
const branch = gitText(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const head = gitText(['rev-parse', 'HEAD']).trim();

let blobs = 0, trees = 0;
const seen = new Set();

// 把一棵远端 tree 完整搬到本地：缺的 blob 下载，子 tree 递归，最后 mktree 拼回来
async function ensureTree(sha) {
  if (has(sha) || seen.has(sha)) return;
  seen.add(sha);
  const t = await api('GET', '/git/trees/' + sha);
  if (t.truncated) throw new Error('tree 被截断，这工具只处理普通仓库：' + sha);
  const lines = [];
  for (const e of t.tree) {
    if (e.type === 'blob') {
      if (!has(e.sha)) {
        if (DRY) { blobs++; lines.push(e.mode + ' blob ' + e.sha + '\t' + e.path); continue; }
        const b = await api('GET', '/git/blobs/' + e.sha);
        if (b.encoding !== 'base64') throw new Error('未知 blob 编码：' + b.encoding);
        const buf = Buffer.from(b.content, 'base64');
        const got = gitText(['hash-object', '-w', '--stdin'], buf).trim();
        if (got !== e.sha) throw new Error('blob SHA 不符：' + e.path + ' ' + got + ' ≠ ' + e.sha);
        blobs++;
      }
    } else if (e.type === 'tree') {
      await ensureTree(e.sha);
    }
    // type === 'commit' 是 submodule，本地没有那个对象也无所谓，mktree --missing 放行
    lines.push(e.mode + ' ' + e.type + ' ' + e.sha + '\t' + e.path);
  }
  if (DRY) return;
  const got = gitText(['mktree', '--missing'], lines.join('\n') + '\n').trim();
  if (got !== sha) throw new Error('tree SHA 不符：' + got + ' ≠ ' + sha + '\n' + lines.join('\n').slice(0, 500));
  trees++;
}

// 把 ISO 时间还原成 git raw 里的「unix 秒 + 时区」。
// 坑：API 把 date 统一返回成 UTC（`2026-11-10T13:36:05Z`），但原始提交对象里
// 写的是 `+0800` —— 时区字符串本身参与 SHA，用 +0000 重建出来是另一个提交。
// 所以时区不能从 API 推断，只能连同消息尾部换行一起「试」，用 SHA 反推原始字节。
function ident(w, tz) {
  const ts = Math.floor(Date.parse(w.date) / 1000);
  return w.name + ' <' + w.email + '> ' + ts + ' ' + tz;
}

const TZ_TRIES = ['+0800', '+0000', '-0000', '+0900', '+0100', '-0500', '-0800'];

async function rebuildCommit(sha) {
  if (has(sha)) return;
  const c = await api('GET', '/git/commits/' + sha);
  await ensureTree(c.tree.sha);
  if (DRY) return;
  const head0 = 'tree ' + c.tree.sha + '\n' + c.parents.map(p => 'parent ' + p.sha + '\n').join('');
  // 消息尾部换行也是提交对象的一部分，差一个字节 SHA 就整个换掉；
  // API 有时返回带 \n、有时不带（observed：这批提交返回的是不带）
  const base = c.message.replace(/\n+$/, '');
  const msgs = [base + '\n', c.message, base, base + '\n\n'];
  for (const tz of TZ_TRIES) {
    const heads = head0 + 'author ' + ident(c.author, tz) + '\n' + 'committer ' + ident(c.committer, tz) + '\n';
    for (const msg of msgs) {
      const raw = heads + '\n' + msg;
      const got = gitText(['hash-object', '-t', 'commit', '--stdin'], raw).trim();
      if (got === sha) {
        gitText(['hash-object', '-t', 'commit', '-w', '--stdin'], raw);
        return;
      }
    }
  }
  throw new Error('重建提交 ' + sha + ' 失败：SHA 对不上（可能有签名头，或时区/消息被改写）\n' + head0 + '\n' + JSON.stringify(c.message.slice(-40)));
}

(async () => {
  // 未跟踪文件（?? ）不影响 fast-forward —— reset --hard 不会碰它们，这个工具自己就是新文件
  const dirty = gitText(['status', '--porcelain']).split('\n').filter(l => l.trim() && !l.startsWith('?? ')).join('\n');
  if (dirty) { console.error('工作区有未提交改动，先处理：\n' + dirty.split('\n').slice(0, 8).join('\n')); process.exit(1); }

  const remoteSha = (await api('GET', '/git/ref/heads/' + branch)).object.sha;
  if (remoteSha === head) { console.log('本地已是最新 ' + head.slice(0, 8)); return; }
  if (has(remoteSha)) {
    console.log('远端提交对象已在本地，直接 fast-forward');
  } else {
    // 沿父链往回找，直到撞上本地已有的提交
    const chain = [];
    let cur = remoteSha, guard = 0;
    while (cur && !has(cur) && guard++ < 200) {
      const c = await api('GET', '/git/commits/' + cur);
      chain.push(cur);
      cur = (c.parents[0] || {}).sha;
    }
    if (!cur || !has(cur)) { console.error('找不到本地共有的祖先，可能分叉了，需要人工处理'); process.exit(1); }
    if (cur !== head) { console.error('本地 HEAD ' + head.slice(0, 8) + ' 不是远端历史的祖先（共同祖先 ' + cur.slice(0, 8) + '），拒绝覆盖'); process.exit(1); }
    console.log('远端领先 ' + chain.length + ' 个提交，从 ' + cur.slice(0, 8) + ' 开始重建');
    for (const sha of chain.reverse()) {
      if (!DRY) process.stdout.write('  ' + sha.slice(0, 8) + ' ');
      await rebuildCommit(sha);
      if (!DRY) {
        const msg = JSON.parse((await fetch(API + '/git/commits/' + sha, { headers: H }).then(r => r.text()))).message.split('\n')[0];
        console.log(msg.slice(0, 62));
      }
    }
    console.log((DRY ? '预计下载 ' : '已写入 ') + blobs + ' 个 blob、' + trees + ' 个 tree');
    if (DRY) return;
  }

  // 对象齐了，再挪引用与工作区
  gitText(['update-ref', 'refs/heads/' + branch, remoteSha, head]);
  try { gitText(['update-ref', 'refs/remotes/origin/' + branch, remoteSha]); } catch (e) { }
  gitText(['reset', '--hard', remoteSha]);
  console.log('✓ fast-forward 到 ' + remoteSha.slice(0, 8) + '，' + gitText(['status', '-sb']).split('\n')[0]);
})().catch(e => { console.error('失败：' + e.message); process.exit(1); });
