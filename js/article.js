/* ==========================================================================
   article.js —— 文章详情页脚本
   --------------------------------------------------------------------------
   从 URL 读取文章编号（article.html?id=1），在 data.js 的 ARTICLES 中找到
   对应文章并渲染：标题、标签、发布时间、封面、正文、上一篇/下一篇、相关推荐。
   ========================================================================== */

(function () {
  var root = $('articleRoot');

  // 1. 取出 URL 上的 id，并找到对应文章
  var id = parseInt(new URLSearchParams(location.search).get('id'), 10);
  var article = ARTICLES.filter(function (a) { return a.id === id; })[0];

  // 找不到文章（编号错误或被删除）时的提示
  if (!article) {
    root.innerHTML =
      '<div class="empty-state">'
      + '<div class="empty-icon">📄</div>'
      + '<p>这篇文章不存在或已经被移除。</p>'
      + '<p style="margin-top:16px"><a class="btn btn-primary" href="articles.html">← 返回文章列表</a></p>'
      + '</div>';
    return;
  }

  // 浏览器标签页标题同步为文章标题
  document.title = article.title + ' · ' + SITE.name;

  var sorted = articlesSortedByDate();
  var index = sorted.findIndex(function (a) { return a.id === article.id; });
  var newer = sorted[index - 1]; // 列表倒序：上一篇是更新的文章
  var older = sorted[index + 1]; // 下一篇是更旧的文章

  // 2. 标签
  var tagsHtml = article.tags.map(function (t) {
    return '<a class="tag" href="articles.html?tag=' + encodeURIComponent(t) + '">'
      + escapeHtml(t) + '</a>';
  }).join('');

  // 3. 上一篇 / 下一篇
  function navItem(a, label, cls) {
    if (!a) return '<span class="' + cls + ' muted"></span>';
    return '<a class="' + cls + '" href="article.html?id=' + a.id + '">'
      + '<span class="muted">' + label + '</span>'
      + '<span class="nav-title">' + escapeHtml(a.title) + '</span></a>';
  }
  var navHtml =
    '<nav class="article-nav">'
    + navItem(older, '← 上一篇（更旧）', 'nav-prev')
    + navItem(newer, '下一篇（更新）→', 'nav-next')
    + '</nav>';

  // 4. 相关推荐：优先共享标签的文章，不足 3 篇用最新文章补
  var related = sorted.filter(function (a) {
    return a.id !== article.id && a.tags.some(function (t) {
      return article.tags.indexOf(t) !== -1;
    });
  });
  for (var i = 0; i < sorted.length; i++) {
    if (related.length >= 3) break;
    var cand = sorted[i];
    if (cand.id === article.id || related.indexOf(cand) !== -1) continue;
    related.push(cand);
  }
  var relatedHtml = related.slice(0, 3).map(articleCardHtml).join('');

  // 5. 组装整页（正文部分限制阅读宽度，相关推荐通栏展示）
  root.innerHTML =
    '<div class="article-wrap">'
    // 面包屑
    + '<nav class="breadcrumb"><a href="index.html">首页</a> / '
    +   '<a href="articles.html">文章</a> / <span>' + escapeHtml(article.title) + '</span></nav>'

    // 标题区
    + '<header class="article-header">'
    +   '<div class="meta-tags" style="margin-bottom:10px">' + tagsHtml + '</div>'
    +   '<h1>' + escapeHtml(article.title) + '</h1>'
    +   '<div class="article-meta">'
    +     '<span>📅 发布于 ' + formatDate(article.date) + '</span>'
    +     '<span>✍️ ' + escapeHtml(SITE.author) + '</span>'
    +   '</div>'
    + '</header>'

    // 封面大图
    + '<img class="article-hero" src="' + article.cover + '" alt="' + escapeHtml(article.title)
    +   '" onerror="this.onerror=null;this.src=imgFallback(\'文章封面\')">'

    // 正文
    + '<article class="article-content" id="articleContent">'
    +   renderArticleContent(article.content)
    + '</article>'

    + navHtml
    + '</div>'

    // 相关推荐（通栏三列）
    + '<section class="related">'
    +   '<h2>相关推荐</h2>'
    +   '<div class="card-grid">' + relatedHtml + '</div>'
    + '</section>';

  window.scrollTo(0, 0);
})();
