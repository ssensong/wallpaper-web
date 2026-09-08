/**
 * 前台页面脚本（壁纸网格 / 关键词搜索 / 详情弹窗 / 底部导航切换）
 *
 * 数据支持两种模式，自动切换：
 *   1) 本地后台模式：请求 GET /api/wallpapers（由本地 Node 服务提供，实时数据）；
 *   2) 纯静态模式（GitHub Pages 等）：请求随站发布的 data.json（相对路径）。
 *  顺序尝试：先走 API，若不存在（如纯静态托管环境）则读取同目录 data.json。
 * 壁纸图片一律使用相对路径（uploads/xxx），两种模式下都能加载。
 */
(function () {
  'use strict';

  /* ---------- DOM 引用 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid');
  const searchInput = $('#searchInput');
  const searchClear = $('#searchClear');
  const loadState = $('#loadState');
  const emptyState = $('#emptyState');
  const emptyText = $('#emptyText');
  const errorState = $('#errorState');
  const pager = $('#pager');
  const toast = $('#toast');
  const fabAdmin = $('#fabAdmin'); // 站长悬浮入口（仅登录后显示）

  // 详情弹窗相关
  const modalBackdrop = $('#modalBackdrop');
  const modalImage = $('#modalImage');
  const modalTitle = $('#modalTitle');
  const modalDate = $('#modalDate');
  const modalTags = $('#modalTags');
  const modalDownload = $('#modalDownload');

  /* ---------- 状态 ---------- */
  let allWallpapers = []; // 全量壁纸（来自 API 或 data.json）
  let staticMode = false; // true=数据来自 data.json（纯静态站，无后台 API）
  let fabInitChecked = false; // 站长按钮只在首次数据加载完成后核对一次
  let keyword = ''; // 当前搜索关键词
  let page = 1; // 当前页码（从 1 开始）
  const PER_PAGE = 10; // 每页展示 10 张

  /* ---------- 轻提示 ---------- */
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  /* ---------- 日期格式化：2026-08-28 -> 2026年8月28日 ---------- */
  function fmtDate(str) {
    const parts = String(str || '').split('-');
    if (parts.length !== 3) return str || '';
    return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
  }

  /* ---------- 底部导航：壁纸 / 使用教程 切换 ---------- */
  const panels = {
    wallpapers: $('#panel-wallpapers'),
    tutorial: $('#panel-tutorial')
  };
  let loadedOnce = false; // 首页数据是否已成功加载过
  function switchPanel(name) {
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== name;
    });
    document.querySelectorAll('.tabbar .tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.panel === name);
    });
    window.scrollTo(0, 0);
    // 切回壁纸页时静默刷新一次，保证后台新增/修改的壁纸能及时出现
    if (name === 'wallpapers' && loadedOnce) loadWallpapers(true);
  }
  document.querySelectorAll('.tabbar .tab').forEach((tab) => {
    tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
  });

  /* ---------- 构建标签小胶囊（最多展示前 3 个） ---------- */
  function buildTags(w) {
    const tags = w.tags || [];
    if (!tags.length) return null;
    const row = document.createElement('div');
    row.className = 'card-tags';
    tags.slice(0, 3).forEach((t) => {
      const s = document.createElement('span');
      s.className = 'tag-mini';
      s.textContent = t;
      row.appendChild(s);
    });
    if (tags.length > 3) {
      const more = document.createElement('span');
      more.className = 'tag-mini';
      more.textContent = '+' + (tags.length - 3);
      row.appendChild(more);
    }
    return row;
  }

  /* ---------- 渲染壁纸网格（名称 + 标签置于底部透明玻璃框） ---------- */
  function renderGrid(list) {
    grid.innerHTML = '';
    // 空结果：区分「没有壁纸」与「搜索无结果」
    if (!list.length) {
      grid.hidden = false;
      emptyState.hidden = false;
      emptyText.textContent = keyword.trim()
        ? '没有找到与「' + keyword.trim() + '」相关的壁纸'
        : '暂时还没有壁纸，敬请期待';
      return;
    }
    emptyState.hidden = true;
    grid.hidden = false; // 数据就绪，显示网格（否则会一直保持加载时隐藏）

    // DocumentFragment 一次性插入，减少重排
    const frag = document.createDocumentFragment();
    list.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = w.id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `查看壁纸：${w.title}`);

      const img = document.createElement('img');
      img.src = w.image || '';
      img.alt = w.title;
      img.loading = 'lazy'; // 懒加载，首屏更流畅

      // 透明信息框：名称 + 标签放一起
      const info = document.createElement('div');
      info.className = 'card-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'card-name';
      nameEl.textContent = w.title;
      info.appendChild(nameEl);
      const tagsRow = buildTags(w);
      if (tagsRow) info.appendChild(tagsRow);

      card.appendChild(img);
      card.appendChild(info);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  /* ---------- 翻到指定页 ---------- */
  function goPage(p) {
    if (p === page) return;
    page = p;
    applyFilter();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }

  /* ---------- 渲染分页条：上一页 / 页码 / 下一页 ---------- */
  function renderPager(totalCount) {
    const totalPages = Math.ceil(totalCount / PER_PAGE);
    pager.innerHTML = '';
    // 一页能放下（含无结果）时，隐藏分页条
    if (totalPages <= 1) { pager.hidden = true; return; }
    pager.hidden = false;

    const makeBtn = (text, p, active) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = active ? 'active' : '';
      b.addEventListener('click', () => goPage(p));
      pager.appendChild(b);
      return b;
    };
    const ellipsis = () => {
      const s = document.createElement('span');
      s.className = 'page-ellipsis';
      s.textContent = '…';
      pager.appendChild(s);
    };

    makeBtn('‹', Math.max(1, page - 1));
    // 页数多时折叠：1 … 当前±2 … 末页
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) makeBtn(String(i), i, i === page);
    } else {
      const win = 2;
      const left = Math.max(1, page - win);
      const right = Math.min(totalPages, page + win);
      if (left > 1) {
        makeBtn('1', 1, page === 1);
        if (left > 2) ellipsis();
      }
      for (let i = left; i <= right; i++) makeBtn(String(i), i, i === page);
      if (right < totalPages) {
        if (right < totalPages - 1) ellipsis();
        makeBtn(String(totalPages), totalPages, page === totalPages);
      }
    }
    makeBtn('›', Math.min(totalPages, page + 1));
  }

  /* ---------- 模糊搜索过滤（匹配名称或标签）并分页重绘 ----------
     匹配规则：
       - 空格分隔多个词时，要求所有词都命中（更精确）；
       - 单个词先做“连续子串”匹配；
       - 词长 ≥2 且子串没命中时，再做“按顺序跳字”的模糊匹配，
         例如搜「蓝色星空」也能命中「蓝色渐变星空」；
       - 英文自动忽略大小写。 */
  function subseqHit(hay, needle) {
    let i = 0;
    for (let j = 0; j < hay.length && i < needle.length; j++) {
      if (hay[j] === needle[i]) i++;
    }
    return i === needle.length;
  }
  function wordHit(text, word) {
    const t = String(text || '').toLowerCase();
    if (!t || !word) return false;
    if (t.includes(word)) return true;
    // 按顺序但允许中间隔字：解决名称中间夹了别的字导致搜不到的问题
    return word.length >= 2 && subseqHit(t, word);
  }
  function itemMatch(w, words) {
    return words.every((word) =>
      wordHit(w.title, word) ||
      (w.tags || []).some((tag) => wordHit(tag, word))
    );
  }

  function applyFilter() {
    const raw = keyword.trim();
    const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? allWallpapers.filter((w) => itemMatch(w, words))
      : allWallpapers;
    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    // 数据变少（删掉几页、搜索结果变化）时，页码自动回落，避免停在第 N 页空白
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PER_PAGE;
    renderGrid(list.slice(start, start + PER_PAGE));
    renderPager(list.length);
  }

  /* ---------- 清空按钮显隐 ---------- */
  function syncClear() {
    searchClear.classList.toggle('show', Boolean(searchInput.value));
  }

  /* ---------- 加载数据 ---------- */
  // silent=true：不显示加载动画、失败不影响已有内容（用于面板切换后的静默刷新）
  async function fetchDataFrom(url) {
    // 本地 API：必须 no-store，保证后台刚新增/修改立即可见；
    // 静态 data.json：允许浏览器/CDN 缓存（ETag/304），二次访问更快。
    const cache = url.indexOf('/api/') === 0 ? 'no-store' : 'default';
    const res = await fetch(url, { cache });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.wallpapers)) throw new Error('数据格式不正确: ' + url);
    return { url, data };
  }
  async function loadWallpapers(silent) {
    if (!silent) {
      // 显示加载状态，隐藏网格
      loadState.hidden = false;
      errorState.hidden = true;
      emptyState.hidden = true;
      grid.hidden = true;
    }
    try {
      let picked;
      try {
        picked = await fetchDataFrom('/api/wallpapers'); // ① 本地后台模式（Node 服务）
      } catch (e) {
        picked = await fetchDataFrom('data.json'); // ② 纯静态模式：读取随站发布的 data.json
      }
      staticMode = /\/data\.json$|^data\.json$/.test(picked.url);
      allWallpapers = picked.data.wallpapers || [];
      applyFilter();
      loadedOnce = true;
      if (!silent) loadState.hidden = true;
    } catch (err) {
      console.error(err);
      if (!silent) {
        loadState.hidden = true;
        grid.hidden = false;
        errorState.hidden = false;
      }
    } finally {
      if (!fabInitChecked) { fabInitChecked = true; syncFabAdmin(); }
    }
  }

  /* ---------- 打开 / 关闭详情弹窗 ---------- */
  function openModal(w) {
    if (!w) return;
    modalImage.src = w.image || '';
    modalTitle.textContent = w.title || '未命名壁纸';
    modalDate.textContent = '发布日期：' + fmtDate(w.date);
    // 多标签分别显示
    modalTags.innerHTML = '';
    (w.tags || []).forEach((t) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = t;
      modalTags.appendChild(pill);
    });
    modalDownload.href = w.panUrl || '#'; // 新标签页直接打开网盘链接
    // 标记是否有可用链接，用于点击时的空链接防呆
    modalDownload.dataset.hasLink = w.panUrl ? '1' : '0';
    modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden'; // 锁定背景滚动
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = '';
    // 释放大图内存
    modalImage.removeAttribute('src');
  }

  /* ---------- 事件绑定 ---------- */
  // 搜索：输入即过滤（名称 / 标签 均支持）；新搜索从头一页看起
  searchInput.addEventListener('input', () => {
    keyword = searchInput.value;
    page = 1;
    syncClear();
    applyFilter();
  });
  // 点 × 清空搜索
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    keyword = '';
    page = 1;
    syncClear();
    applyFilter();
    searchInput.focus();
  });

  // 点击壁纸卡片 -> 打开详情
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const w = allWallpapers.find((x) => String(x.id) === String(card.dataset.id));
    openModal(w);
  });
  // 键盘访问支持
  grid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      card.click();
    }
  });

  // 关闭弹窗：按钮 / 点击遮罩 / Esc
  $('#modalClose').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal();
  });

  // 下载按钮防呆：未填写网盘链接时给出提示，绝不跳回当前页
  modalDownload.addEventListener('click', (e) => {
    if (modalDownload.dataset.hasLink !== '1') {
      e.preventDefault();
      showToast('这张壁纸还没有填写下载链接，站长上传中…');
    }
  });

  /* ---------- 站长悬浮按钮：仅已登录管理员的浏览器显示 ---------- */
  // 纯静态站（无后台 API）一律隐藏；本地后台模式下靠 /api/admin/me 判断登录态
  function syncFabAdmin() {
    if (!fabAdmin) return;
    if (staticMode) { fabAdmin.hidden = true; return; }
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((data) => { fabAdmin.hidden = !(data && data.ok); })
      .catch(() => { fabAdmin.hidden = true; }); // 接口异常时不显示，避免暴露入口
  }
  // 管理员可能在后台页登录 / 退出，切回本页时重新核对一次
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFabAdmin();
  });

  /* ---------- 启动 ---------- */
  syncClear();
  loadWallpapers();
  window.__showToast = showToast; // 保留给可能的扩展使用
})();
