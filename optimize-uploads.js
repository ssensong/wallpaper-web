'use strict';
/**
 * 一键把 uploads 目录中已有的大图压缩到目标体积以内（默认 ≤200KB）。
 * 适用场景：历史遗留大图、或绕过后台上传直接拷贝进 uploads 文件夹的图片。
 * 只处理 JPG / PNG / WEBP；GIF 动图与 SVG 自动跳过。
 * 保持原文件名与格式（同名覆盖写回），不影响 data/wallpapers.json 中的引用。
 *
 * 用法： node optimize-uploads.js     （或 npm run optimize）
 */
const fs = require('fs');
const path = require('path');

const CONFIG = require('./config');
const { PREVIEW_MAX_KB, optimizeExistingFile } = require('./lib/image-opt');

const IMG_RE = /\.(jpe?g|png|webp)$/i;

function kb(n) { return (n / 1024).toFixed(1); }

async function main() {
  const dir = CONFIG.uploadsDir;
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => IMG_RE.test(f));
  } catch (e) {
    console.error('无法读取目录：' + dir);
    process.exit(1);
  }
  console.log('目录：' + dir + '，目标 ≤ ' + PREVIEW_MAX_KB + 'KB');
  console.log('发现位图 ' + files.length + ' 张\n');

  const reports = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (!fs.statSync(full).isFile()) continue;
    const r = await optimizeExistingFile(full);
    reports.push(r);
    if (r.skipped) {
      console.log('[跳过] ' + f + '（' + r.reason + '）');
    } else if (r.ok) {
      console.log('[压缩] ' + f + '：' + kb(r.before) + 'KB -> ' + kb(r.after) + 'KB');
    } else {
      console.log('[未变] ' + f + '：' + kb(r.after) + 'KB（' + r.reason + '）');
    }
  }

  const ok = reports.filter((r) => r.ok).length;
  const skipped = reports.filter((r) => r.skipped).length;
  const fail = reports.filter((r) => !r.ok && !r.skipped);
  console.log('\n================ 汇总 ================');
  console.log('压缩成功 ' + ok + ' | 跳过 ' + skipped + ' | 未能变小 ' + fail.length);
  if (fail.length) {
    console.log('\n以下图片压缩后仍偏大（多为极复杂画面，可接受或人工处理）：');
    fail.forEach((r) => console.log('  - ' + path.basename(r.path) + '  ' + kb(r.after) + 'KB'));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
