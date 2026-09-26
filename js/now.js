/* ==========================================================================
   now.js —— 「现在」页脚本
   渲染 data.js 里的 NOW 数据。「在用」区直接取 DEVICES 设备清单的真实数据，
   两处不用重复维护；其余区块（在想等）在 data.js 的 NOW.sections 里维护。
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  $('nowUpdated').textContent = formatDate(NOW.updated);

  // 常驻城市：留空则不显示
  var locEl = $('nowLocation');
  if (NOW.location) {
    locEl.textContent = ' · 常驻 ' + NOW.location;
  } else {
    locEl.remove();
  }
  $('nowIntro').textContent = NOW.intro;

  // 「在用」从设备清单取前 4 件（按数组顺序），note 用一句话评价
  var usingSection = {
    title: '在用',
    items: DEVICES.slice(0, 4).map(function (d) {
      return { text: d.model, note: d.review, href: 'devices.html' };
    })
  };
  var sections = [usingSection].concat(NOW.sections);

  $('nowSections').innerHTML = sections.map(function (sec) {
    var items = sec.items.map(function (it) {
      var text = it.href
        ? '<a class="now-item-text" href="' + it.href + '">' + escapeHtml(it.text) + '</a>'
        : '<span class="now-item-text">' + escapeHtml(it.text) + '</span>';
      return '<li class="now-item">'
        + text
        + '<span class="now-item-note">' + escapeHtml(it.note || '') + '</span>'
        + '</li>';
    }).join('');
    return '<section class="now-section">'
      + '<h2>' + escapeHtml(sec.title) + '</h2>'
      + '<ul>' + items + '</ul>'
      + '</section>';
  }).join('');
});
