'use strict';
/**
 * 服务端预览图压缩（落盘前自动压缩，目标 ≤ config.previewMaxKB，默认 200KB）
 *
 * 格式规则：
 *   - JPG                  → 输出 .jpg（JPEG 编码）
 *   - PNG / WEBP（无透明） → 输出 .jpg
 *   - PNG / WEBP（含透明） → 输出 .webp（保留透明且体积小）
 *   - GIF（动图）/ SVG / 无法识别的类型 → 原样保存
 *
 * 压缩策略：先逐档降低画质，仍超过目标体积再等比缩小分辨率，
 * 取“不超过目标体积且观感最好”的一版；极端画面兜底返回体积最小版本。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const CONFIG = require('../config');

const UPLOADS_DIR = CONFIG.uploadsDir;

/** 目标体积（字节），默认 200KB */
const PREVIEW_MAX_KB = Math.max(50, Number(CONFIG.previewMaxKB) || 200);
const PREVIEW_MAX_BYTES = PREVIEW_MAX_KB * 1024;

/** 可重编码位图的 mimetype */
const RASTER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** 重编码会丢失内容的类型 */
const KEEP_MIME = new Set(['image/gif', 'image/svg+xml']);
/** mimetype → 规范扩展名 */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg'
};

/** 由扩展名猜测 mimetype（mimetype 缺失时兜底） */
function mimeFromExt(filePath) {
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml'
  };
  return map[path.extname(filePath || '').toLowerCase()] || '';
}

/** 判断输出格式（PNG/WEBP 无法确认透明时保守保留透明 → webp，避免转 JPEG 变黑） */
function pickOutput(mime, hasAlpha) {
  if (mime === 'image/jpeg') return { mime: 'image/jpeg', ext: '.jpg' };
  return hasAlpha ? { mime: 'image/webp', ext: '.webp' } : { mime: 'image/jpeg', ext: '.jpg' };
}

/** 循环编码：先画质档，再等比缩小分辨率；返回首个达标版本（附体积最小兜底） */
async function shrinkEncode(buffer, outMime) {
  const meta = await sharp(buffer).metadata().catch(() => null);
  const srcW = meta && Number.isFinite(meta.width) ? meta.width : 0;
  // 分辨率可下探到 18%，覆盖极端高频噪点画面也能压进目标
  const scales = [1, 0.86, 0.72, 0.58, 0.45, 0.34, 0.25, 0.18];
  const qualities = [86, 72, 60, 48, 36, 26];
  const encode = outMime === 'image/webp'
    ? (pipe, q) => pipe.webp({ quality: q })
    : (pipe, q) => pipe.jpeg({ quality: q });

  let best = null;
  for (const scale of scales) {
    for (const quality of qualities) {
      let buf;
      try {
        let pipe = sharp(buffer).rotate();
        if (srcW && scale < 1) {
          pipe = pipe.resize({ width: Math.max(1, Math.round(srcW * scale)), withoutEnlargement: true });
        }
        buf = await encode(pipe, quality).toBuffer();
      } catch (e) {
        continue; // 跳过无法编码的组合
      }
      if (!best || buf.length < best.length) best = buf;
      if (buf.length <= PREVIEW_MAX_BYTES) return { buffer: buf, ok: true };
    }
  }
  return { buffer: best, ok: false };
}

/**
 * 处理一份即将落盘的上传文件。
 * @returns {null | {buffer: Buffer, ext: string, changed: boolean}} ext 带点
 */
async function optimizeUpload(file) {
  const src = file && file.buffer;
  if (!src || !src.length) return null;
  const mime = String(file.mimetype || mimeFromExt(file.originalname)).toLowerCase();

  if (!RASTER_MIME.has(mime) && !KEEP_MIME.has(mime)) {
    // 未知类型：保持原样与原始扩展名
    return { buffer: src, ext: path.extname(file.originalname || '') || '.jpg', changed: false };
  }
  if (KEEP_MIME.has(mime) || src.length <= PREVIEW_MAX_BYTES) {
    // GIF / SVG / 已达标：原样（扩展名与 mimetype 对齐）
    return { buffer: src, ext: EXT_BY_MIME[mime] || path.extname(file.originalname || '') || '.bin', changed: false };
  }

  const meta = await sharp(src).metadata().catch(() => null);
  // 元信息读取失败时按“可能有透明”保守处理，避免透明区转 JPEG 后变黑
  const hasAlpha = meta ? Boolean(meta.hasAlpha) : true;
  const out = pickOutput(mime, hasAlpha);
  const { buffer: outBuf, ok } = await shrinkEncode(src, out.mime);
  const finalBuf = ok && outBuf
    ? outBuf
    : (outBuf && outBuf.length < src.length ? outBuf : src);
  return { buffer: finalBuf, ext: out.ext, changed: finalBuf !== src };
}

/** 生成唯一上传文件名 */
function randomName(ext) {
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext;
}

/** 把上传文件压缩后写入 uploads 目录（供上传接口调用） */
async function persistOptimizedUpload(file) {
  const opt = await optimizeUpload(file);
  const name = randomName(opt.ext);
  const absPath = path.join(UPLOADS_DIR, name);
  await fs.promises.writeFile(absPath, opt.buffer); // 写盘失败会向上抛错，接口返回失败
  return {
    webPath: '/uploads/' + name,
    absPath,
    size: opt.buffer.length,
    srcSize: file.buffer.length,
    changed: opt.changed
  };
}

/** 压缩磁盘上的一张位图：保持文件名与格式，同名覆盖写回（供批量脚本使用） */
async function optimizeExistingFile(absPath) {
  const mime = mimeFromExt(absPath);
  const res = { path: absPath, ok: false, skipped: false, before: 0, after: 0, reason: '' };
  if (!mime) { res.reason = '未知格式'; return res; }
  if (KEEP_MIME.has(mime)) { res.skipped = true; res.reason = 'GIF/SVG 不动'; return res; }

  const buf = await fs.promises.readFile(absPath).catch(() => null);
  if (!buf) { res.reason = '读取失败'; return res; }
  res.before = buf.length;
  if (buf.length <= PREVIEW_MAX_BYTES) { res.skipped = true; res.reason = '已达标'; return res; }

  let outBuf = buf;
  if (mime === 'image/png') {
    // PNG：用调色板有损模式尽力压小（扩展名不变，JSON 引用不受影响）
    const meta = await sharp(buf).metadata().catch(() => null);
    const srcW = meta && Number.isFinite(meta.width) ? meta.width : 0;
    for (const scale of [1, 0.85, 0.7, 0.55, 0.4]) {
      try {
        let pipe = sharp(buf).rotate();
        if (srcW && scale < 1) {
          pipe = pipe.resize({ width: Math.max(1, Math.round(srcW * scale)), withoutEnlargement: true });
        }
        const candidate = await pipe.png({ compressionLevel: 9, palette: true, quality: 82, effort: 8 }).toBuffer();
        if (candidate.length < outBuf.length) outBuf = candidate;
        if (candidate.length <= PREVIEW_MAX_BYTES) break;
      } catch (e) { /* 跳过该档 */ }
    }
  } else {
    const targetMime = mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const { buffer, ok } = await shrinkEncode(buf, targetMime);
    if (ok && buffer) outBuf = buffer;
    else if (buffer && buffer.length < buf.length) outBuf = buffer;
  }

  res.after = outBuf.length;
  if (outBuf.length >= buf.length) {
    res.reason = '压缩未能变小';
    return res;
  }
  try {
    await fs.promises.writeFile(absPath, outBuf); // 同名覆盖
    res.ok = true;
  } catch (e) {
    res.reason = '写入失败：' + e.message;
  }
  return res;
}

module.exports = {
  PREVIEW_MAX_KB,
  PREVIEW_MAX_BYTES,
  optimizeUpload,
  persistOptimizedUpload,
  optimizeExistingFile
};
