'use strict';
/**
 * 一键导出「纯静态站」到 docs/ 目录
 *
 * 用途：本地后台（npm start）里增删改壁纸之后，运行本脚本把最新内容
 * 生成为一份不依赖任何后端接口的静态站点，随仓库推送到 GitHub Pages 即可上线。
 *
 * 产物结构（docs/）：
 *   index.html / css / js / video   ← 前台静态资源（后台管理页不进入公开站）
 *   data.json                       ← 壁纸数据（供前台 fallback 读取）
 *   uploads/*.jpg|webp|logo.png     ← 预览图副本（image 一律相对路径）
 *   .nojekyll                       ← 让 GitHub Pages 跳过 Jekyll 处理
 *
 * 使用：
 *   npm run build     生成 docs/
 *   npm run preview   本地预览 http://localhost:4000
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const DATA_FILE = path.join(ROOT, 'data', 'wallpapers.json');
const OUT_DIR = path.join(ROOT, 'docs');

// 后台管理文件只在本地 Node 后台使用，不发布到公开静态站
const EXCLUDE = new Set(['admin.html', 'admin.css', 'admin.js']);
// 页面 <img> 直接引用的品牌图（uploads/logo.png），需要随站复制
const EXTRA_UPLOADS = ['logo.png'];

function bytesText(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(2) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

function copyDirTree(src, dst, exclude) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.has(ent.name)) continue;
    const from = path.join(src, ent.name);
    const to = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirTree(from, to, exclude);
    else fs.copyFileSync(from, to);
  }
}

/**
 * 给 docs/index.html 里的 css/js 引用加上内容指纹（?v=xxxx）
 *
 * 为什么需要：静态资源会被 Cloudflare 和浏览器缓存，推送到 GitHub Pages 后
 * 用户可能十几分钟内仍看到旧样式。加上内容指纹后每次构建的 URL 都不同，
 * CDN 与浏览器都会当成新文件去源站拉取，免去手动「清除缓存」。
 * 只改 docs/ 里的产物，源文件 public/index.html 保持干净。
 */
/**
 * 给 docs/js/app.js 里对 data.json 的引用加上内容指纹
 *
 * 为什么需要：壁纸数据是 fetch 出来的，浏览器与 CDN 会缓存它，
 * 导致上传新壁纸并推送后，用户十几分钟内还看到旧列表。
 * 加上 ?v=内容哈希后，数据一变 URL 就变，立即生效。
 * 注意：必须在 stampAssetUrls() 之前执行，让 app.js 的新内容参与自身哈希。
 */
function stampDataJson() {
  const appFile = path.join(OUT_DIR, 'js', 'app.js');
  const dataFile = path.join(OUT_DIR, 'data.json');
  if (!fs.existsSync(appFile) || !fs.existsSync(dataFile)) return null;

  const h = crypto.createHash('md5').update(fs.readFileSync(dataFile)).digest('hex').slice(0, 8);
  let js = fs.readFileSync(appFile, 'utf8');
  js = js.replace(/(fetchDataFrom\('data\.json)(\?v=[0-9a-f]+)?('\))/g, '$1?v=' + h + '$3');
  fs.writeFileSync(appFile, js, 'utf8');
  return 'data.json?v=' + h;
}

function stampAssetUrls() {
  const file = path.join(OUT_DIR, 'index.html');
  if (!fs.existsSync(file)) return [];

  const hashOf = (rel) => {
    const abs = path.join(OUT_DIR, rel);
    if (!fs.existsSync(abs)) return '';
    return crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
  };

  let html = fs.readFileSync(file, 'utf8');
  const stamped = [];
  ['css/style.css', 'js/i18n.js', 'js/app.js'].forEach((rel) => {
    const h = hashOf(rel);
    if (!h) return;
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped + '(\\?v=[0-9a-f]+)?', 'g');
    html = html.replace(re, rel + '?v=' + h);
    stamped.push(rel + '?v=' + h);
  });
  fs.writeFileSync(file, html, 'utf8');
  return stamped;
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('[build] 未找到 data/wallpapers.json，请先本地运行过服务（npm start）以生成数据。');
    process.exit(1);
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error('[build] 未找到 uploads/ 目录。');
    process.exit(1);
  }

  // 1) 清空并重建 docs/
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 2) 复制前台静态资源（排除后台文件）
  copyDirTree(PUBLIC_DIR, OUT_DIR, EXCLUDE);

  // 3) 排序：与后台 /api/wallpapers 保持一致 —— 按日期倒序（最新在前），
  //    同一天按 id 倒序（后添加的在前）。保证静态站与本地后台展示顺序一致。
  const rawList = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  rawList.sort((a, b) => {
    const d = String(b.date || '').localeCompare(String(a.date || ''));
    return d !== 0 ? d : (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  // 把每条壁纸的 image 由 /uploads/xxx 改为相对路径 uploads/xxx
  //    （GitHub Pages 站点在 用户名.github.io/仓库名/ 子路径下也能正确加载）
  const used = new Set();
  const warnings = [];
  const wallpapers = rawList.map((w) => {
    const item = { ...w };
    const img = typeof w.image === 'string' ? w.image.trim() : '';
    if (img.startsWith('/uploads/')) {
      const rel = img.slice('/uploads/'.length);
      const abs = path.join(UPLOADS_DIR, rel);
      if (rel && fs.existsSync(abs)) {
        item.image = 'uploads/' + rel;
        used.add(rel);
      } else {
        warnings.push(`「${w.title}」引用的图片文件不存在：${img}`);
        item.image = '';
      }
    }
    // 以 http(s):// 开头的外链或其它地址保持原样
    return item;
  });

  // 4) 复制壁纸用到的图片副本 + 品牌图 logo.png
  const uploadDst = path.join(OUT_DIR, 'uploads');
  fs.mkdirSync(uploadDst, { recursive: true });
  let imgCount = 0;
  let imgBytes = 0;
  const copyInto = (rel, tag) => {
    const srcAbs = path.join(UPLOADS_DIR, rel);
    if (!fs.existsSync(srcAbs)) { warnings.push(`${tag}不存在：uploads/${rel}`); return; }
    fs.copyFileSync(srcAbs, path.join(uploadDst, rel));
    imgCount++;
    imgBytes += fs.statSync(srcAbs).size;
  };
  used.forEach((rel) => copyInto(rel, '壁纸图片'));
  EXTRA_UPLOADS.forEach((rel) => copyInto(rel, '品牌图'));

  // 5) 写静态数据 data.json + 空 .nojekyll + 自定义域名 CNAME
  const outData = {
    generatedAt: new Date().toISOString(),
    count: wallpapers.length,
    wallpapers
  };
  fs.writeFileSync(path.join(OUT_DIR, 'data.json'), JSON.stringify(outData, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '', 'utf8');
  // GitHub Pages 绑定自定义域名时，要求发布源根目录存在 CNAME 文件；
  // 由构建脚本自动写入，避免每次重建 docs/ 后域名绑定失效。
  const customDomain = process.env.CUSTOM_DOMAIN || 'ranmoku.top';
  if (customDomain) {
    fs.writeFileSync(path.join(OUT_DIR, 'CNAME'), customDomain + '\n', 'utf8');
  }

  // 5.4) 壁纸数据缓存击穿：先给 app.js 里对 data.json 的引用加内容指纹
  const dataStamp = stampDataJson();

  // 5.5) 静态资源加内容指纹：
  //      css/js 引用带上 ?v=内容哈希，避免 Cloudflare / 浏览器缓存
  //      导致推送上线后用户十几分钟内还看到旧样式
  const stamped = stampAssetUrls();

  // 6) 汇总输出
  let totalBytes = 0;
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else totalBytes += fs.statSync(full).size;
    }
  })(OUT_DIR);

  warnings.forEach((msg) => console.log('[build] ⚠', msg));

  console.log('[build] 完成：静态站已生成到 docs/');
  console.log(`  壁纸 ${wallpapers.length} 条，图片 ${imgCount} 张（${bytesText(imgBytes)}）`);
  console.log(`  全站总大小约 ${bytesText(totalBytes)}`);
  if (dataStamp) console.log('  数据指纹: ' + dataStamp);
  stamped.forEach((s) => console.log('  资源指纹: ' + s));
  console.log('  本地预览: npm run preview  →  http://localhost:4000');
  console.log('  发布: 将 docs/ 随仓库推送 GitHub，Pages 选择 “Deploy from a branch”，目录填 /docs');
}

main();
