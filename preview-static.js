'use strict';
/**
 * 本地预览纯静态站（docs/ 目录），不依赖任何后台接口
 * 使用：npm run preview  →  http://localhost:4000
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const ROOT = __dirname;
const DOCS = path.join(ROOT, 'docs');
const PORT = Number(process.env.PORT) || 4000;

if (!fs.existsSync(path.join(DOCS, 'index.html'))) {
  console.error('[preview] 未找到 docs/index.html，请先运行 npm run build 生成静态站。');
  process.exit(1);
}

const app = express();
app.use(express.static(DOCS, { index: 'index.html', maxAge: 0 }));
app.use((req, res) => {
  res.status(404).type('text/plain; charset=utf-8').send('404 Not Found');
});

app.listen(PORT, () => {
  console.log('[preview] 静态站已就绪: http://localhost:' + PORT);
  console.log('  此模式为纯静态站（读 docs/data.json），本地后台请另开终端运行 npm start（3000 端口）。');
});
