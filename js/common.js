/* ==========================================================================
   common.js —— 全站公共脚本
   --------------------------------------------------------------------------
   负责：深色模式切换、手机端折叠菜单、导航搜索、通用工具函数、
        文章卡片 HTML 渲染、正文简易排版解析。
   依赖：data.js（需在本文件之前引入）
   ========================================================================== */

/* ------------------------- 一、通用小工具函数 ------------------------- */

/* 按 id 获取元素，写起来短一点 */
function $(id) { return document.getElementById(id); }

/* HTML 特殊字符转义，防止文章标题里的 < > & 等字符破坏页面 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* '2026-09-05' → '2026年9月5日'；'2026-08' → '2026年8月' */
function formatDate(d) {
  var parts = String(d).split('-');
  if (parts.length === 3) {
    return parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  }
  if (parts.length === 2) {
    return parts[0] + '年' + Number(parts[1]) + '月';
  }
  return d;
}

/* 简易防抖：输入框连续打字时只在停下 300ms 后执行一次搜索 */
function debounce(fn, wait) {
  var timer = null;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
  };
}

/* 图片加载失败时的兜底占位图（离线或图片服务不可用时显示，避免出现裂图） */
function imgFallback(label) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">'
    + '<rect width="100%" height="100%" fill="#dce6f7"/>'
    + '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" '
    + 'font-family="sans-serif" font-size="30" fill="#7c93bd">'
    + (label || '图片') + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* 文章按发布时间倒序排列（新的在前），多个页面共用 */
function articlesSortedByDate() {
  return ARTICLES.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
  });
}

/* ----------------------- 互动数据（本地存储） ------------------------ */
/* 纯静态站点没有后端，点赞与评论只保存在访客自己的浏览器 localStorage 中：
   dp_likes                已点赞的文章 id 映射
   dp_comments_<文章id>     该文章下访客发表的评论数组
   dp_name                 上次评论/投稿使用的昵称 */

/* 安全读取 / 写入 localStorage */
function storageRead(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
function storageWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/* ==========================================================================
   云后端集成（Supabase，可选，免实名认证）
   --------------------------------------------------------------------------
   本站默认纯静态：评论/点赞/投稿只存本机 localStorage，仅当前访客可见。
   若希望「所有访客共享」评论与点赞，请在下方 SUPABASE_CONFIG 填入你的
   Supabase 项目地址和 anon 公钥（两项都填才启用）；留空则退回纯本地存储。
   注册：https://supabase.com/ （可用 GitHub 账号直接登录，无需实名认证，
   免费版 500MB 数据库，小站够用；建表 SQL 见随附的设置说明）。
   说明：anon key 设计上就是公开给前端使用的，数据安全靠 Supabase 后台的
   RLS 行级权限策略保证（只能查/发评论，不能删改），放在 GitHub Pages 安全。
   ========================================================================== */
var SUPABASE_CONFIG = {
  url: 'https://adxmycavobnniqqjhvql.supabase.co',
  anonKey: 'sb_publishable_Q2b9CU8GRW3TpTlHrG40qg_VKPC9jIR'
};

/* 两个值都填了才视为启用云端 */
function cloudReady() {
  return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

/* 唯一访客标识：用于云端防重复点赞，存在 localStorage */
function getClientId() {
  var cid = '';
  try { cid = localStorage.getItem('dp_client_id') || ''; } catch (e) {}
  if (!cid) {
    cid = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem('dp_client_id', cid); } catch (e) {}
  }
  return cid;
}

/* 统一请求封装：path 形如 'comments?article_id=eq.1'。
   返回 { status: http码, data: 解析后的JSON }；未配置/网络错误返回 {status:0,data:null}，
   任何异常都在这里消化，调用方只需判断 status，不会打断页面 */
function cloudRequest(method, path, body) {
  if (!cloudReady()) return Promise.resolve({ status: 0, data: null });
  var url = SUPABASE_CONFIG.url.replace(/\/+$/, '') + '/rest/v1/' + path;
  var headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json'
  };
  var opt = { method: method, headers: headers };
  if (body) opt.body = JSON.stringify(body);
  return fetch(url, opt).then(function (res) {
    return res.text().then(function (text) {
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { status: res.status, data: data };
    });
  }).catch(function () { return { status: 0, data: null }; });
}

/* ---------- 云端评论（表 comments） ---------- */
/* 读取云端评论；返回 null 表示未配置/失败，调用方保持本地数据不变 */
function cloudGetComments(id) {
  return cloudRequest('GET',
    'comments?article_id=eq.' + Number(id) + '&order=created_at.asc&limit=500')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.map(function (row) {
        return { name: row.name || '热心网友', text: row.body || '', time: row.created_at || '' };
      });
    });
}
/* 新增一条云端评论；成功返回 true */
function cloudAddComment(id, comment) {
  return cloudRequest('POST', 'comments', {
    article_id: Number(id),
    name: comment.name,
    body: comment.text
  }).then(function (r) { return r.status === 201; });
}

/* ---------- 云端点赞（表 likes，一条记录 = 一个访客的一次点赞） ---------- */
/* 云端真实点赞数 = likes 表中该文章的记录数；返回 null 表示未配置/失败 */
function cloudGetLikeCount(articleId) {
  return cloudRequest('GET',
    'likes?article_id=eq.' + Number(articleId) + '&select=id')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.length;
    });
}
/* 点赞 / 取消：按 clientId 查唯一记录，存在则删、不存在则建；幂等 */
function cloudSetLike(articleId, liked) {
  var cid = getClientId();
  return cloudRequest('GET',
    'likes?article_id=eq.' + Number(articleId) + '&client_id=eq.' + encodeURIComponent(cid)
    + '&select=id&limit=1')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return false;
      var row = r.data[0];
      if (liked) {
        if (row) return true;  // 已有点赞记录，幂等成功
        return cloudRequest('POST', 'likes', {
          article_id: Number(articleId),
          client_id: cid
        }).then(function (x) { return x.status === 201; });
      }
      if (!row) return true;   // 本来就没有记录，幂等成功
      return cloudRequest('DELETE', 'likes?id=eq.' + row.id)
        .then(function (x) { return x.status >= 200 && x.status < 300; });
    });
}

/* ---------- 云端投稿（表 submissions） ---------- */
/* 读取云端投稿（仅 type=submit），按时间倒序；返回 null 表示未配置/失败 */
function cloudGetSubmissions() {
  return cloudRequest('GET',
    'submissions?type=eq.submit&order=created_at.desc&limit=200')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.map(function (row) {
        var t = row.created_at || '';
        return {
          name: row.author || '匿名网友',
          category: row.category || '其他数码',
          title: row.title || '',
          content: row.body || '',
          date: String(t).slice(0, 10)
        };
      });
    });
}
/* 新增一条云端投稿/反馈；成功返回 true */
function cloudAddSubmission(d) {
  return cloudRequest('POST', 'submissions', {
    type: d.type || 'submit',
    author: d.author || '匿名网友',
    category: d.category || '其他数码',
    title: d.title || '',
    body: d.content || ''
  }).then(function (r) { return r.status === 201; });
}

/* 点赞：基础赞数在 data.js（a.likes），本机点赞后再 +1 */
function getLikedMap() {
  var m = storageRead('dp_likes', {});
  return (m && typeof m === 'object') ? m : {};
}
function isArticleLiked(id) { return !!getLikedMap()[id]; }
function likeCount(a) { return (a.likes || 0) + (isArticleLiked(a.id) ? 1 : 0); }
function setArticleLiked(id, liked) {
  var m = getLikedMap();
  if (liked) { m[id] = 1; } else { delete m[id]; }
  storageWrite('dp_likes', m);
}

/* 评论：每篇文章一个数组，元素结构 {name, text, time} */
function getComments(id) {
  var list = storageRead('dp_comments_' + id, []);
  return Array.isArray(list) ? list : [];
}
function addComment(id, comment) {
  var list = getComments(id);
  list.push(comment);
  storageWrite('dp_comments_' + id, list);
}

/* ISO 时间 → '2026-09-12 14:30' 友好格式 */
function formatTime(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* 轻量提示条（复制链接、点赞成功等反馈用） */
var __toastTimer = null;
function showToast(msg) {
  var t = $('dpToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'dpToast';
    t.className = 'dp-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
}

/* 点赞按钮：卡片与详情页同构，统一用 data-like="文章id" 标识。
   点击后只更新局部数字，不整页重绘；同一篇文章的所有按钮一起同步。 */
function syncLikeUI(id) {
  var article = ARTICLES.filter(function (a) { return a.id === Number(id); })[0];
  var liked = isArticleLiked(id);
  document.querySelectorAll('button[data-like="' + id + '"]').forEach(function (btn) {
    btn.classList.toggle('is-liked', liked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    var num = btn.querySelector('.like-num');
    if (num && article) num.textContent = likeCount(article);
  });
}

/* 异步用云端真实赞数刷新所有该文章按钮的数字（不改 is-liked 心形态）。
   云端数 = Like 表记录数；显示数 = data.js 种子基数 a.likes + 云端数。
   未配置/失败则保持本地数字不动。 */
function syncLikeUICloud(id) {
  cloudGetLikeCount(id).then(function (n) {
    if (n == null) return;
    var article = ARTICLES.filter(function (a) { return a.id === Number(id); })[0];
    var total = (article ? (article.likes || 0) : 0) + n;
    document.querySelectorAll('button[data-like="' + id + '"] .like-num')
      .forEach(function (num) { num.textContent = total; });
  });
}

/* 批量刷新当前页面可见卡片的云端赞数与评论数（只查页面上存在的文章） */
function refreshCloudStats() {
  var ids = [];
  document.querySelectorAll('button[data-like]').forEach(function (btn) {
    var id = btn.getAttribute('data-like');
    if (ids.indexOf(id) === -1) ids.push(id);
  });
  if (!ids.length) return;
  ids.forEach(function (id) {
    syncLikeUICloud(id);
    cloudGetComments(id).then(function (list) {
      if (list == null) return;
      var n = list.length;
      document.querySelectorAll('[data-href="article.html?id=' + id + '"] .stat-comments')
        .forEach(function (el) { el.textContent = '💬 ' + n; });
    });
  });
}

function initLikeAction() {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-like]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-like');
    var liked = !isArticleLiked(id);
    /* 本地即时切换：保证 UI 零延迟反馈 */
    setArticleLiked(id, liked);
    syncLikeUI(id);
    showToast(liked ? '点赞成功，谢谢你的喜欢' : '已取消点赞');
    /* 异步同步到云端，成功后用云端真实数刷新数字 */
    cloudSetLike(id, liked).then(function (ok) {
      if (ok) syncLikeUICloud(id);
    });
  });
}

/* ----------------------- 二、文章卡片渲染（共用） ---------------------- */
/* 首页和列表页都用同一个卡片样式，改这里全站生效 */
function articleCardHtml(a) {
  // 角标优先级：未设置则不显示
  var badge = a.unboxing
    ? '<span class="card-badge badge-unbox">开箱</span>'
    : (a.hot ? '<span class="card-badge badge-hot">热门</span>' : '');

  // 标签点击跳到文章列表并自动按该标签筛选
  var tags = a.tags.map(function (t) {
    return '<a class="tag" href="articles.html?tag=' + encodeURIComponent(t) + '">'
      + escapeHtml(t) + '</a>';
  }).join('');

  return ''
    + '<article class="article-card" data-href="article.html?id=' + a.id + '">'
    +   '<a class="card-cover" href="article.html?id=' + a.id + '" aria-label="' + escapeHtml(a.title) + '">'
    +     '<img src="' + a.cover + '" alt="' + escapeHtml(a.title) + '" loading="lazy" '
    +       'onerror="this.onerror=null;this.src=imgFallback(\'文章配图\')">'
    +     badge
    +   '</a>'
    +   '<div class="card-body">'
    +     '<div class="card-tags">' + tags + '</div>'
    +     '<h3 class="card-title"><a href="article.html?id=' + a.id + '">' + escapeHtml(a.title) + '</a></h3>'
    +     '<p class="card-excerpt">' + escapeHtml(a.excerpt) + '</p>'
    +     '<div class="card-meta">'
    +       '<span class="card-date">' + formatDate(a.date) + '</span>'
    +       '<span class="card-stats">'
    +         '<span class="stat-comments" title="评论数">💬 ' + getComments(a.id).length + '</span>'
    +         '<button type="button" class="like-btn' + (isArticleLiked(a.id) ? ' is-liked' : '')
    +           '" data-like="' + a.id + '" aria-pressed="' + (isArticleLiked(a.id) ? 'true' : 'false')
    +           '" title="点赞"><span class="like-ico" aria-hidden="true">♥</span>'
    +           '<span class="like-num">' + likeCount(a) + '</span></button>'
    +       '</span>'
    +     '</div>'
    +   '</div>'
    + '</article>';
}

/* --------------- 三、正文简易排版（data.js 里 content 的格式） --------------- */
/* 支持：## 小标题 / 空行分段 / ![说明](图片) / - 列表项 / > 引用 */
function renderArticleContent(raw) {
  return raw.split(/\n{2,}/).map(function (block) {
    var text = block.trim();
    if (!text) return '';

    // 小标题
    if (text.indexOf('## ') === 0) {
      return '<h2>' + escapeHtml(text.slice(3).trim()) + '</h2>';
    }

    // 图片：![图片说明](图片地址)
    var imgMatch = text.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      return '<figure>'
        + '<img src="' + imgMatch[2] + '" alt="' + escapeHtml(imgMatch[1]) + '" '
        +   'loading="lazy" onerror="this.onerror=null;this.src=imgFallback(\'正文配图\')">'
        + '<figcaption>' + escapeHtml(imgMatch[1]) + '</figcaption>'
        + '</figure>';
    }

    // 引用块
    if (text.indexOf('> ') === 0) {
      return '<blockquote>' + escapeHtml(text.slice(2).trim()) + '</blockquote>';
    }

    // 无序列表：连续多行且每行以 “- ” 开头
    var lines = text.split('\n');
    if (lines.length > 0 && lines.every(function (l) { return /^- /.test(l.trim()); })) {
      var items = lines.map(function (l) {
        return '<li>' + escapeHtml(l.trim().slice(2)) + '</li>';
      }).join('');
      return '<ul>' + items + '</ul>';
    }

    // 普通段落
    return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

/* ------------------------ 四、深色模式切换 ---------------------------- */
function initThemeToggle() {
  var btn = $('themeToggle');
  if (!btn) return;

  // 根据当前模式刷新按钮图标（页面初始模式由 <head> 内的内联脚本设置）
  function syncIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = dark ? '☀' : '🌙';
    btn.title = dark ? '切换到浅色模式' : '切换到深色模式';
  }
  syncIcon();

  btn.addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {} // 本地记住选择
    syncIcon();
  });
}

/* ---------------------- 五、手机端折叠菜单 --------------------------- */
function initNavToggle() {
  var btn = $('navToggle');
  var menu = $('navMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', function () {
    menu.classList.toggle('open');
    btn.textContent = menu.classList.contains('open') ? '✕' : '☰';
  });

  // 点击菜单项后自动收起
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      menu.classList.remove('open');
      btn.textContent = '☰';
    }
  });
}

/* ------------------------- 六、导航栏搜索 ----------------------------- */
function initNavSearch() {
  var input = $('navSearchInput');
  var btn = $('navSearchBtn');
  if (!input) return;

  // 如果当前是文章列表页且 URL 上带搜索词，回填到输入框
  if (/articles\.html$/.test(location.pathname)) {
    var q = new URLSearchParams(location.search).get('q');
    if (q) input.value = q;
  }

  function go() {
    var kw = input.value.trim();
    location.href = 'articles.html' + (kw ? '?q=' + encodeURIComponent(kw) : '');
  }
  btn && btn.addEventListener('click', go);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') go();
  });
}

/* ---------- 七、整卡可点击：点击带 data-href 的卡片任意位置跳转 --------- */
function initCardClick() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input')) return; // 点到链接/按钮则不拦截
    var card = e.target.closest('[data-href]');
    if (card) location.href = card.getAttribute('data-href');
  });
}

/* ----------------------------- 初始化 -------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  initThemeToggle();
  initNavToggle();
  initNavSearch();
  initCardClick();
  initLikeAction();

  // 云端统计异步刷新：延迟一点，等列表/详情页脚本先把卡片渲染出来再拉云端数据
  setTimeout(refreshCloudStats, 300);

  // 页脚年份自动更新
  var yearEl = $('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 用 data.js 中的 SITE.name 填充页面里的站点名称（改一处全站生效）
  if (typeof SITE !== 'undefined') {
    var nameEl = $('siteName');
    if (nameEl) nameEl.textContent = SITE.name;
    var footerName = document.querySelector('.footer-site-name');
    if (footerName) footerName.textContent = SITE.name;
    // 把标题里的站点名统一替换成当前 SITE.name（兼容旧站名）
    document.title = document.title.replace(/深蓝数码志/g, SITE.name);
  }
});
