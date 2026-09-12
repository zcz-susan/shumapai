/* ==========================================================================
   devices.js —— 设备清单页脚本
   --------------------------------------------------------------------------
   读取 data.js 中的 DEVICES 数组，渲染成设备卡片。
   设备按入手时间倒序排列（新入手的排在最前面）。
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var grid = $('deviceGrid');

  // 按入手时间倒序（'YYYY-MM' 字符串可以直接比较）
  var list = DEVICES.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
  });

  grid.innerHTML = list.map(function (d) {
    return ''
      + '<div class="device-card">'
      // 设备照片
      +   '<div class="device-img">'
      +     '<img src="' + d.image + '" alt="' + escapeHtml(d.name) + '" loading="lazy" '
      +       'onerror="this.onerror=null;this.src=imgFallback(\'设备图片\')">'
      +   '</div>'
      // 设备信息
      +   '<div class="device-body">'
      +     '<div class="card-tags"><span class="tag">' + escapeHtml(d.category) + '</span></div>'
      +     '<h3>' + escapeHtml(d.name) + '</h3>'
      +     '<p class="device-model">型号：' + escapeHtml(d.model) + '</p>'
      // 一句话评价（浅蓝底块突出显示）
      +     '<p class="device-review">“' + escapeHtml(d.review) + '”</p>'
      +     '<div class="device-date">🛒 入手时间：' + formatDate(d.date) + '</div>'
      +   '</div>'
      + '</div>';
  }).join('');
});
