#!/usr/bin/env node
// build.js · 把 ESM 源码打成一个「经典脚本」，让 index.html 双击（file://）也能直接玩
//
// 为什么需要它：
//   浏览器在 file:// 协议下会用 origin 'null' 去 fetch ES module，被 CORS 直接拦掉，
//   于是 game.js 一行都没执行 —— 表现就是「只有菜单外壳，点按钮没反应」。
//   经典脚本（<script src>）不受这条限制，所以把模块按依赖顺序塞进一个 IIFE 即可。
//
// 产物：
//   xiaoyao-bundle.js   经典脚本（index.html 在 file:// 下自动加载）
//   逍遥行.html          单文件版（连 HTML/CSS 一起内联，可直接发给别人）
//
// 用法：node build.js     （改完源码想双击玩时跑一次）

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

// 依赖顺序（拓扑序，改依赖关系要同步改这里）
const ORDER = [
  { id: 'three', file: 'lib/three.module.js' },
  { id: 'pixel', file: 'pixel.js' },
  { id: 'audio', file: 'audio.js' },
  { id: 'art', file: 'art.js' },
  { id: 'monsters', file: 'monsters.js' },
  { id: 'weapons', file: 'weapons.js' },
  { id: 'items', file: 'items.js' },
  { id: 'skills', file: 'skills.js' },
  { id: 'time', file: 'time.js' },
  { id: 'village', file: 'village.js' },
  { id: 'dungeon', file: 'dungeon.js' },
  { id: 'game', file: 'game.js' },
];

function depId(src) {
  const base = path.basename(src).replace(/\.js$/, '');
  return base === 'three.module' ? 'three' : base;
}

// ESM → 纯语句：import 换成解构，export 记录下来并去掉关键字
function transform(src) {
  const out = new Set();

  // import 语句（可能跨多行）
  src = src.replace(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g, (m, spec, from) => {
    const id = depId(from);
    spec = spec.trim();
    const ns = spec.match(/^\*\s+as\s+([\w$]+)$/);
    if (ns) return `const ${ns[1]} = __M.${id};`;
    const inner = spec.replace(/^\{/, '').replace(/\}$/, '');
    const names = inner.split(',').map(s => s.trim()).filter(Boolean)
      .map(s => s.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __M.${id};`;
  });

  // export const/let/var/function/class/async function NAME
  src = src.replace(/^export\s+(const|let|var|function|class|async\s+function)\s+([\w$]+)/gm, (m, kw, name) => {
    out.add(name);
    return `${kw} ${name}`;
  });

  // export { A, B as C };
  src = src.replace(/^export\s*\{([\s\S]*?)\}\s*;?/gm, (m, inner) => {
    inner.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      const seg = s.split(/\s+as\s+/);
      const local = seg[0].trim();
      const exported = (seg[1] || seg[0]).trim();
      out.add(local === exported ? local : `${local}: ${exported}`);
    });
    return '';
  });

  if (/^\s*export\s/m.test(src)) {
    throw new Error('还有未处理的 export 语句：' + (src.match(/^\s*export\s.*$/m) || [''])[0]);
  }
  return { src, exports: [...out] };
}

function buildBundle() {
  const chunks = [];
  chunks.push('/* 逍遥行 · 打包产物（由 build.js 生成，不要直接编辑） */');
  chunks.push('(function () {');
  chunks.push("'use strict';");
  // 双保险：module 版已经在跑就不再初始化第二遍
  chunks.push('if (window.__xiaoyaoBooted) return;');
  chunks.push('window.__xiaoyaoBooted = 1;');
  chunks.push('var __M = {};');

  for (const m of ORDER) {
    const raw = fs.readFileSync(path.join(ROOT, m.file), 'utf8');
    const { src, exports } = transform(raw);
    chunks.push('\n/* ==================== ' + m.file + ' ==================== */');
    chunks.push('__M.' + m.id + ' = (function () {');
    chunks.push(src.replace(/\s+$/, '') + '\n');
    chunks.push('return { ' + exports.join(', ') + ' };');
    chunks.push('})();');
  }

  chunks.push('\n})();');
  return chunks.join('\n');
}

function buildSingle(bundle) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // 注意：替换串必须用函数返回，不能直接传字符串 —— bundle 里含 $&、$' 这类字符，
  // 会被 String.replace 当成替换模式，把打包后的代码搅碎（表现为 SyntaxError）。
  const before = html.length;
  let out = html.replace(/<script id="boot">[\s\S]*?<\/script>/, () => '<script>\n' + bundle + '\n</script>');
  if (out.length === before) throw new Error('没找到 <script id="boot">，单文件版会缺代码');
  // dev/scene 场景钩子靠动态 import，file:// 下必然失败，单文件版直接去掉
  out = out.replace(/\n\s*if \(location\.search\.indexOf\('dev=1'\)[\s\S]*?\n\s*\}/, () => '')
    .replace(/\n\s*if \(location\.search\.indexOf\('scene='\)[\s\S]*?\n\s*\}/, () => '');
  return out;
}

const bundle = buildBundle();
fs.writeFileSync(path.join(ROOT, 'xiaoyao-bundle.js'), bundle, 'utf8');
const kb = (bundle.length / 1024).toFixed(0);
console.log('✓ xiaoyao-bundle.js  ' + kb + ' KB');

const single = buildSingle(bundle);
fs.writeFileSync(path.join(ROOT, '逍遥行.html'), single, 'utf8');
console.log('✓ 逍遥行.html        ' + (single.length / 1024).toFixed(0) + ' KB（双击即玩 / 可直接外发）');
