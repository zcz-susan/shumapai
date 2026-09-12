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
    +     '<div class="card-meta"><span>' + formatDate(a.date) + '</span>'
    +       '<span class="more-link">阅读全文 →</span></div>'
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
