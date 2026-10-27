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
      'modal.copy': '复制链接',
      'modal.copied': '链接已复制',
      'modal.copyFail': '复制失败，请长按链接手动复制',
      'modal.guide': '壁纸下载教程',
      'modal.noLink': '这张壁纸还没有填写下载链接，站长上传中…',

      'nav.wallpapers': '壁纸',
      'nav.tutorial': '教程',
      'admin.aria': '壁纸管理后台',

      'tut.title': '使用教程',
      'tut.sub': '交互壁纸设置教程，轻松几步即可使用',
      'tut.step1.title': '前往网站进行签名',
      'tut.step1.desc': '在手机浏览器中打开下方签名网站，按网站提示完成签名操作：',
      'tut.step1.link': 'https://xb.ioszj.cn/mfb.php',
      'tut.step2.title': '下载导入工具',
      'tut.step2.desc': '按手机系统版本选择对应的工具，下载并安装。',
      'tut.step2.link': '获取工具',
      'tut.step3.title': '下载 .tendies 壁纸文件并导入',
      'tut.step3.desc': '获取对应的 .tendies 壁纸文件，按提示导入即可使用。',
      'tut.guides': '教程',
      'tut.guide.download': '壁纸下载教程',
      'tut.guide.downloadSub': '10 步图文 · 从网盘保存到「文件」',
      'tut.guide.import': '壁纸导入教程',
      'tut.guide.importSub': '19 步图文 · 从签名到导入生效',
      'tut.video': '视频教程',
      'tut.faq': '常见问题',
      'tut.q1': 'Q：安装后提示「未受信任的开发者」怎么办？',
      'tut.a1': 'A：打开手机「设置 → 通用 → VPN 与设备管理」，找到对应的开发者描述文件，点击「信任」即可正常使用。',
      'tut.q2': 'Q：使用一段时间后 App 打不开了（掉签）？',
      'tut.a2': 'A：说明签名已过期，重新回到第 1 步的签名网站再次签名即可恢复。',
      'tut.q3': 'Q：下载链接失效了怎么办？',
      'tut.a3': 'A：可稍后再试或刷新页面；如果长期失效可联系站长更新链接。',

      'guide.title': "壁纸下载教程",
      'guide.sub': "共 10 步 · 左右滑动查看 · 点击图片可看大图",
      'guide.back': "返回",
      'guide.zoom': "查看大图",
      'guide.close': "关闭",
      'guide.prev': "上一步",
      'guide.next': "下一步",
      'guide.s1.title': "点击「获取壁纸文件」",
      'guide.s1.desc': "打开任意壁纸详情，点「获取壁纸文件」，会跳转到百度网盘的分享页面。",
      'guide.s2.title': "点页面底部的「去APP保存」",
      'guide.s2.desc': "网页版网盘无法直接保存文件，点底部的蓝色「去APP保存」按钮。",
      'guide.s3.title': "安装「百度网盘」App",
      'guide.s3.desc': "若未安装，会跳到 App Store，搜索「baidu netdisk」点云朵图标安装；已安装可跳过这步。",
      'guide.s4.title': "回到本站点「复制链接」",
      'guide.s4.desc': "重新打开壁纸详情，点「复制链接」，然后打开百度网盘 App。",
      'guide.s5.title': "在网盘里点「保存」",
      'guide.s5.desc': "网盘会读取剪贴板里的链接并弹出分享页，确认文件已勾选，点右下角蓝色「保存」。",
      'guide.s6.title': "保存成功 → 点「查看」",
      'guide.s6.desc': "出现「保存成功」提示后，点蓝色「查看」进入「我的资源」。",
      'guide.s7.title': "勾选文件 → 点「下载」",
      'guide.s7.desc': "在转存列表里勾选刚保存的文件，点底部「下载」。",
      'guide.s8.title': "下载完成 → 点「查看」",
      'guide.s8.desc': "底部出现「下载完成」提示后，点「查看」打开下载任务列表。",
      'guide.s9.title': "点「打开方式」",
      'guide.s9.desc': "在下载列表里，点底部工具栏的「打开方式」。",
      'guide.s10.title': "选择「Save to Files」",
      'guide.s10.desc': "选择「Save to Files」存到「文件」App，之后用导入工具导入即可。",
      'imp.title': "壁纸导入教程",
      'imp.sub': "共 19 步 · 左右滑动查看 · 点击图片可看大图",
      'imp.s1.title': "在 Safari 打开签名网站",
      'imp.s1.desc': "用 Safari（不要用 App 自带浏览器）打开签名页面，点绿色的「1: 先安装这个配置文件」。",
      'imp.s2.title': "点「允许」",
      'imp.s2.desc': "Safari 询问是否下载描述文件，点「允许」。",
      'imp.s3.title': "打开 设置 → 通用",
      'imp.s3.desc': "打开「设置」，进入「通用」，点「VPN 与设备管理」。",
      'imp.s4.title': "点刚下载的描述文件",
      'imp.s4.desc': "在「配置描述文件」里，点刚下载的「免费企业证书屏蔽验证」。",
      'imp.s5.title': "点「安装」",
      'imp.s5.desc': "点右上角「安装」并确认。这个描述文件之后不要删除，否则 App 会闪退。",
      'imp.s6.title': "选一个免费证书",
      'imp.s6.desc': "回到签名页面，任选一个免费证书（例如【证书12】）安装签名 App。",
      'imp.s7.title': "打开已安装的 App",
      'imp.s7.desc': "当下载的 App 出现云朵标签，就删掉它，换一个其他的版本。",
      'imp.s8.title': "「未受信任的开发者」提示",
      'imp.s8.desc': "iOS 会提示「未受信任的企业级开发者」，这是正常的。点「取消」，下一步去信任开发者。",
      'imp.s9.title': "点底部的企业级 App",
      'imp.s9.desc': "进入 设置 → 通用 → VPN 与设备管理，点最下面的企业级 App（Beihang University）。",
      'imp.s10.title': "点「信任」",
      'imp.s10.desc': "点「信任 Beihang University」，在弹窗中确认。",
      'imp.s11.title': "同意用户协议",
      'imp.s11.desc': "打开小白签 PRO，阅读协议后点「确认并进入」。",
      'imp.s12.title': "获取设备 UDID",
      'imp.s12.desc': "出现获取 UDID 的提示时，点「立即获取」。",
      'imp.s13.title': "安装 UDID 描述文件",
      'imp.s13.desc': "会下载一个「小白签 APP 获取设备 UDID」描述文件，到 设置 → VPN 与设备管理 里安装。",
      'imp.s14.title': "打开底部「文件」页",
      'imp.s14.desc': "在小白签底部点「文件」，再打开「下载」目录。",
      'imp.s15.title': "选择下载好的 IPA",
      'imp.s15.desc': "选择工具 IPA：iOS 17–26 用 3105，iOS 27 用 AirCard。",
      'imp.s16.title': "点「签名」",
      'imp.s16.desc': "点这个 IPA，选择「签名」，等待签名完成。",
      'imp.s17.title': "打开工具并导入",
      'imp.s17.desc': "打开签名好的工具，点「+」选择「Import .tendies」。",
      'imp.s18.title': "找到 .tendies 文件",
      'imp.s18.desc': "浏览到保存壁纸文件的目录（一般是「下载」），选中该 .tendies 文件。",
      'imp.s19.title': "点「Apply」",
      'imp.s19.desc': "点「Apply」。之后到 设置 → 墙纸 → 添加新墙纸 → 收藏 即可使用；iOS 26 以上需先设置一张自带的收藏壁纸。",

      'inapp.hint': '点这里',
      'inapp.title': '请在浏览器中打开',
      'inapp.desc': '当前应用内置浏览器无法正常下载壁纸。',
      'inapp.step1': '点击右上角的「•••」',
      'inapp.step2': '选择「在浏览器中打开」',
      'inapp.continue': '继续在应用内浏览'
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
      'modal.copy': 'Copy link',
      'modal.copied': 'Link copied',
      'modal.copyFail': 'Copy failed — long-press the link to copy it',
      'modal.guide': 'Download guide',
      'modal.noLink': 'No download link yet — the author is still uploading…',

      'nav.wallpapers': 'Wallpapers',
      'nav.tutorial': 'Guide',
      'admin.aria': 'Wallpaper admin',

      'tut.title': 'User Guide',
      'tut.sub': 'Set up interactive wallpapers in a few easy steps',
      'tut.step1.title': 'Sign in on the signing site',
      'tut.step1.desc': 'Open the signing site below in your mobile browser and follow its instructions:',
      'tut.step1.link': 'https://xb.ioszj.cn/mfb.php',
      'tut.step2.title': 'Download the import tool',
      'tut.step2.desc': 'Pick the tool that matches your iOS version, then download and install it.',
      'tut.step2.link': 'Get the tool',
      'tut.step3.title': 'Download the .tendies wallpaper file and import it',
      'tut.step3.desc': 'Get the matching .tendies wallpaper file and import it as prompted.',
      'tut.guides': 'Tutorial',
      'tut.guide.download': 'Download guide',
      'tut.guide.downloadSub': '10 steps · from Netdisk to Files',
      'tut.guide.import': 'Import guide',
      'tut.guide.importSub': '19 steps · from signing to applying',
      'tut.video': 'Video tutorial',
      'tut.faq': 'FAQ',
      'tut.q1': 'Q: After installing, it says “Untrusted Developer”. What should I do?',
      'tut.a1': 'A: Go to Settings → General → VPN & Device Management on your phone, find the matching developer profile and tap “Trust”.',
      'tut.q2': 'Q: The app stopped opening after a while (revoked certificate)?',
      'tut.a2': 'A: The signature has expired. Go back to step 1 and sign it again on the signing site.',
      'tut.q3': 'Q: What if a download link stops working?',
      'tut.a3': 'A: Try again later or refresh the page. If it stays broken, contact the site owner to update the link.',

      'guide.title': "How to download",
      'guide.sub': "10 steps · swipe sideways · tap an image to enlarge",
      'guide.back': "Back",
      'guide.zoom': "Enlarge",
      'guide.close': "Close",
      'guide.prev': "Previous step",
      'guide.next': "Next step",
      'guide.s1.title': "Tap “Get wallpaper file”",
      'guide.s1.desc': "Open any wallpaper and tap “Get wallpaper file”. The Baidu Netdisk share page opens.",
      'guide.s2.title': "Tap the blue button at the bottom",
      'guide.s2.desc': "The web version cannot save files. Tap the blue “Save in app” button at the bottom of the share page.",
      'guide.s3.title': "Install Baidu Netdisk",
      'guide.s3.desc': "If the app is not installed yet, the App Store opens. Search “baidu netdisk” and tap the cloud icon to install. Skip this if it is already installed.",
      'guide.s4.title': "Tap “Copy link”",
      'guide.s4.desc': "Go back to the wallpaper and tap “Copy link”, then open the Baidu Netdisk app.",
      'guide.s5.title': "Tap the blue “Save” button",
      'guide.s5.desc': "Baidu Netdisk reads the link from your clipboard and shows the shared file. Keep it selected and tap the blue “Save” button at the bottom right.",
      'guide.s6.title': "Saved → tap “View”",
      'guide.s6.desc': "When “Saved successfully” appears, tap the blue “View” button to open My Resources.",
      'guide.s7.title': "Select the file → tap “Download”",
      'guide.s7.desc': "Tick the file you just saved, then tap “Download” at the bottom of the list.",
      'guide.s8.title': "Downloaded → tap “View”",
      'guide.s8.desc': "When the “Download complete” hint appears at the bottom, tap “View”.",
      'guide.s9.title': "Tap “Open with”",
      'guide.s9.desc': "In the download list, tap “Open with” in the bottom toolbar.",
      'guide.s10.title': "Choose “Save to Files”",
      'guide.s10.desc': "Pick “Save to Files” to store the wallpaper in the Files app, then import it with the import tool and you are done.",
      'imp.title': "How to import",
      'imp.sub': "19 steps · swipe sideways · tap an image to enlarge",
      'imp.s1.title': "Open the signing site in Safari",
      'imp.s1.desc': "Open the signing page in Safari (not an in-app browser) and tap the green “1: Install this profile” button.",
      'imp.s2.title': "Tap “Allow”",
      'imp.s2.desc': "Safari asks whether to download a configuration profile — tap “Allow”.",
      'imp.s3.title': "Open Settings → General",
      'imp.s3.desc': "Open Settings, go to General, then tap “VPN & Device Management”.",
      'imp.s4.title': "Tap the downloaded profile",
      'imp.s4.desc': "Under Configuration Profiles, tap the “免费企业证书屏蔽验证” profile you just downloaded.",
      'imp.s5.title': "Tap “Install”",
      'imp.s5.desc': "Tap “Install” at the top right and confirm. Do not remove this profile later, or the app will crash.",
      'imp.s6.title': "Pick a free certificate",
      'imp.s6.desc': "Back on the signing page, choose any free certificate (for example 【证书12】) to install the signing app.",
      'imp.s7.title': "Open the installed app",
      'imp.s7.desc': "If the downloaded app shows a cloud icon, delete it and try another certificate version.",
      'imp.s8.title': "“Untrusted Developer” alert",
      'imp.s8.desc': "iOS blocks the app with “Untrusted Enterprise Developer” — expected. Tap “Cancel” and trust the developer next.",
      'imp.s9.title': "Tap the enterprise app",
      'imp.s9.desc': "Go to Settings → General → VPN & Device Management and tap the enterprise app at the bottom (Beihang University).",
      'imp.s10.title': "Tap “Trust”",
      'imp.s10.desc': "Tap “Trust Beihang University” and confirm in the popup.",
      'imp.s11.title': "Accept the agreement",
      'imp.s11.desc': "Open 小白签 PRO, read the agreement and tap “确认并进入” (Agree and continue).",
      'imp.s12.title': "Get the device UDID",
      'imp.s12.desc': "When the UDID prompt appears, tap “立即获取” (Get it now).",
      'imp.s13.title': "Install the UDID profile",
      'imp.s13.desc': "A “小白签 APP 获取设备 UDID” profile is downloaded — install it in Settings → VPN & Device Management.",
      'imp.s14.title': "Open the Files tab",
      'imp.s14.desc': "In 小白签, tap “文件” (Files) at the bottom, then open the “下载” (Downloads) folder.",
      'imp.s15.title': "Select the IPA you downloaded",
      'imp.s15.desc': "Pick the tool IPA: 3105 for iOS 17–26, AirCard for iOS 27.",
      'imp.s16.title': "Tap “签名” (Sign)",
      'imp.s16.desc': "Tap the IPA, then choose “签名” (Sign) and wait until signing finishes.",
      'imp.s17.title': "Open the tool and import",
      'imp.s17.desc': "Open the signed tool, tap “+” and choose “Import .tendies”.",
      'imp.s18.title': "Find the .tendies file",
      'imp.s18.desc': "Browse to where the wallpaper file was saved (usually Downloads) and select the .tendies file.",
      'imp.s19.title': "Tap “Apply”",
      'imp.s19.desc': "Tap “Apply”. Then go to Settings → Wallpaper → Add New Wallpaper → Collections to use it. On iOS 26+ set a built-in Collections wallpaper once first.",

      'inapp.hint': 'Tap here',
      'inapp.title': 'Open in browser',
      'inapp.desc': 'The built-in browser cannot download wallpapers properly.',
      'inapp.step1': 'Tap the ••• menu at the top right',
      'inapp.step2': 'Choose “Open in browser”',
      'inapp.continue': 'Continue anyway'
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
    '帕瓦': 'Power',
    '艾莉丝': 'Eris',
    '玛奇玛': 'Makima',
    '噬魂师': 'Soul Eater',
    '玛丽': 'Marie',
    '伊芙琳': 'Evelyn Chevalier',
    '南宫羽': 'Nangong Yu',
    '早川秋': 'Aki Hayakawa',
    '2B': '2B',
    'Hide': 'Hide'
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
    '电锯人': 'Chainsaw Man',
    '无职转生': 'Mushoku Tensei',
    '噬魂师': 'Soul Eater',
    '尼尔：机械纪元': 'NieR:Automata'
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
