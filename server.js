/**
 * 个人壁纸网站 - 后端主入口（Node.js + Express）
 *
 * 功能概览：
 *   1. 前台公开接口：读取壁纸列表（供壁纸页与教程页使用）
 *   2. 管理后台接口：登录校验后，可增 / 改 / 删壁纸
 *   3. 图片上传：自动保存到 uploads 文件夹
 *   4. 数据存储：纯 JSON 文件（data/wallpapers.json），无需数据库
 *   5. 静态托管：前台页面（public）与上传图片（uploads）
 *
 * 本地运行：npm install  之后  npm start
 * 访问：    前台 http://localhost:3000    后台 http://localhost:3000/admin
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const CONFIG = require('./config');
const { persistOptimizedUpload } = require('./lib/image-opt');

/* =========================================================
 * 0. 常量与工具
 * =======================================================*/
const ROOT = __dirname; // 项目根目录
const DATA_DIR = path.dirname(CONFIG.dataFile); // data 目录
const PUBLIC_DIR = path.join(ROOT, 'public'); // 前台静态文件
const UPLOAD_DIR = CONFIG.uploadsDir; // 上传目录

// 确保 data / uploads 目录存在（不存在则自动创建）
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * 读取壁纸数据文件。
 * 文件不存在时：用 config.js 中的示例数据初始化一份（仅首次）。
 */
function loadWallpapers() {
  try {
    if (!fs.existsSync(CONFIG.dataFile)) {
      const seed = CONFIG.seedWallpapers || [];
      fs.writeFileSync(CONFIG.dataFile, JSON.stringify(seed, null, 2), 'utf8');
      return seed.slice();
    }
    const raw = fs.readFileSync(CONFIG.dataFile, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    // 文件损坏时兜底为空数组，避免服务崩溃
    console.error('[数据读取失败]', err.message);
    return [];
  }
}

/**
 * 保存壁纸数据到 JSON 文件（每次增删改后调用）
 */
async function saveWallpapers(list) {
  const tmp = CONFIG.dataFile + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.promises.rename(tmp, CONFIG.dataFile);
}

/** 生成下一个自增 id */
function nextId(list) {
  return list.reduce((max, w) => Math.max(max, Number(w.id) || 0), 0) + 1;
}

/** 内存中的壁纸列表（服务启动后维护） */
let wallpapers = loadWallpapers();

/* =========================================================
 * 1. 登录会话（简单内存 Token，不依赖数据库）
 * =======================================================*/
const sessions = new Map(); // token -> 过期时间戳

/** 校验是否已登录（读取 httpOnly Cookie 中的 token） */
function isAuthed(req) {
  const token = req.cookies[CONFIG.cookieName];
  if (!token) return false;
  const expire = sessions.get(token);
  if (!expire) return false;
  if (Date.now() > expire) {
    sessions.delete(token); // 会话过期，顺手清理
    return false;
  }
  return true;
}

/** Express 中间件：要求管理员登录，否则返回 401 */
function requireAdmin(req, res, next) {
  if (!isAuthed(req)) {
    return res.status(401).json({ error: '未登录或会话已过期，请重新登录' });
  }
  next();
}

/* =========================================================
 * 2. 创建 Express 应用
 * =======================================================*/
const app = express();

// 跨域支持：允许任意来源带凭据访问（同源访问不受影响）
app.use(cors({ origin: true, credentials: true }));
app.disable('x-powered-by'); // 隐藏框架标识

// 解析 JSON 请求体（登录接口用）与 Cookie
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/* ---------------------------------------------------------
 * 图片上传配置（multer）
 * -------------------------------------------------------*/
const upload = multer({
  // 先接收进内存，由服务端压缩到 previewMaxKB 内后统一落盘（省存储）
  storage: multer.memoryStorage(),
  // 只允许常见图片类型，防止上传其它文件
  fileFilter(req, file, cb) {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('只允许上传 JPG / PNG / WEBP / GIF / SVG 图片'));
  },
  limits: { fileSize: CONFIG.maxUploadMB * 1024 * 1024 } // 大小限制
});

/* =========================================================
 * 3. 前台公开接口（无需登录）
 * =======================================================*/

/**
 * 获取全部壁纸（前台页面）
 * 返回按发布日期倒序排列的列表，并附带去重后的标签集合
 */
app.get('/api/wallpapers', (req, res) => {
  // 禁止缓存：保证每次进入页面都拿到最新数据（后台新增/修改后立即可见）
  res.set('Cache-Control', 'no-store');
  const sorted = wallpapers.slice().sort((a, b) => {
    const d = String(b.date || '').localeCompare(String(a.date || ''));
    return d !== 0 ? d : (Number(b.id) || 0) - (Number(a.id) || 0);
  });
  // 统计标签（出现次数多的排前面），供前端标签栏使用
  const tagMap = {};
  sorted.forEach((w) => (w.tags || []).forEach((t) => { tagMap[t] = (tagMap[t] || 0) + 1; }));
  const tags = Object.keys(tagMap).sort((x, y) => tagMap[y] - tagMap[x] || x.localeCompare(y, 'zh'));
  res.json({ ok: true, wallpapers: sorted, tags });
});

/* =========================================================
 * 4. 管理后台接口（均需登录）
 * =======================================================*/

/**
 * POST /api/admin/login  管理员登录
 * 校验密码通过后，种下一个 httpOnly Cookie
 */
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== CONFIG.adminPassword) {
    return res.status(401).json({ error: '密码错误，请重试' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + CONFIG.sessionMaxAgeMs);
  // httpOnly：前端 JS 无法读取，防 XSS 窃取；过期时间与会话一致
  res.cookie(CONFIG.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: CONFIG.sessionMaxAgeMs,
    path: '/'
  });
  res.json({ ok: true });
});

/** POST /api/admin/logout  退出登录 */
app.post('/api/admin/logout', (req, res) => {
  const token = req.cookies[CONFIG.cookieName];
  if (token) sessions.delete(token);
  res.clearCookie(CONFIG.cookieName, { path: '/' });
  res.json({ ok: true });
});

/** GET /api/admin/me  判断当前是否已登录（供后台页面初始化判断） */
app.get('/api/admin/me', (req, res) => {
  res.json({ ok: isAuthed(req) });
});

/** GET /api/admin/wallpapers  获取壁纸列表（后台管理） */
app.get('/api/admin/wallpapers', requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, wallpapers: wallpapers.slice().sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)) });
});

/**
 * POST /api/admin/wallpapers  新增壁纸（multipart/form-data）
 * 字段：title 名称 | tags 标签(逗号分隔) | date 日期 | panUrl 网盘链接 | image 图片文件(可选但建议)
 */
app.post('/api/admin/wallpapers', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: '壁纸名称不能为空' });
    }
    // 服务端压缩（≤previewMaxKB）后再落盘，减少存储占用
    let image = '';
    if (req.file) {
      const saved = await persistOptimizedUpload({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
      });
      image = saved.webPath;
    }
    const item = {
      id: nextId(wallpapers),
      title,
      tags: parseTags(req.body.tags),
      date: String(req.body.date || todayStr()),
      panUrl: String(req.body.panUrl || '').trim(),
      image
    };
    wallpapers.push(item);
    await saveWallpapers(wallpapers);
    res.json({ ok: true, wallpaper: item });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/wallpapers/:id  编辑壁纸（可整体修改，也可只改部分字段）
 * 图片字段留空且未选择新文件 = 保持原图
 */
app.put('/api/admin/wallpapers/:id', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const idx = wallpapers.findIndex((w) => Number(w.id) === id);
    if (idx === -1) {
      return res.status(404).json({ error: '未找到该壁纸' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: '壁纸名称不能为空' });
    }

    const old = wallpapers[idx];
    // 若上传了新的预览图：先压缩写盘新文件，成功后再删除旧文件（失败不丢原图）
    if (req.file) {
      const saved = await persistOptimizedUpload({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname
      });
      const oldFile = fromWebPath(old.image);
      if (oldFile && fs.existsSync(oldFile) && oldFile !== saved.absPath) {
        try { fs.unlinkSync(oldFile); } catch (e) { /* 忽略清理失败 */ }
      }
      old.image = saved.webPath;
    }
    // 更新其它字段（未提交的字段保持原值）
    old.title = title;
    old.tags = parseTags(req.body.tags !== undefined ? req.body.tags : old.tags.join(','));
    old.date = String(req.body.date || old.date || todayStr());
    old.panUrl = String(req.body.panUrl !== undefined ? req.body.panUrl : old.panUrl).trim();

    wallpapers[idx] = old;
    await saveWallpapers(wallpapers);
    res.json({ ok: true, wallpaper: old });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/admin/wallpapers/:id  删除壁纸（同时删除对应预览图文件） */
app.delete('/api/admin/wallpapers/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const idx = wallpapers.findIndex((w) => Number(w.id) === id);
    if (idx === -1) return res.status(404).json({ error: '未找到该壁纸' });

    const removed = wallpapers.splice(idx, 1)[0];
    // 尽力删除服务器上的预览图文件（演示 SVG / 用户上传图）
    const file = fromWebPath(removed.image);
    if (file && fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) { /* 忽略 */ }
    }
    await saveWallpapers(wallpapers);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
 * 5. 工具函数（内部使用）
 * =======================================================*/
/** 解析标签：把 "抽象, 极简，动漫" 这类输入转成去重后的数组 */
function parseTags(input) {
  return String(input || '')
    .split(/[,，]/) // 支持中英文逗号
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 今天的日期，格式 yyyy-MM-dd */
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 绝对磁盘路径 -> 可访问的 /uploads/xxx 地址 */
function toWebPath(absPath) {
  return '/' + path.relative(ROOT, absPath).split(path.sep).join('/');
}

/** 网页地址 -> 绝对磁盘路径（带安全校验，防止目录穿越） */
function fromWebPath(webPath) {
  if (!webPath || typeof webPath !== 'string') return null;
  const clean = webPath.replace(/^\/+/, '');
  if (!clean.startsWith('uploads/')) return null;
  const abs = path.join(ROOT, clean);
  // 确认解析结果仍位于项目根目录内
  if (!abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

/* =========================================================
 * 6. 静态资源托管
 * =======================================================*/
// 上传的图片：访问地址即 /uploads/文件名
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
// 前台页面 / 样式 / 脚本
// 注意：html/css/js 一律 no-store（不缓存），确保手机/电脑刷新即拿到最新代码，
// 避免“旧 JS + 新 HTML”混用导致页面报错不渲染。图片/视频等大文件不在此列。
app.use(express.static(PUBLIC_DIR, {
  setHeaders(res, filePath) {
    if (/\.(html?|css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// 管理后台页面入口
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

/* =========================================================
 * 7. 兜底错误处理
 * =======================================================*/
// 未匹配到的 /api 请求统一返回 JSON 404
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 统一错误处理（含 multer 上传超限等错误）
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const msg = err && err.message ? err.message : '服务器内部错误';
  console.error('[服务错误]', msg);
  res.status(400).json({ error: msg });
});

/* =========================================================
 * 8. 启动服务
 * =======================================================*/
app.listen(CONFIG.port, () => {
  console.log('==================================================');
  console.log(`  ${CONFIG.siteName} 已启动`);
  console.log(`  前台地址: http://localhost:${CONFIG.port}`);
  console.log(`  后台地址: http://localhost:${CONFIG.port}/admin`);
  console.log(`  当前壁纸数量: ${wallpapers.length}`);
  console.log('==================================================');
});
