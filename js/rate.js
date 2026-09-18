/* ==========================================================================
   rate.js —— 手机评分榜页面脚本
   --------------------------------------------------------------------------
   负责：读取 data.js 的 PHONES 数据，渲染排行榜表格与逐机点评卡片；
        点击表头可按对应维度重新排序（再次点击降序/升序切换），
        默认按总分降序。总分 = 五维平均分，由本文件计算，不写死。
   依赖：data.js（PHONES）、common.js（escapeHtml / $）
   ========================================================================== */

(function () {

  /* 五个评分维度定义：key 对应 PHONES.scores 字段，label 用于页面显示 */
  var DIMS = [
    { key: 'perf',    label: '性能' },
    { key: 'screen',  label: '屏幕' },
    { key: 'camera',  label: '影像' },
    { key: 'battery', label: '续航' },
    { key: 'value',   label: '性价比' }
  ];

  /* 当前排序状态：默认按总分降序 */
  var sortKey = 'total';
  var sortAsc = false;

  /* 给每台手机补充总分（五维平均分，四舍五入保留一位小数），只算一次 */
  var phones = PHONES.map(function (p) {
    var s = p.scores;
    var total = Math.round((s.perf + s.screen + s.camera + s.battery + s.value) / 5 * 10) / 10;
    return {
      id: p.id, name: p.name, price: p.price, scores: s,
      comment: p.comment, total: total
    };
  });

  /* 按总分算名次（奖牌徽章用，与表格当前按哪列排序无关） */
  var byTotal = phones.slice().sort(function (a, b) { return b.total - a.total; });
  byTotal.forEach(function (p, i) { p.totalRank = i + 1; });

  /* 取当前排序后的列表 */
  function sorted() {
    return phones.slice().sort(function (a, b) {
      var va = sortKey === 'total' ? a.total : a.scores[sortKey];
      var vb = sortKey === 'total' ? b.total : b.scores[sortKey];
      return sortAsc ? va - vb : vb - va;
    });
  }

  /* 行首名次：总分前 3 名用奖牌色圆徽章，其余纯数字 */
  function rankHtml(p) {
    if (p.totalRank <= 3) {
      return '<span class="rate-medal top-' + p.totalRank + '">' + p.totalRank + '</span>';
    }
    return '<span class="rate-rank-plain">' + p.totalRank + '</span>';
  }

  /* ---------- 渲染排行榜表格 ---------- */
  function renderTable() {
    var rows = sorted().map(function (p) {
      var tds = DIMS.map(function (d) {
        return '<td>' + p.scores[d.key].toFixed(1) + '</td>';
      }).join('');
      return '<tr>'
        + '<td>' + rankHtml(p) + '</td>'
        + '<td class="rate-phone-name">' + escapeHtml(p.name) + '</td>'
        + '<td class="rate-price">' + escapeHtml(p.price) + '</td>'
        + tds
        + '<td class="rate-total">' + p.total.toFixed(1) + '</td>'
        + '</tr>';
    }).join('');
    $('rateTableBody').innerHTML = rows;
    syncHead();
  }

  /* 表头排序指示：当前排序列高亮并带 ▲/▼ 箭头 */
  function syncHead() {
    document.querySelectorAll('#rateTable th[data-key]').forEach(function (th) {
      var on = th.getAttribute('data-key') === sortKey;
      th.classList.toggle('sorted', on);
      th.textContent = th.getAttribute('data-label') + (on ? (sortAsc ? ' ▲' : ' ▼') : '');
    });
  }

  /* ---------- 渲染逐机点评卡片（固定按总分降序展示） ---------- */
  function renderCards() {
    var html = byTotal.map(function (p) {
      // 五维各一条进度条：宽度 = 分数 × 10%，条上方标维度名与分数
      var bars = DIMS.map(function (d) {
        var v = p.scores[d.key];
        return '<div class="rate-bar-item">'
          + '<div class="rate-bar-label"><span>' + d.label + '</span><span>' + v.toFixed(1) + '</span></div>'
          + '<div class="rate-bar-track"><div class="rate-bar-fill" style="width:' + (v * 10) + '%"></div></div>'
          + '</div>';
      }).join('');
      return '<div class="rate-card">'
        + '<div class="rate-card-main">'
        +   '<div class="rate-card-head"><h3>' + escapeHtml(p.name) + '</h3>'
        +   '<span class="rate-card-price">' + escapeHtml(p.price) + '</span></div>'
        +   '<p class="rate-card-comment">' + escapeHtml(p.comment) + '</p>'
        +   '<div class="rate-bars">' + bars + '</div>'
        + '</div>'
        + '<div class="rate-card-total">'
        +   '<div class="num">' + p.total.toFixed(1) + '</div>'
        +   '<div class="lbl">综合总分</div>'
        + '</div>'
        + '</div>';
    }).join('');
    $('rateCards').innerHTML = html;
  }

  /* ---------- 绑定表头点击排序 ---------- */
  function bindSort() {
    document.querySelectorAll('#rateTable th[data-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-key');
        if (sortKey === key) {
          sortAsc = !sortAsc;   // 同一列再点一次：降序 / 升序切换
        } else {
          sortKey = key;        // 换一列：默认从高到低
          sortAsc = false;
        }
        renderTable();
      });
    });
  }

  /* 页面就绪后渲染（脚本在 body 末尾引入，元素已存在） */
  renderTable();
  renderCards();
  bindSort();

})();
