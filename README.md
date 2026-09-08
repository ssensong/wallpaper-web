# 暗格壁纸 · 个人壁纸网站（本地后台 + 纯静态前台）

一个暗黑简约风的个人壁纸分享站，**不需要服务器也能上线**：

- **本地管理后台**（Node.js + Express）：你在自己电脑上用密码登录后台增删改壁纸，上传预览图会自动压缩到 200KB 内；
- **纯静态前台**（GitHub Pages 免费托管）：改完壁纸一键 `npm run build` 导出静态站，推送到 GitHub，访问者看到的就是自动更新的页面，全程免费、无需买服务器。

## 两种运行模式

| 模式 | 怎么用 | 面向谁 |
| --- | --- | --- |
| 本地后台模式 `npm start` | 电脑上登录 `/admin` 管理壁纸；同一地址也能预览前台 | 站长自己 |
| 纯静态模式 `docs/` | `npm run build` 生成 → `npm run preview` 本地预览 → 推 GitHub Pages | 所有访客 |

## 功能一览

| 页面 | 说明 |
| --- | --- |
| `/` 壁纸（默认首页） | 响应式暗黑画廊，自动适配手机/电脑列数；顶部标签筛选；点击卡片弹出详情：大图 / 名称 / 发布日期 / 多标签 / 唯一的「前往百度网盘下载」按钮 |
| `/` 使用教程（底部第二个标签） | 深色排版文字说明 + 预留视频嵌入区（iframe 位置已留好，见下方「填入你的视频」） |
| `/admin` 管理后台（仅本地） | 密码登录后可新增 / 编辑 / 删除壁纸，上传预览图（自动压缩到 ≤200KB），所有控件放大适配手机 |

## 项目结构

```
wallpaper-web/
├─ package.json          # 依赖与启动/构建脚本
├─ config.js             # 站点名 / 端口 / 压缩上限（自行修改）
├─ local-secrets.json    # ★ 管理员密码（不进 Git 仓库，勿提交）
├─ server.js             # 本地后台（Express：API + 上传 + 鉴权）
├─ build-static.js       # ★ 一键导出纯静态站到 docs/
├─ preview-static.js     # ★ 本地预览静态站（docs/）
├─ data/
│  └─ wallpapers.json    # ★ 壁纸数据（JSON，可随时备份）
├─ uploads/              # ★ 上传的预览图存放处（自动压缩）
├─ docs/                 # ★ npm run build 生成的静态站（提交到 GitHub）
└─ public/               # 前台静态文件
   ├─ index.html         # 前台（壁纸 + 使用教程）
   ├─ admin.html         # 管理后台页面（仅本地模式使用）
   ├─ css/               # style.css 前台样式 / admin.css 后台样式
   └─ js/                # app.js 前台脚本 / admin.js 后台脚本
```

> 标 ★ 的文件夹/文件请勿写进源码 Git 提交：`data/`、`uploads/`、`local-secrets.json` 已被 `.gitignore` 排除；`docs/` 是构建产物，**要**提交（访客页面靠它）。

## 本地运行（电脑端，Windows / macOS / Linux）

需要已安装 Node.js（建议 ≥ 16）。

```bash
cd wallpaper-web
npm install        # 首次安装依赖
npm start          # 启动本地后台，监听 http://localhost:3000
```

浏览器访问：

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>

## 日常更新壁纸的工作流（三句话）

1. 电脑上 `npm start`，打开后台 `/admin` 登录，新增 / 修改 / 删除壁纸；
2. 在项目目录执行 `npm run build`，自动把最新数据与图片导出为纯静态站（`docs/`）；
3. 用 GitHub Desktop 提交并推送（`docs/` 目录会自动带上），GitHub Pages 几分钟内自动更新，访客看到新壁纸。

> 前端很贴心：先尝试请求本地后台 API，不存在时自动改读随站发布的 `data.json`，所以同一套页面本地后台模式与静态站模式都能用，无需维护两份代码。

## 构建与预览静态站

```bash
npm run build      # 生成 docs/：复制前台资源 + 生成 data.json + 复制图片
npm run preview    # 本地预览静态站：http://localhost:4000（纯静态，无后台）
```

预览完效果没问题，再走 Git 提交推送发布。

## 发布到 GitHub Pages（免费、免服务器）

前置：仓库里包含 `docs/` 目录（执行过 `npm run build` 生成）。

1. 在 GitHub 网页打开你的仓库 → `Settings` → 左侧 `Pages`；
2. `Build and deployment` → **Source** 选 **Deploy from a branch**；
3. **Branch** 选 `main`，**文件夹**选 `/docs`，点 `Save`；
4. 等 1~2 分钟出现绿色提示后，站点地址即 `https://你的用户名.github.io/仓库名/`。

以后每次更新只需：本地后台改完 → `npm run build` → GitHub Desktop 提交推送 → 自动更新。

> 自定义域名（可选）：在仓库 `Settings → Pages` 的 `Custom domain` 填写你的域名，并把 DNS 按提示添加 CNAME 到 `你的用户名.github.io` 即可（本静态站已按子路径/根路径自适应，无需额外配置）。

## 修改管理员密码

创建/编辑本地 `local-secrets.json`（此文件不会上传 GitHub）：

```json
{ "adminPassword": "你的新密码" }
```

保存后重启服务（Ctrl+C 后重新 `npm start`）生效。也可以用环境变量 `ADMIN_PASSWORD` 覆盖。

> 仓库公开时请勿把真实密码写进 `config.js`。

## 填入你自己的视频（修改教程页源码即可，无需后台）

打开 `public/index.html`，找到「视频教程」卡片里 `id="videoSlot"` 的占位层，将其内容替换为 iframe / video 标签，例如：

```html
<!-- B 站视频 -->
<iframe src="//player.bilibili.com/player.html?bvid=你的BV号&high_quality=1&danmaku=0"
        scrolling="no" frameborder="no" allowfullscreen="true"></iframe>

<!-- 腾讯视频 -->
<iframe src="//v.qq.com/txp/iframe/player.html?vid=你的视频vid" allowfullscreen="true"></iframe>

<!-- 本地视频（将视频放入 public/video/ 目录后，重新 npm run build） -->
<video src="video/演示视频.mp4" controls></video>
```

同时可自由修改教程页的文字说明。教程没有可视化后台，直接改源码即可。

## 数据与图片的备份

壁纸全部数据在 `data/wallpapers.json`，图片在 `uploads/`，两者一起复制即可完成备份 / 迁移。迁移到新电脑时把这两个文件夹放回项目根目录（缺失时本地后台会自动创建示例数据）。

## 常见接口（便于二次开发，本地后台模式）

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/wallpapers` | 壁纸列表 + 标签集合 | 公开 |
| POST | `/api/admin/login` | 密码登录 | - |
| GET | `/api/admin/me` | 判断登录状态 | - |
| GET | `/api/admin/wallpapers` | 后台壁纸列表 | 需登录 |
| POST | `/api/admin/wallpapers` | 新增（multipart） | 需登录 |
| PUT | `/api/admin/wallpapers/:id` | 编辑（multipart） | 需登录 |
| DELETE | `/api/admin/wallpapers/:id` | 删除（同时删图） | 需登录 |
| POST | `/api/admin/logout` | 退出 | 需登录 |

## 技术要点

- 数据持久化：`server.js` 每次增删改后写回 `data/wallpapers.json`（先写临时文件再改名，避免写坏）。
- 登录鉴权：登录成功后下发 httpOnly Cookie（随机 Token 存内存，3 天有效），后台接口统一校验。
- 图片上传：服务端用 sharp 自动压缩到 ≤200KB 后落盘（JPG/PNG→JPG，含透明→WebP，GIF/SVG 原样），multer 仅作内存中转。
- 静态化：`build-static.js` 把 `/uploads/xxx` 改写为相对路径 `uploads/xxx`，前台按 `用户名.github.io/仓库名/` 或根路径均能正确加载。
- 双数据源：`app.js` 先请求 `/api/wallpapers`（本地模式），失败自动改读同目录 `data.json`（静态模式），站长按钮在纯静态站自动隐藏。
- 页面主题：纯黑白灰暗色调，无花哨配色；前台与后台均适配手机。
