/**
 * 管理后台脚本：登录校验 / 壁纸 增·改·删 / 图片本地预览
 * 相关接口（均需登录 Cookie）：
 *   POST   /api/admin/login
 *   GET    /api/admin/me
 *   GET    /api/admin/wallpapers
 *   POST   /api/admin/wallpapers      （multipart 表单）
 *   PUT    /api/admin/wallpapers/:id  （multipart 表单）
 *   DELETE /api/admin/wallpapers/:id
 *   POST   /api/admin/logout
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const isEdit = () => !!$('#fId').value; // 是否存在正在编辑的 id

  /* =========================================================
     轻提示
     =======================================================*/
  const toast = $('#toast');
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
  }

  /* =========================================================
     视图切换（登录 / 管理面板）
     =======================================================*/
  function showLogin(message) {
    $('#loginView').hidden = false;
    $('#panelView').hidden = true;
    if (message) {
      const err = $('#loginError');
      err.textContent = message;
      err.hidden = false;
    }
  }
  function showPanel() {
    $('#loginView').hidden = true;
    $('#panelView').hidden = false;
    loadList();
  }

  /** 统一处理“未登录 / 会话过期” */
  function handleUnauthorized() {
    showLogin('登录状态已失效，请重新输入密码。');
  }

  /* =========================================================
     登录 / 退出
     =======================================================*/
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    err.hidden = true;
    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = '验证中…';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#loginPassword').value })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        err.textContent = data.error || '登录失败';
        err.hidden = false;
        return;
      }
      $('#loginPassword').value = '';
      showPanel();
    } catch (err2) {
      console.error(err2);
      err.textContent = '网络错误，请检查服务是否已启动';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  });

  /* =========================================================
     初始化：判断是否已登录
     =======================================================*/
  (async function init() {
    try {
      const res = await fetch('/api/admin/me');
      const data = await res.json();
      if (data.ok) { showPanel(); } else { showLogin(); }
    } catch (e) {
      showLogin('无法连接服务器，请确认已执行 npm start 后访问。');
    }
  })();

  /* =========================================================
     获取 / 渲染壁纸列表
     =======================================================*/
  async function loadList() {
    $('#loadErr').hidden = true;
    try {
      const res = await fetch('/api/admin/wallpapers');
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderList(data.wallpapers || []);
    } catch (e) {
      console.error(e);
      $('#loadErr').hidden = false;
    }
  }

  function renderList(list) {
    const box = $('#manageList');
    const count = $('#listCount');
    box.innerHTML = '';
    count.textContent = String(list.length);
    $('#listEmpty').hidden = list.length > 0;

    list.forEach((w) => {
      const row = document.createElement('div');
      row.className = 'manage-row';
      row.dataset.id = w.id;

      // 缩略图
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = w.image || '';
      img.alt = w.title;
      img.loading = 'lazy';

      // 信息
      const info = document.createElement('div');
      info.className = 'info';
      const h3 = document.createElement('h3');
      h3.textContent = w.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${w.date || ''}  ·  ${(w.tags || []).join(' / ') || '无标签'}  ·  ${w.panUrl || '未填网盘链接'}`;
      info.appendChild(h3);
      info.appendChild(meta);

      // 操作按钮
      const actions = document.createElement('div');
      actions.className = 'actions';

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-ghost btn-sm';
      btnEdit.textContent = '编辑';
      btnEdit.addEventListener('click', () => fillForm(w));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-danger btn-sm';
      btnDel.textContent = '删除';
      btnDel.dataset.confirming = '0';
      btnDel.addEventListener('click', () => onDeleteClick(w, btnDel));

      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  /* =========================================================
     新增 / 编辑 表单
     =======================================================*/
  // 生成今天的日期（yyyy-MM-dd），作为默认发布日期
  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** 清空表单，回到“新增”状态 */
  function resetForm() {
    $('#wallpaperForm').reset();
    $('#fId').value = '';
    $('#fDate').value = todayStr();
    $('#editorTitle').textContent = '＋ 新增壁纸';
    $('#resetFormBtn').hidden = true;
    $('#uploadReq').hidden = true;
    $('#previewBox').hidden = true;
    releasePending(); // 清理上次选图产生的压缩临时资源，避免旧图被误提交
  }

  /** 编辑：把壁纸数据填入表单 */
  function fillForm(w) {
    // 先回到干净状态（含清空文件选择器），再回填数据
    resetForm();
    $('#fId').value = w.id;
    $('#fTitle').value = w.title || '';
    $('#fTags').value = (w.tags || []).join(', ');
    $('#fDate').value = w.date || todayStr();
    $('#fPan').value = w.panUrl || '';
    $('#editorTitle').textContent = `✎ 编辑：${w.title}`;
    $('#resetFormBtn').hidden = false;
    $('#uploadReq').hidden = true; // 编辑时可不上传新图（后端自动保留原图）
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#fTitle').focus();
  }

  // “清空 / 取消编辑”按钮
  $('#resetFormBtn').addEventListener('click', resetForm);

  /* =========================================================
     网盘链接智能提取：粘贴分享文案后自动抽出网址、去掉多余文字
     规则：优先找 http(s):// 开头的链接；若只有裸域(pan.baidu.com/…)
           也识别，并自动补上 https://；再剔除尾部多余标点。
     =======================================================*/
  const PAN_URL_RE = /(https?:\/\/[^\s，。；、（）()【】《》"''<>]+|[a-z0-9.-]*pan\.baidu\.com\/[^\s，。；、（）()【】《》"''<>]+)/i;
  function extractUrl(text) {
    if (!text) return '';
    const m = String(text).match(PAN_URL_RE);
    if (!m) return '';
    let url = m[0];
    // 去掉尾部可能混进来的标点 / 括号（链接本身不受影响）
    url = url.replace(/[)\]}>.，。；、）】》]+$/g, '');
    // 无协议时补上 https://（此时浏览器 URL 输入框才会判定为合法链接）
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return url;
  }
  function applyPanExtract() {
    const input = $('#fPan');
    if (!input.value) return;
    const cleaned = extractUrl(input.value);
    if (cleaned && cleaned !== input.value) input.value = cleaned;
  }
  // 粘贴后立即提取；失焦时再兜底一次（手输不打扰）
  $('#fPan').addEventListener('paste', () => setTimeout(applyPanExtract, 0));
  $('#fPan').addEventListener('blur', applyPanExtract);

  // 表单提交：区分 新增(POST) 与 编辑(PUT)
  $('#wallpaperForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#fId').value;
    const btn = $('#submitBtn');
    applyPanExtract(); // 提交前兜底清理一遍
    const fd = new FormData($('#wallpaperForm'));
    // 若已选择新图且被自动压缩：用压缩产物替换原始文件上传
    if (pendingImage) {
      fd.delete('image');
      fd.append('image', pendingImage.blob, pendingImage.name);
    }

    btn.disabled = true;
    btn.textContent = '保存中…';
    try {
      // 若选择了图片但当前处于“编辑且未换图”状态也无需额外处理：
      // 不选择文件时 fd 中的 image 字段为空，后端会自动保留原图。
      const url = isEdit() ? `/api/admin/wallpapers/${id}` : '/api/admin/wallpapers';
      const method = isEdit() ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: fd });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error || '保存失败，请重试');
        return;
      }
      showToast(isEdit() ? '已更新壁纸' : '已新增壁纸');
      resetForm();
      loadList();
    } catch (err2) {
      console.error(err2);
      showToast('网络错误，保存失败');
    } finally {
      btn.disabled = false;
      btn.textContent = '保存壁纸';
    }
  });

  /* =========================================================
     预览图自动压缩：选择图片后先在浏览器端压缩到 ≤200KB
     再上传，节省 uploads 存储空间与服务器带宽。
     规则：
       - 本身 ≤200KB 的图 → 原样上传，不做多余处理；
       - GIF 动图 / SVG → 保持原样（避免丢动画 / 无谓转换）；
       - 其余 JPG/PNG/WEBP → Canvas 压缩，目标 ≤200KB：
         先降画质，仍超限再等比降分辨率；
         PNG 含透明像素时转 WebP（保留透明），否则转 JPEG。
         文件名扩展名会与真实格式同步更正，保证浏览器正确解码。
     =======================================================*/
  const PREVIEW_MAX_BYTES = 200 * 1024; // 目标：200KB

  // 压缩后的待上传图片（blob）；未触发压缩时为 null，走原文件上传
  let pendingImage = null;
  let pendingPreviewUrl = null;

  /** 释放压缩过程产生的临时资源 */
  function releasePending() {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      pendingPreviewUrl = null;
    }
    pendingImage = null;
  }

  /** 自适应格式化文件大小：B / KB / MB */
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  /** File -> dataURL */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
  }

  /** dataURL -> Image（等解码完成再处理） */
  function dataURLToImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = src;
    });
  }

  /** 按 scale 等比绘制到画布；bg 不为空时先铺底色（转 JPEG 时避免透明区变黑） */
  function drawScaled(img, scale, bg) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return cv;
  }

  /** canvas -> Blob */
  function canvasToBlob(cv, mime, quality) {
    return new Promise((resolve) => {
      try {
        cv.toBlob((b) => resolve(b), mime, quality);
      } catch (e) {
        resolve(null);
      }
    });
  }

  /** 缩小采样检测图片是否含透明像素 */
  function hasAlphaChannel(img) {
    const scale = Math.min(1, 140 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = drawScaled(img, scale);
    try {
      const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) return true;
      }
    } catch (e) { /* 异常情况按无透明处理 */ }
    return false;
  }

  /** 逐档压缩（降画质 → 降分辨率），返回首个 ≤maxBytes 的结果 */
  async function compressImage(img, mime, maxBytes) {
    // 浏览器画布存在面积上限，超大图先按上限等比限幅，避免绘制失败
    const areaLimit = 16 * 1024 * 1024;
    const maxScale = Math.min(1, Math.sqrt(areaLimit / (img.naturalWidth * img.naturalHeight)));
    const scales = [1, 0.82, 0.66, 0.5, 0.38];
    const qualities = [0.82, 0.68, 0.55, 0.44];
    const bg = mime === 'image/jpeg' ? '#ffffff' : null;
    let best = null;
    let lastScale = -1;
    for (const raw of scales) {
      const s = Math.min(raw, maxScale);
      if (s <= 0.05 || s === lastScale) continue;
      lastScale = s;
      const cv = drawScaled(img, s, bg);
      for (const q of qualities) {
        const blob = await canvasToBlob(cv, mime, q);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) return { blob, maxed: false };
      }
    }
    return { blob: best, maxed: true }; // 极复杂画面仍未压到 200KB：返回体积最小的一版
  }

  /** 显示预览区并给出说明文字 */
  function showPreview(imgSrc, hint) {
    $('#previewImg').src = imgSrc;
    $('#previewHint').textContent = hint;
    $('#previewBox').hidden = false;
  }

  $('#fImage').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    releasePending();
    if (!file) { $('#previewBox').hidden = true; return; }

    const submitBtn = $('#submitBtn');
    submitBtn.disabled = true; // 压缩期间禁止提交，防止原图抢先上传
    let dataUrl = '';
    try {
      dataUrl = await fileToDataURL(file);
      const img = await dataURLToImage(dataUrl);
      const mime = (file.type || '').toLowerCase();
      const tooBig = file.size > PREVIEW_MAX_BYTES;
      const compressible = mime !== 'image/gif' && mime !== 'image/svg+xml';

      if (!tooBig || !compressible) {
        // ≤200KB 或 GIF/SVG：原样上传
        showPreview(dataUrl, tooBig
          ? `已选择：${file.name}（${fmtSize(file.size)}，GIF/SVG 保持原样上传）`
          : `已选择：${file.name}（${fmtSize(file.size)}，未超过 200KB，无需压缩）`);
        return;
      }

      showPreview(dataUrl, '正在自动压缩…（目标 ≤200KB）');
      const hasAlpha = (mime === 'image/png' || mime === 'image/webp') && hasAlphaChannel(img);
      const outMime = hasAlpha || mime === 'image/webp' ? 'image/webp' : 'image/jpeg';

      const { blob, maxed } = await compressImage(img, outMime, PREVIEW_MAX_BYTES);
      if (!blob) {
        showPreview(dataUrl, `压缩失败，将按原图上传（${fmtSize(file.size)}）`);
        return;
      }

      // 用压缩产物替换待上传文件；扩展名与真实格式保持一致
      const base = (file.name || 'preview').replace(/\.[^.]+$/, '') || 'preview';
      pendingImage = {
        blob,
        name: base + (outMime === 'image/webp' ? '.webp' : '.jpg')
      };
      pendingPreviewUrl = URL.createObjectURL(blob);
      showPreview(pendingPreviewUrl,
        maxed
          ? `已尽力压缩：${fmtSize(file.size)} → ${fmtSize(blob.size)}（画面较复杂，未能压到 200KB）`
          : `已自动压缩：${fmtSize(file.size)} → ${fmtSize(blob.size)}（≤200KB 达标）`);
    } catch (err) {
      console.error(err);
      if (dataUrl) {
        showPreview(dataUrl, `图片处理出错，将按原图上传（${fmtSize(file.size)}）`);
      } else {
        $('#previewBox').hidden = true;
      }
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* =========================================================
     删除：两步确认（避免误触），点一下变“确认删除？”，3 秒未点自动还原
     =======================================================*/
  function onDeleteClick(w, btn) {
    const confirming = btn.dataset.confirming === '1';
    if (!confirming) {
      btn.dataset.confirming = '1';
      btn.textContent = '确认删除？';
      setTimeout(() => {
        if (btn.dataset.confirming === '1') {
          btn.dataset.confirming = '0';
          btn.textContent = '删除';
        }
      }, 3000);
      return;
    }
    // 用户再次点击，真正删除
    btn.disabled = true;
    btn.textContent = '删除中…';
    fetch(`/api/admin/wallpapers/${w.id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (res.status === 401) return handleUnauthorized();
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || '删除失败');
        } else {
          showToast(`已删除《${w.title}》`);
          loadList();
        }
      })
      .catch((e) => { console.error(e); showToast('网络错误，删除失败'); })
      .finally(() => {
        btn.disabled = false;
        btn.dataset.confirming = '0';
        btn.textContent = '删除';
      });
  }

  /* =========================================================
     初始默认日期
     =======================================================*/
  resetForm();
})();
