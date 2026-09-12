/* ==========================================================================
   articles.js —— 文章列表页脚本
   --------------------------------------------------------------------------
   功能：标签筛选、关键词搜索、分页；状态同步到 URL（?q=关键词&tag=标签&page=2）
   这样筛选结果可以直接复制链接分享，浏览器前进/后退也能用。
   ========================================================================== */

/* 每页显示的文章数量（想改每页篇数改这里） */
var PAGE_SIZE = 6;

/* 列表状态：从 URL 参数初始化，支持从导航搜索框和首页标签链接跳过来 */
var params = new URLSearchParams(location.search);
var state = {
  q: params.get('q') || '',
  tag: params.get('tag') || '',
  page: Math.max(1, parseInt(params.get('page'), 10) || 1)
};

var allSorted = articlesSortedByDate(); // 全部文章（按时间倒序）

/* ------------------------------ 筛选逻辑 ------------------------------ */
function getFiltered() {
  var kw = state.q.trim().toLowerCase();
  return allSorted.filter(function (a) {
    // 标签筛选
    if (state.tag && a.tags.indexOf(state.tag) === -1) return false;
    // 关键词搜索：匹配标题、摘要、标签（正文较长不参与，保证搜索轻快）
    if (kw) {
      var haystack = (a.title + a.excerpt + a.tags.join(' ')).toLowerCase();
      if (haystack.indexOf(kw) === -1) return false;
    }
    return true;
  });
}

/* ------------------------------ 渲染标签条 ----------------------------- */
function renderChips() {
  // 统计每个标签下的文章数，按数量从多到少排序
  var counts = {};
  ARTICLES.forEach(function (a) {
    a.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
  });
  var tagNames = Object.keys(counts).sort(function (x, y) {
    return counts[y] - counts[x] || (x > y ? 1 : -1);
  });

  var html = '<button class="chip' + (state.tag === '' ? ' active' : '')
    + '" data-tag="">全部</button>';
  html += tagNames.map(function (t) {
    return '<button class="chip' + (state.tag === t ? ' active' : '')
      + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t)
      + ' <span class="muted">' + counts[t] + '</span></button>';
  }).join('');

  $('filterChips').innerHTML = html;

  // 点击标签：切换筛选并回到第一页
  $('filterChips').querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.tag = chip.dataset.tag;
      state.page = 1;
      renderAll();
    });
  });
}

/* ------------------------------ 渲染文章列表 ---------------------------- */
function renderGrid() {
  var list = getFiltered();
  var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  var start = (state.page - 1) * PAGE_SIZE;
  var pageList = list.slice(start, start + PAGE_SIZE);

  // 卡片网格（3 列）
  $('articleGrid').innerHTML = pageList.map(articleCardHtml).join('');
  $('emptyState').hidden = list.length > 0;
  $('articleGrid').hidden = list.length === 0;
  $('pagination').style.display = list.length === 0 ? 'none' : 'flex';

  // 结果统计文案
  var cond = [];
  if (state.tag) cond.push('标签「' + state.tag + '」');
  if (state.q.trim()) cond.push('关键词「' + state.q.trim() + '」');
  $('resultCount').textContent = (cond.length ? cond.join('，') + '，' : '')
    + '共 ' + list.length + ' 篇';
}

/* ------------------------------- 渲染分页 ------------------------------ */
function renderPagination() {
  var total = getFiltered().length;
  var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total <= PAGE_SIZE) { $('pagination').innerHTML = ''; return; }

  var html = '';
  // 上一页
  html += '<button class="page-btn" data-page="' + (state.page - 1) + '" '
    + (state.page === 1 ? 'disabled' : '') + '>上一页</button>';

  // 页码（全部显示；文章不多，不需要省略号）
  for (var i = 1; i <= totalPages; i++) {
    html += '<button class="page-btn' + (i === state.page ? ' active' : '')
      + '" data-page="' + i + '">' + i + '</button>';
  }

  // 下一页
  html += '<button class="page-btn" data-page="' + (state.page + 1) + '" '
    + (state.page === totalPages ? 'disabled' : '') + '>下一页</button>';

  $('pagination').innerHTML = html;

  $('pagination').querySelectorAll('.page-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      state.page = Number(btn.dataset.page);
      renderAll();
      window.scrollTo({ top: 0, behavior: 'smooth' }); // 翻页后回到顶部
    });
  });
}

/* ------------------------- 把当前状态写进 URL -------------------------- */
function syncUrl() {
  var p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.tag) p.set('tag', state.tag);
  if (state.page > 1) p.set('page', state.page);
  var qs = p.toString();
  // 本地双击打开（file://）时个别浏览器会禁止修改地址栏，忽略报错即可，筛选不受影响
  try {
    history.replaceState(null, '', 'articles.html' + (qs ? '?' + qs : ''));
  } catch (e) {}
}

/* 一次性刷新标签条、列表、分页和地址栏 */
function renderAll() {
  renderChips();
  renderGrid();
  renderPagination();
  syncUrl();
}

/* ------------------------------ 搜索框事件 ----------------------------- */
$('listSearch').value = state.q;
$('listSearch').addEventListener('input', debounce(function (e) {
  state.q = e.target.value;
  state.page = 1;
  renderAll();
}, 300));

// 首次加载
renderAll();
