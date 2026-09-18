/* ==========================================================================
   article.js —— 文章详情页脚本
   --------------------------------------------------------------------------
   从 URL 读取文章编号（article.html?id=1），在 data.js 的 ARTICLES 中找到
   对应文章并渲染：标题、标签、发布时间、封面、正文、
   点赞 / 转发、网友热议、信息来源、评论区、上一篇/下一篇、相关推荐。
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

  // 5. 点赞 / 转发操作条
  var liked = isArticleLiked(article.id);
  var actionHtml =
    '<div class="article-actions">'
    +   '<button type="button" class="action-btn like-btn' + (liked ? ' is-liked' : '')
    +     '" data-like="' + article.id + '" aria-pressed="' + (liked ? 'true' : 'false') + '">'
    +     '<span class="like-ico" aria-hidden="true">♥</span><span class="like-num">'
    +     likeCount(article) + '</span><span class="action-label">点赞</span></button>'
    +   '<div class="share-wrap">'
    +     '<button type="button" class="action-btn" id="shareToggle" aria-haspopup="true">'
    +     '<span aria-hidden="true">↗</span><span class="action-label">分享</span></button>'
    +     '<div class="share-menu" id="shareMenu" role="menu">'
    +       '<button type="button" class="share-item" data-share="copy">🔗 复制链接</button>'
    +       '<a class="share-item" data-share="weibo" target="_blank" rel="noopener">📡 分享到微博</a>'
    +       '<button type="button" class="share-item" data-share="wechat">💬 微信发给好友</button>'
    +     '</div>'
    +   '</div>'
    +   '<span class="action-comments">💬 <span id="actionCommentCount">0</span> 条评论</span>'
    + '</div>';

  // 6. 网友热议（热点文章才有，内容整理自微博/小红书/抖音等公开讨论）
  var talkHtml = '';
  if (article.social && article.social.length) {
    var items = article.social.map(function (s) {
      return '<li class="talk-item">'
        + '<div class="talk-head"><span class="talk-platform p-' + platformClass(s.platform) + '">'
        + escapeHtml(s.platform) + '</span><span class="talk-name">@' + escapeHtml(s.name)
        + '</span></div>'
        + '<p>' + escapeHtml(s.text) + '</p></li>';
    }).join('');
    talkHtml =
      '<section class="hot-talk">'
      + '<h2>网友热议 · 来自微博 / 小红书 / 抖音</h2>'
      + '<ul class="talk-list">' + items + '</ul>'
      + '</section>';
  }

  // 7. 信息来源（资讯类文章标注原始报道，方便读者跳转核实）
  var sourceHtml = '';
  if (article.sourceUrl) {
    sourceHtml =
      '<aside class="source-box">'
      + '<span class="source-label">📰 信息来源</span>'
      + '<span class="source-text">本文综合自 ' + escapeHtml(article.source || '网络公开报道')
      + ' 等公开报道，由数码派整理改写，文中观点仅代表作者本人。</span>'
      + '<a class="source-link" href="' + article.sourceUrl + '" target="_blank" rel="noopener noreferrer">查看原文 →</a>'
      + '</aside>';
  }

  // 平台名转成样式类名（中文映射，避免类名出现中文）
  function platformClass(p) {
    if (p.indexOf('微博') !== -1) return 'weibo';
    if (p.indexOf('小红书') !== -1) return 'red';
    if (p.indexOf('抖音') !== -1) return 'douyin';
    if (p.indexOf('闲鱼') !== -1) return 'xianyu';
    return 'media';
  }

  // 8. 评论区骨架（列表由 renderComments 填充）
  var commentsHtml =
    '<section class="comments" id="comments">'
    + '<h2>评论 <span class="comment-count-badge" id="commentCountBadge">0</span></h2>'
    + '<form class="comment-form" id="commentForm">'
    +   '<input type="text" id="commentName" maxlength="12" placeholder="你的昵称（选填，默认：热心网友）">'
    +   '<textarea id="commentText" maxlength="500" rows="3" placeholder="说点什么吧……理性讨论，友好交流"></textarea>'
    +   '<div class="comment-form-foot">'
    +     '<span class="comment-tip">理性讨论，友好交流，请勿留下手机号、地址等隐私信息</span>'
    +     '<button type="submit" class="btn btn-primary">发表评论</button>'
    +   '</div>'
    + '</form>'
    + '<ul class="comment-list" id="commentList"></ul>'
    + '<div class="empty-state comment-empty" id="commentEmpty">'
    +   '<div class="empty-icon">💬</div><p>还没有评论，来抢沙发吧。</p>'
    + '</div>'
    + '</section>';

  // 9. 组装整页（正文部分限制阅读宽度，相关推荐通栏展示）
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

    // 点赞 / 转发
    + actionHtml
    // 信息来源
    + sourceHtml
    // 网友热议
    + talkHtml
    // 评论区
    + commentsHtml

    + navHtml
    + '</div>'

    // 相关推荐（通栏三列）
    + '<section class="related">'
    +   '<h2>相关推荐</h2>'
    +   '<div class="card-grid">' + relatedHtml + '</div>'
    + '</section>';

  /* ---------------- 评论渲染与发表 ---------------- */
  var listEl = $('commentList');
  var emptyEl = $('commentEmpty');
  var countBadge = $('commentCountBadge');
  var actionCount = $('actionCommentCount');

  function renderCommentList(list) {
    countBadge.textContent = list.length;
    actionCount.textContent = list.length;
    emptyEl.style.display = list.length ? 'none' : '';
    // 最新评论显示在最上面
    listEl.innerHTML = list.slice().reverse().map(function (c) {
      var name = c.name || '热心网友';
      return '<li class="comment-item">'
        + '<span class="comment-avatar">' + escapeHtml(name.charAt(0)) + '</span>'
        + '<div class="comment-body">'
        +   '<div class="comment-meta"><strong>' + escapeHtml(name) + '</strong>'
        +     '<time>' + escapeHtml(formatTime(c.time)) + '</time></div>'
        +   '<p>' + escapeHtml(c.text) + '</p>'
        + '</div></li>';
    }).join('');
  }
  function renderComments() {
    // 先用本地评论即时占位渲染，保证页面立刻有内容
    var local = getComments(article.id);
    if (local.length) {
      renderCommentList(local);
    } else {
      // 本地没有：先显示"加载中"，云端可能还有其他访客的评论
      listEl.innerHTML = '<li class="comment-loading">正在加载评论…</li>';
      emptyEl.style.display = 'none';
      countBadge.textContent = '0';
      actionCount.textContent = '0';
    }
    // 异步拉云端评论，成功后覆盖（云端为准，让所有访客看到同一份）
    cloudGetComments(article.id).then(function (cloud) {
      if (cloud == null) {
        // 未配置云端或请求失败：本地为空则显示空状态
        if (!local.length) {
          listEl.innerHTML = '';
          emptyEl.style.display = '';
        }
        return;
      }
      renderCommentList(cloud);
    });
  }
  renderComments();

  // 回填昵称：已登录用户用账号昵称（只读），未登录回填上次用过的昵称
  var nameInput = $('commentName');
  function applyAuthName() {
    var session = (typeof getAuthSession === 'function') ? getAuthSession() : null;
    var nick = session && session.user ? session.user.nickname : '';
    if (nick) {
      // 登录态：昵称优先于 dp_name，输入框锁定不可改
      nameInput.value = nick;
      nameInput.readOnly = true;
      nameInput.placeholder = '已登录：' + nick;
    } else {
      // 未登录：维持原有 dp_name 逻辑
      nameInput.readOnly = false;
      nameInput.placeholder = '你的昵称（选填，默认：热心网友）';
      var lastName = storageRead('dp_name', '');
      nameInput.value = lastName || '';
    }
  }
  applyAuthName();
  // 弹窗里登录 / 退出后，common.js 会广播 dp_auth_change，这里同步刷新
  document.addEventListener('dp_auth_change', applyAuthName);

  $('commentForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('commentText').value.trim();
    if (!text) { showToast('评论内容不能为空'); return; }
    var name = nameInput.value.trim() || '热心网友';
    var comment = { name: name, text: text, time: new Date().toISOString() };
    addComment(article.id, comment);   // 1. 本地存（即时显示）
    storageWrite('dp_name', name);
    $('commentText').value = '';
    renderComments();                   // 2. 本地数据立刻刷出来
    showToast('评论发表成功');
    // 3. 异步写入云端，成功后用云端数据再刷一次（保证所有访客都看到）
    cloudAddComment(article.id, comment).then(function (ok) {
      if (ok) renderComments();
    });
    // 同步卡片（相关推荐区）上的评论数
    document.querySelectorAll('[data-href="article.html?id=' + article.id + '"] .stat-comments')
      .forEach(function (el) { el.textContent = '💬 ' + getComments(article.id).length; });
  });

  /* ---------------- 转发：复制链接 / 微博 / 微信 ---------------- */
  var shareToggle = $('shareToggle');
  var shareMenu = $('shareMenu');

  shareToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    shareMenu.classList.toggle('open');
  });
  // 点击菜单外区域收起
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.share-wrap')) shareMenu.classList.remove('open');
  });

  // 当前文章的完整链接与分享文案
  function pageUrl() { return location.href; }
  function shareTitle() { return article.title + ' - 数码派｜记录真实的数码生活'; }

  // 微博分享直接挂真实链接（支持新标签页打开 / 中键 / 右键复制）
  var weiboLink = document.querySelector('[data-share="weibo"]');
  if (weiboLink) {
    weiboLink.href = 'https://service.weibo.com/share/share.php?url='
      + encodeURIComponent(pageUrl()) + '&title=' + encodeURIComponent(shareTitle());
  }

  // 复制到剪贴板（新 API 失败时用旧方案兜底）
  function copyText(text, ok, fail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text, ok, fail); });
    } else {
      legacyCopy(text, ok, fail);
    }
  }
  function legacyCopy(text, ok, fail) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy') ? ok() : fail(); }
    catch (err) { fail(); }
    document.body.removeChild(ta);
  }

  shareMenu.addEventListener('click', function (e) {
    var item = e.target.closest('[data-share]');
    if (!item) return;
    var type = item.getAttribute('data-share');

    if (type === 'copy') {
      copyText(pageUrl(), function () { showToast('链接已复制，快去分享吧'); },
        function () { showToast('复制失败，请手动复制地址栏链接'); });
    } else if (type === 'wechat') {
      copyText(pageUrl(), function () { showToast('链接已复制，去微信粘贴给好友吧'); },
        function () { showToast('复制失败，请手动复制地址栏链接'); });
    }
    // 微博项为真实 <a href target="_blank">，默认行为即打开分享窗，无需 JS 处理
    if (type !== 'weibo') shareMenu.classList.remove('open');
  });

  window.scrollTo(0, 0);
})();
