/* ==========================================================================
   submit.js —— 投稿与意见反馈页脚本
   --------------------------------------------------------------------------
   纯静态网站无法真正提交到服务器，这里的处理方式是：
   1. 把表单内容存到浏览器 localStorage（站长可在控制台看到）
   2. 显示成功提示页面
   3. 同时也提供 mailto 方式，把内容作为邮件草稿发给站长
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var tabs = document.querySelectorAll('.submit-tab');
  var forms = {
    submit: $('form-submit'),
    feedback: $('form-feedback')
  };

  // 标签切换
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

      // 2. 准备邮件内容（可选：通过 mailto 打开邮件客户端）
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

      // 3. 显示成功页面
      $('form-submit').style.display = 'none';
      $('form-feedback').style.display = 'none';
      document.querySelector('.submit-tabs').style.display = 'none';

      var success = $('submitSuccess');
      if (type === 'submit') {
        $('successTitle').textContent = '投稿已收到！';
        $('successMsg').textContent = '感谢你的投稿，我会尽快阅读并通过邮件与你联系。';
      } else {
        $('successTitle').textContent = '反馈已提交！';
        $('successMsg').textContent = '感谢你的建议，我会认真考虑并改进。';
      }
      success.classList.add('show');

      // 4. 尝试打开邮件客户端（不阻塞成功提示）
      try {
        window.location.href = 'mailto:' + SITE.email + '?subject=' + subject + '&body=' + body;
      } catch (err) {}

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  handleSubmit(forms.submit, 'submit');
  handleSubmit(forms.feedback, 'feedback');
});
