/* ==========================================================================
   submit.js —— 投稿、意见反馈与社区投稿墙脚本
   --------------------------------------------------------------------------
   纯静态网站无法真正提交到服务器，这里的处理方式是：
   1. 把表单内容存到浏览器 localStorage（键名 submissions）
   2. 显示成功提示，并立刻把投稿渲染到页面下方的"大家的投稿"墙
   3. 同时提供 mailto 方式，把内容作为邮件草稿发给站长
   投稿墙 = data.js 里的 COMMUNITY_POSTS 社区示例 + 本机提交的投稿
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var tabs = document.querySelectorAll('.submit-tab');
  var forms = {
    submit: $('form-submit'),
    feedback: $('form-feedback')
  };

  /* ------------------------- 社区投稿墙 ------------------------- */
  // 内置社区示例（data.js 的 COMMUNITY_POSTS）
  function getBuiltinPosts() {
    return (typeof COMMUNITY_POSTS !== 'undefined' ? COMMUNITY_POSTS : [])
      .map(function (p) { return Object.assign({ mine: false }, p); });
  }
  // 本机 localStorage 里的投稿（type=submit）
  function getLocalMine() {
    var mine = [];
    try {
      var saved = JSON.parse(localStorage.getItem('submissions') || '[]');
      mine = saved
        .filter(function (d) { return d.type === 'submit' && d.title; })
        .map(function (d) {
          return {
            name: d.author || '匿名网友',
            category: d.category || '其他数码',
            title: d.title,
            content: d.content || '',
            date: (d.time || new Date().toISOString()).slice(0, 10),
            mine: true
          };
        });
    } catch (e) {}
    return mine;
  }
  // 按时间倒序
  function sortPosts(posts) {
    return posts.sort(function (a, b) {
      return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
    });
  }
  // 单张投稿墙卡片 HTML
  function wallCardHtml(p) {
    var excerpt = p.content.length > 110 ? p.content.slice(0, 110) + '……' : p.content;
    return ''
      + '<article class="wall-card">'
      +   '<div class="wall-head">'
      +     '<span class="wall-avatar">' + escapeHtml((p.name || '匿').charAt(0)) + '</span>'
      +     '<div class="wall-who"><strong>' + escapeHtml(p.name || '匿名网友') + '</strong>'
      +       '<span class="wall-meta"><span class="tag">' + escapeHtml(p.category || '其他数码')
      +         '</span><time>' + formatDate(p.date) + '</time></span></div>'
      +     '<span class="wall-badge' + (p.mine ? ' mine' : '') + '">'
      +       (p.mine ? '我的投稿' : '社区投稿') + '</span>'
      +   '</div>'
      +   '<h3>' + escapeHtml(p.title) + '</h3>'
      +   '<p>' + escapeHtml(excerpt) + '</p>'
      + '</article>';
  }
  function renderWallWith(posts) {
    var box = $('communityWall');
    if (!box) return;
    box.innerHTML = posts.map(wallCardHtml).join('');
  }
  // 渲染：先用「内置种子 + 本机投稿」即时出图，再异步拉云端合并覆盖
  function renderWall() {
    var box = $('communityWall');
    if (!box) return;
    renderWallWith(sortPosts(getBuiltinPosts().concat(getLocalMine())));
    cloudGetSubmissions().then(function (cloud) {
      if (cloud == null) return;   // 未配置/失败，保持本地
      // 合并：内置种子 + 云端 + 本机投稿，按 标题+昵称 去重
      var all = getBuiltinPosts().concat(cloud).concat(getLocalMine());
      var seen = {};
      var dedup = all.filter(function (p) {
        var key = (p.title || '') + '|' + (p.name || '');
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      renderWallWith(sortPosts(dedup));
    });
  }
  renderWall();

  /* ------------------------- 标签切换 ------------------------- */
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      Object.keys(forms).forEach(function (k) { forms[k].classList.toggle('active', k === tab.dataset.tab); });
      $('submitSuccess').classList.remove('show');
    });
  });

  // 把表单数据序列化
  function serialize(form) {
    var data = {};
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      data[el.name] = el.value;
    });
    return data;
  }

  // 从成功页返回，重新显示表单
  function showFormsAgain() {
    $('form-submit').style.display = '';
    $('form-feedback').style.display = '';
    $('submitTabs').style.display = '';
    $('submitSuccess').classList.remove('show');
    forms.submit.reset();
    forms.feedback.reset();
    // 默认回到投稿标签
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === 'submit'); });
    Object.keys(forms).forEach(function (k) {
      forms[k].classList.toggle('active', k === 'submit');
    });
  }
  $('writeAgainBtn').addEventListener('click', function () {
    showFormsAgain();
    document.getElementById('submitTop').scrollIntoView({ behavior: 'smooth' });
  });

  // 通用提交处理
  function handleSubmit(form, type) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = serialize(form);
      data.type = type;
      data.time = new Date().toISOString();

      // 1. 存到 localStorage（站长可在浏览器控制台执行 localStorage.getItem('submissions') 查看）
      try {
        var list = JSON.parse(localStorage.getItem('submissions') || '[]');
        list.push(data);
        localStorage.setItem('submissions', JSON.stringify(list));
      } catch (err) {}

      // 2. 刷新社区投稿墙（本机投稿立刻上墙）
      renderWall();

      // 2.5 异步提交到云端（让所有访客都能看到这条投稿）
      cloudAddSubmission(data).then(function (ok) {
        if (ok && type === 'submit') renderWall();
      });

      // 3. 准备邮件内容（可选：通过 mailto 打开邮件客户端）
      var subject = encodeURIComponent('[' + (type === 'submit' ? '投稿' : '反馈') + '] ' + (data.title || data.type));
      var body = encodeURIComponent(
        '昵称：' + (data.author || '匿名') + '\n' +
        '邮箱：' + (data.email || '未填写') + '\n' +
        '时间：' + new Date().toLocaleString() + '\n' +
        (data.category ? '分类：' + data.category + '\n' : '') +
        (data.title ? '标题：' + data.title + '\n' : '') +
        '\n' + (data.content || '') + '\n\n' +
        '—— 来自数码派投稿/反馈页'
      );

      // 4. 显示成功页面
      $('form-submit').style.display = 'none';
      $('form-feedback').style.display = 'none';
      $('submitTabs').style.display = 'none';

      var success = $('submitSuccess');
      if (type === 'submit') {
        $('successTitle').textContent = '投稿已收到，已上墙！';
        $('successMsg').textContent = '感谢你的投稿，它已经出现在下方"大家的投稿"墙里；我也会尽快阅读并通过邮件与你联系。';
        $('viewWallBtn').style.display = '';
      } else {
        $('successTitle').textContent = '反馈已提交！';
        $('successMsg').textContent = '感谢你的建议，我会认真考虑并改进。';
        $('viewWallBtn').style.display = 'none';
      }
      success.classList.add('show');

      // 5. 尝试打开邮件客户端（不阻塞成功提示）
      try {
        window.location.href = 'mailto:' + SITE.email + '?subject=' + subject + '&body=' + body;
      } catch (err) {}

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  handleSubmit(forms.submit, 'submit');
  handleSubmit(forms.feedback, 'feedback');
});
