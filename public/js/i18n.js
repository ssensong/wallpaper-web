/**
 * 前台多语言（简体中文 / English）
 *
 * 功能：
 *   1) 语言切换按钮：位于搜索框左侧，点击在「中 / EN」之间切换，选择记入 localStorage；
 *   2) 自动识别：首次访问时自动判断，中国大陆用户显示中文，非中国大陆用户显示英文；
 *   3) 全站适配：界面文案、壁纸名称、标签、日期格式全部随语言切换。
 *
 * 语言判定优先级：URL 参数 ?lang=zh|en  >  localStorage 记忆  >  自动识别
 * 自动识别规则：
 *   - 时区不在中国大陆  → 英文
 *   - 时区在中国大陆，但浏览器首选语言不是中文  → 英文（照顾在华外籍用户）
 *   - 其余  → 中文
 *
 * 壁纸名称 / 标签的英文来自本文件底部的 TITLE_EN / TAG_EN 词典。
 * 站长在 data/wallpapers.json 里给某条数据加上 titleEn / tagsEn 字段时，优先使用该字段。
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ranmoku.lang';

  /* ---------- 界面文案词典 ---------- */
  const DICT = {
    zh: {
      'meta.title': '岚木壁纸 · 原创 iOS 交互壁纸',
      'meta.description': '岚木壁纸 - 原创 iOS 交互壁纸',
      'brand.name': '岚木壁纸',
      'brand.sub': '原创 iOS 交互壁纸',

      'search.placeholder': '搜索',
      'search.open': '搜索',
      'search.close': '收起搜索',
      'search.clear': '清空搜索',
      'lang.aria': '切换语言（中文 / English）',

      'state.loading': '正在加载壁纸…',
      'state.empty': '暂时还没有壁纸，敬请期待',
      'state.error': '内容加载失败，请检查网络后刷新页面重试',
      'search.noResult': '没有找到与「{q}」相关的壁纸',

      'card.aria': '查看壁纸：{title}',

      'modal.aria': '壁纸详情',
      'modal.close': '关闭',
      'modal.imageAlt': '壁纸预览',
      'modal.untitled': '未命名壁纸',
      'modal.date': '发布日期：',
      'modal.download': '获取壁纸文件',
      'modal.noLink': '这张壁纸还没有填写下载链接，站长上传中…',

      'nav.wallpapers': '壁纸',
      'nav.tutorial': '教程',
      'admin.aria': '壁纸管理后台',

      'tut.title': '使用教程',
      'tut.sub': '交互壁纸设置教程，轻松几步即可使用',
      'tut.step1.title': '前往网站进行签名',
      'tut.step1.desc': '在手机浏览器中打开下方签名网站，按网站提示完成签名操作：',
      'tut.step1.link': 'https://xb.ioszj.cn/mfb.php',
      'tut.step2.title': '下载「3105」工具',
      'tut.step2.desc': '下载并安装 3105 工具。',
      'tut.step2.link': '获取工具',
      'tut.step3.title': '下载 .tendies 壁纸文件并导入',
      'tut.step3.desc': '获取对应的 .tendies 壁纸文件，按提示导入即可使用。',
      'tut.video': '视频教程',
      'tut.faq': '常见问题',
      'tut.q1': 'Q：安装后提示「未受信任的开发者」怎么办？',
      'tut.a1': 'A：打开手机「设置 → 通用 → VPN 与设备管理」，找到对应的开发者描述文件，点击「信任」即可正常使用。',
      'tut.q2': 'Q：使用一段时间后 App 打不开了（掉签）？',
      'tut.a2': 'A：说明签名已过期，重新回到第 1 步的签名网站再次签名即可恢复。',
      'tut.q3': 'Q：下载链接失效了怎么办？',
      'tut.a3': 'A：可稍后再试或刷新页面；如果长期失效可联系站长更新链接。'
    },
    en: {
      'meta.title': 'Ranmoku Wallpapers · Original iOS Interactive Wallpapers',
      'meta.description': 'Ranmoku Wallpapers - original iOS interactive wallpapers',
      'brand.name': 'Ranmoku',
      'brand.sub': 'wallpaper',

      'search.placeholder': 'Search',
      'search.open': 'Search',
      'search.close': 'Close search',
      'search.clear': 'Clear search',
      'lang.aria': 'Switch language (中文 / English)',

      'state.loading': 'Loading wallpapers…',
      'state.empty': 'No wallpapers yet — stay tuned',
      'state.error': 'Failed to load. Check your network and refresh the page.',
      'search.noResult': 'No wallpapers found for “{q}”',

      'card.aria': 'View wallpaper: {title}',

      'modal.aria': 'Wallpaper details',
      'modal.close': 'Close',
      'modal.imageAlt': 'Wallpaper preview',
      'modal.untitled': 'Untitled wallpaper',
      'modal.date': 'Released: ',
      'modal.download': 'Get wallpaper file',
      'modal.noLink': 'No download link yet — the author is still uploading…',

      'nav.wallpapers': 'Wallpapers',
      'nav.tutorial': 'Guide',
      'admin.aria': 'Wallpaper admin',

      'tut.title': 'User Guide',
      'tut.sub': 'Set up interactive wallpapers in a few easy steps',
      'tut.step1.title': 'Sign in on the signing site',
      'tut.step1.desc': 'Open the signing site below in your mobile browser and follow its instructions:',
      'tut.step1.link': 'https://xb.ioszj.cn/mfb.php',
      'tut.step2.title': 'Download the “3105” tool',
      'tut.step2.desc': 'Download and install the 3105 tool.',
      'tut.step2.link': 'Get the tool',
      'tut.step3.title': 'Download the .tendies wallpaper file and import it',
      'tut.step3.desc': 'Get the matching .tendies wallpaper file and import it as prompted.',
      'tut.video': 'Video tutorial',
      'tut.faq': 'FAQ',
      'tut.q1': 'Q: After installing, it says “Untrusted Developer”. What should I do?',
      'tut.a1': 'A: Go to Settings → General → VPN & Device Management on your phone, find the matching developer profile and tap “Trust”.',
      'tut.q2': 'Q: The app stopped opening after a while (revoked certificate)?',
      'tut.a2': 'A: The signature has expired. Go back to step 1 and sign it again on the signing site.',
      'tut.q3': 'Q: What if a download link stops working?',
      'tut.a3': 'A: Try again later or refresh the page. If it stays broken, contact the site owner to update the link.'
    }
  };

  /* ---------- 壁纸名称：中文 → 英文 ---------- */
  const TITLE_EN = {
    '新岛真': 'Makoto Niijima',
    '祐介': 'Yusuke Kitagawa',
    '东乡一二三': 'Hifumi Togo',
    '摩尔加纳': 'Morgana',
    '明智吾郎': 'Goro Akechi',
    '佐仓双叶': 'Futaba Sakura',
    '武见妙': 'Tae Takemi',
    '新岛冴': 'Sae Niijima',
    '御船千早': 'Chihaya Mifune',
    '大宅一子': 'Ichiko Ohya',
    '奥村春': 'Haru Okumura',
    '椎名真昼': 'Mahiru Shiina',
    'p5': 'P5',
    'P5': 'P5',
    '鸣上悠': 'Yu Narukami',
    'Dio': 'Dio',
    '蜘蛛侠': 'Spider-Man',
    '奇犽': 'Killua',
    '西索': 'Hisoka',
    '库洛洛': 'Chrollo',
    '小滴': 'Shizuku',
    '酷拉皮卡': 'Kurapika',
    '飞坦': 'Feitan',
    '雨宫莲': 'Ren Amamiya',
    '芳泽霞': 'Kasumi Yoshizawa',
    'Joker': 'Joker',
    '双子': 'The Twins',
    '波奇酱': 'Bocchi',
    '山田凉': 'Ryo Yamada',
    '绫波丽': 'Rei Ayanami',
    '艾莲': 'Ellen Joe',
    '朝凪海': 'Umi Asanagi',
    '珂莱塔': 'Carlotta',
    '帕瓦': 'Power'
  };

  /* ---------- 标签：中文 → 英文 ---------- */
  const TAG_EN = {
    '女神异闻录5': 'Persona 5',
    '女神异闻录4': 'Persona 4',
    '邻家天使': 'The Angel Next Door',
    'jojo的奇妙冒险': "JoJo's Bizarre Adventure",
    'JOJO的奇妙冒险': "JoJo's Bizarre Adventure",
    'spiderman': 'Spider-Man',
    '全职猎人': 'Hunter × Hunter',
    '孤独摇滚': 'Bocchi the Rock!',
    'eva': 'Evangelion',
    'EVA': 'Evangelion',
    '绝区零': 'Zenless Zone Zero',
    '班上第二可爱的女生': 'The 2nd Cutest Girl in My Class',
    '鸣潮': 'Wuthering Waves',
    '电锯人': 'Chainsaw Man'
  };

  const MAINLAND_TZ = /^Asia\/(Shanghai|Chongqing|Urumqi|Harbin|Kashgar|Kashi|Beijing)$/i;
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- 当前语言 ---------- */
  let current = 'zh';

  /* ---------- 自动识别 ---------- */
  function detect() {
    // ① URL 参数（方便手动指定，例如分享链接带 ?lang=en）
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q) {
        const v = q.toLowerCase();
        if (v.indexOf('en') === 0) return 'en';
        if (v.indexOf('zh') === 0 || v.indexOf('cn') === 0) return 'zh';
      }
    } catch (e) { /* 忽略 */ }

    // ② 用户上次的手动选择
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (e) { /* 隐私模式下可能不可用 */ }

    // ③ 自动识别：非中国大陆 → 英文
    try {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      if (tz && !MAINLAND_TZ.test(tz)) return 'en';
    } catch (e) { /* 忽略 */ }
    try {
      const langs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || ''];
      const first = String(langs[0] || '').toLowerCase();
      if (first && first.indexOf('zh') !== 0) return 'en';
    } catch (e) { /* 忽略 */ }

    return 'zh';
  }

  /* ---------- 取词 ---------- */
  function t(key, vars) {
    const table = DICT[current] || DICT.zh;
    let s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : (DICT.zh[key] || key);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function pick(map, text) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return '';
    return map[s] || map[s.toLowerCase()] || s;
  }

  /* ---------- 壁纸名称 / 标签翻译（中文界面下原样返回） ---------- */
  function trTitle(w) {
    const raw = String((w && w.title) || '');
    if (current !== 'en') return raw;
    if (w && w.titleEn) return String(w.titleEn);
    return pick(TITLE_EN, raw);
  }

  function trTag(name) {
    if (current !== 'en') return String(name == null ? '' : name);
    return pick(TAG_EN, name);
  }

  function trTags(w) {
    return ((w && w.tags) || []).map(trTag);
  }

  /* ---------- 日期格式化 ---------- */
  function fmtDate(str) {
    const parts = String(str || '').split('-');
    if (parts.length !== 3) return str || '';
    const y = parts[0];
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (current === 'en') return MONTHS_EN[m - 1] + ' ' + d + ', ' + y;
    return y + '年' + m + '月' + d + '日';
  }

  /* ---------- 应用静态文案（带 data-i18n 标记的节点） ---------- */
  function applyStatic() {
    document.documentElement.lang = current === 'en' ? 'en' : 'zh-CN';
    document.title = t('meta.title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.description'));

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const s = t(el.getAttribute('data-i18n-aria'));
      el.setAttribute('aria-label', s);
      if (!el.hasAttribute('data-i18n-notitle')) el.setAttribute('title', s);
    });

    if (langLabel) langLabel.textContent = current === 'en' ? 'EN' : '中';
  }

  /* ---------- 切换语言 ---------- */
  const langToggle = document.getElementById('langToggle');
  const langLabel = document.getElementById('langLabel');

  function set(next, remember) {
    const target = next === 'en' ? 'en' : 'zh';
    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, target); } catch (e) { /* 忽略 */ }
    }
    current = target;
    applyStatic();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
  }

  const api = {
    get lang() { return current; },
    set,
    toggle() { set(current === 'en' ? 'zh' : 'en', true); },
    t,
    title: trTitle,
    tag: trTag,
    tags: trTags,
    fmtDate,
    apply: applyStatic
  };

  window.I18N = api;

  /* ---------- 初始化 ---------- */
  current = detect();
  applyStatic();
  if (langToggle) {
    langToggle.addEventListener('click', () => api.toggle());
  }
})();
