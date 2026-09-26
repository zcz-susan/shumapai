/* ==========================================================================
   bits.js —— 「碎片」页脚本
   把 data.js 里的 BITS 短动态渲染成时间轴列表，新的在最上面。
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  $('bitsStream').innerHTML = BITS.map(function (b) {
    var img = b.image
      ? '<img class="bit-image" src="' + b.image + '" alt="" loading="lazy"'
        + ' onerror="this.onerror=null;this.src=imgFallback(\'碎片配图\')">'
      : '';
    return '<li class="bit-item">'
      + '<div class="bit-time">'
      +   '<time>' + formatDateShort(b.date) + '</time>'
      +   '<span>' + b.time + '</span>'
      + '</div>'
      + '<div class="bit-body">'
      +   '<p>' + escapeHtml(b.text) + '</p>'
      +   img
      + '</div>'
      + '</li>';
  }).join('');
});
