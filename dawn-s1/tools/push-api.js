// tools/push-api.js · github.com:443 不通时，走 Git Data API 把本地提交推上去
//
// 为什么需要：这个网络里 github.com 的 443 会被干扰（curl 直接 000 / Connection reset），
// 但 api.github.com 是通的。git push 走的是 github.com，于是卡死在这里。
// 之前只能手工敲 blob → tree → commit → ref 四步，还容易把 SHA 搞成两套
// （远端另建一个提交，本地与远端内容一样但 SHA 不同 → 下次 fetch 假分叉）。
//
// 用法：
//   node tools/push-api.js            把 HEAD 推到 origin 的当前分支
//   node tools/push-api.js --dry      只打印要传什么
//
// 关键点：**远端提交要逐字节等于本地提交**。显式传 author / committer
// （名字、邮箱、日期含时区）和原始消息（连尾部换行一起），GitHub 生成出来的
// SHA 才会和本地一致。差一个字节就是一个新提交，本地就得多一次 reset。
const { execFileSync } = require('child_process');

const DRY = process.argv.includes('--dry');
const git = (args, input) => execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 1 << 28 });

const remote = git(['remote', 'get-url', 'origin']).trim();
const m = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/.exec(remote);
if (!m) { console.error('origin 不是 GitHub 仓库：' + remote); process.exit(1); }
const [, OWNER, REPO] = m;
const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;

// 凭据从 git 的 credential helper 取，不落盘、不进命令行
const cred = git(['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
const tok = (cred.split('\n').find(l => l.startsWith('password=')) || '').slice(9).trim();
if (!tok) { console.error('取不到 GitHub 凭据（git credential fill 没返回 password）'); process.exit(1); }

const H = {
  Authorization: 'token ' + tok,
  'User-Agent': 'xiaoyaoxing-push-api',
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github+json',
};
async function api(method, path, body) {
  const r = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : {};
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const headSha = git(['rev-parse', 'HEAD']).trim();
const raw = git(['cat-file', 'commit', 'HEAD']);
const tree = /^tree (\w+)$/m.exec(raw)[1];
const parents = (raw.match(/^parent \w+$/gm) || []).map(l => l.split(' ')[1]);
const message = raw.slice(raw.indexOf('\n\n') + 2);   // 原样，尾部换行也要留

(async () => {
  // 1. 远端现在在哪
  let remoteSha = null;
  try { remoteSha = (await api('GET', '/git/ref/heads/' + branch)).object.sha; } catch (e) { }
  if (remoteSha === headSha) { console.log('远端已经是 ' + headSha.slice(0, 8) + '，不用推'); return; }

  // 2. 远端比本地多出什么（父提交不在远端历史里就没法推）
  if (remoteSha && parents[0] !== remoteSha) {
    const ahead = git(['rev-list', '--count', remoteSha + '..HEAD']).trim();
    console.error('远端 ' + remoteSha.slice(0, 8) + ' 不是本地 HEAD 的父提交（本地领先 ' + ahead + ' 个提交）。');
    console.error('一次只能推一个提交，先把中间那些也推上去，或 rebase 到远端。');
    process.exit(1);
  }

  // 3. 逐文件上传 blob
  const files = git(['diff', '--name-only', parents[0] + '..HEAD']).split('\n').map(s => s.trim()).filter(Boolean);
  console.log('推 ' + headSha.slice(0, 8) + '（' + files.length + ' 个文件）→ ' + OWNER + '/' + REPO + '@' + branch);
  if (DRY) { files.forEach(f => console.log('  ' + f)); return; }

  const entries = [];
  for (const f of files) {
    const buf = execFileSync('git', ['cat-file', 'blob', 'HEAD:' + f], { maxBuffer: 1 << 28 });
    const blob = await api('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    entries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 4. 建树 → 建提交 → 挪 ref
  const baseTree = (await api('GET', '/git/commits/' + parents[0])).tree.sha;
  const newTree = await api('POST', '/git/trees', { base_tree: baseTree, tree: entries });

  // author / committer 必须逐字节还原，否则 SHA 对不上
  const who = /^(author|committer) (.+) <(.+)> (\d+) ([+-]\d{4})$/gm;
  const meta = {};
  let mm;
  while ((mm = who.exec(raw))) {
    const iso = new Date(+mm[4] * 1000).toISOString().replace(/\.\d+Z$/, '');
    // 保留原时区：把 UTC 时间换算回原偏移
    const off = mm[5], sign = off[0] === '-' ? -1 : 1;
    const mins = sign * (parseInt(off.slice(1, 3), 10) * 60 + parseInt(off.slice(3, 5), 10));
    const local = new Date(new Date(iso + 'Z').getTime() + mins * 60000).toISOString().replace(/\.\d+Z$/, '');
    // API 只认 +08:00 这种带冒号的偏移，+0800 会 422
    meta[mm[1]] = { name: mm[2], email: mm[3], date: local + off.slice(0, 3) + ':' + off.slice(3) };
  }

  const commit = await api('POST', '/git/commits', {
    message, tree: newTree.sha, parents,
    author: meta.author, committer: meta.committer,
  });
  await api('PATCH', '/git/refs/heads/' + branch, { sha: commit.sha, force: true });

  if (commit.sha === headSha) {
    console.log('✓ 已推送，SHA 与本地一致（' + headSha.slice(0, 8) + '），不需要再 fetch');
  } else {
    console.log('⚠ 已推送，但远端 SHA 是 ' + commit.sha.slice(0, 8) + '，本地是 ' + headSha.slice(0, 8));
    console.log('  内容一致但提交对象不同，下次联网时 git fetch && git reset --hard origin/' + branch);
  }
})().catch(e => { console.error('失败：' + e.message); process.exit(1); });
