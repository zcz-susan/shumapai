/* ==========================================================================
   hot.js —— 热榜页面脚本
   --------------------------------------------------------------------------
   负责：把全站文章按热度降序排列并渲染榜单。
        热度 = data.js 基础赞数（a.likes）+ 云端真实点赞数；
        先按基础赞数渲染，300ms 后逐篇异步拉云端数，
        全部返回后重排 + 重渲染一次；云端不可用则保持基础排序。
   依赖：data.js（ARTICLES）、common.js（cloudGetLikeCount / escapeHtml / formatDate / $）
   ========================================================================== */

(function () {

  /* 组装榜单数据：base 是基础赞数，heat 是当前热度（初始等于基础值） */
  var items = ARTICLES.map(function (a) {
    return {
      id: a.id,
      title: a.title,
      tags: a.tags || [],
      date: a.date,
      base: a.likes || 0,   // data.js 基础赞数
      heat: a.likes || 0    // 当前热度 = 基础赞数 + 云端真实点赞数
    };
  });

  /* 渲染榜单：前 3 名金/银/铜大号徽章，4 名以后普通序号 */
  function render() {
    items.sort(function (x, y) { return y.heat - x.heat; });
    var html = items.map(function (it, i) {
      var rank = i + 1;
      var rankCls = rank === 1 ? ' top-1' : (rank === 2 ? ' top-2' : (rank === 3 ? ' top-3' : ''));
      // 小标签：细边框样式，与文章卡片底部标签一致（这里不做筛选跳转）
      var tags = it.tags.map(function (t) {
        return '<span class="hot-tag">' + escapeHtml(t) + '</span>';
      }).join('');
      return '<li class="hot-item">'
        + '<span class="hot-rank' + rankCls + '">' + rank + '</span>'
        + '<div class="hot-main">'
        +   '<a class="hot-title" href="article.html?id=' + it.id + '">' + escapeHtml(it.title) + '</a>'
        +   '<span class="hot-meta">' + tags
        +     '<span class="hot-date">' + formatDate(it.date) + '</span>'
        +   '</span>'
        + '</div>'
        + '<span class="hot-heat" title="全站热度">🔥 ' + it.heat + '</span>'
        + '</li>';
    }).join('');
    $('hotList').innerHTML = html;
  }

  /* 先按基础赞数渲染，保证云端不可用时页面也有完整榜单 */
  render();

  /* 300ms 后逐篇拉取云端真实点赞数，全部返回后统一重排 + 重渲染一次；
     云端未配置或请求失败时 cloudGetLikeCount 返回 null，此时保持基础排序 */
  setTimeout(function () {
    var left = items.length;
    items.forEach(function (it) {
      cloudGetLikeCount(it.id).then(function (n) {
        if (n != null) it.heat = it.base + n;
        left--;
        if (left === 0) render();
      });
    });
  }, 300);

})();
