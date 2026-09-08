/**
 * 全局配置文件（管理员可自行修改本文件来调整网站参数）
 *
 * =========================================================
 * 【如何修改管理员密码】
 *   方式一：创建 local-secrets.json（本文件已被 .gitignore 排除，
 *           不会随代码上传到 GitHub），内容为：
 *             { "adminPassword": "mypass888" }
 *   方式二：使用环境变量覆盖（不改代码），例如
 *             Windows PowerShell:  $env:ADMIN_PASSWORD="mypass888"; npm start
 *             Linux / macOS:        ADMIN_PASSWORD=mypass888 npm start
 *   优先使用环境变量；未设置时读取 local-secrets.json。
 *   修改后重启服务（Ctrl+C 后重新 npm start）即可生效。
 *
 *   ⚠ 安全提醒：仓库为公开时，请勿把真实密码写进本文件。
 * =========================================================
 */
'use strict';

const path = require('path');
const fs = require('fs');

/**
 * 读取本地密钥文件 local-secrets.json 中的字段（该文件不进 Git 仓库）
 */
function loadLocalSecret(name) {
  try {
    const file = path.join(__dirname, 'local-secrets.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && data[name]) return String(data[name]);
    }
  } catch (e) { /* 本地密钥文件缺失或损坏时忽略 */ }
  return undefined;
}

const adminPassword = process.env.ADMIN_PASSWORD || loadLocalSecret('adminPassword');
if (!adminPassword) {
  console.warn(
    '[配置警告] 未检测到管理员密码：请创建 local-secrets.json（含 adminPassword 字段）或设置环境变量 ADMIN_PASSWORD，否则无法登录后台。'
  );
}

module.exports = {
  /* ---------- 基础信息 ---------- */
  // 网站显示名称（展示在浏览器标题 / 页头，可自行修改）
  siteName: '暗格壁纸',
  siteSubtitle: '个人精品壁纸收藏',
  siteTitle: '暗格壁纸 · 个人壁纸收藏',

  /* ---------- 服务端口 ---------- */
  // 本地运行后访问 http://localhost:3000
  port: Number(process.env.PORT) || 3000,

  /* ---------- 管理后台 ---------- */
  // 管理员登录密码：读取自环境变量 ADMIN_PASSWORD 或本地密钥文件 local-secrets.json
  adminPassword,
  // 登录 Cookie 名称
  cookieName: 'darkgrid_admin_token',
  // 登录有效时长（3 天），超过后需重新登录
  sessionMaxAgeMs: 3 * 24 * 60 * 60 * 1000,

  /* ---------- 上传限制 ---------- */
  // 单张预览图最大体积（MB）
  maxUploadMB: 20,
  // 服务端自动压缩的目标体积（KB）：上传的预览图落盘前会压到这个大小以内
  previewMaxKB: 200,

  /* ---------- 数据与上传目录（自动创建） ---------- */
  // 壁纸数据保存文件（JSON，无需数据库）
  dataFile: path.join(__dirname, 'data', 'wallpapers.json'),
  // 预览图上传目录
  uploadsDir: path.join(__dirname, 'uploads'),

  /* ---------- 首次启动的示例数据 ---------- */
  // 仅当 data/wallpapers.json 不存在时写入，作为演示用；可登录后台自行删除。
  // 每一项字段说明：
  //   title  : 壁纸名称
  //   tags   : 标签数组（多个）
  //   date   : 发布日期（yyyy-MM-dd）
  //   image  : 预览图地址（/uploads/ 开头的相对路径）
  //   panUrl : 百度网盘分享链接
  seedWallpapers: [
    { id: 1, title: '墨夜穹光', tags: ['抽象', '极简'], date: '2026-08-28', image: '/uploads/demo-1.svg', panUrl: 'https://pan.baidu.com/' },
    { id: 2, title: '几何灰调', tags: ['几何', '极简'], date: '2026-08-18', image: '/uploads/demo-2.svg', panUrl: 'https://pan.baidu.com/' },
    { id: 3, title: '雾隐群峰', tags: ['风景', '山岳'], date: '2026-08-06', image: '/uploads/demo-3.svg', panUrl: 'https://pan.baidu.com/' },
    { id: 4, title: '墨色潮汐', tags: ['海洋', '抽象'], date: '2026-07-22', image: '/uploads/demo-4.svg', panUrl: 'https://pan.baidu.com/' },
    { id: 5, title: '斜织光影', tags: ['光影', '极简'], date: '2026-07-10', image: '/uploads/demo-5.svg', panUrl: 'https://pan.baidu.com/' },
    { id: 6, title: '夜城剪影', tags: ['城市', '建筑'], date: '2026-06-30', image: '/uploads/demo-6.svg', panUrl: 'https://pan.baidu.com/' }
  ]
};
