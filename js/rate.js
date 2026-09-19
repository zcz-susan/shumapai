/* ==========================================================================
   rate.js —— 手机实测榜单页面脚本
   --------------------------------------------------------------------------
   三个 Tab 榜单，数据全部来自 data.js（数组顺序即排名，前端不做重排）：
     gb6      Geekbench 6 单核跑分 Top10（GB6_RANKS）
     soc      SoC 综合性能天梯（SOC_LADDER）
     battery  三小时综合续航总榜（BATTERY_RANKS，六环节耗电分段堆叠条）
   依赖：data.js、common.js（escapeHtml / $）
   ========================================================================== */

(function () {

  /* 排名序号：统一两位数字补零（01、02……），前 3 名由 CSS 给金银铜色 */
  function padNo(i) {
    return (i + 1 < 10 ? '0' : '') + (i + 1);
  }

  /* 规格小标签（屏幕 / 芯片），空值不输出空标签 */
  function tagHtml(text) {
    return text ? '<i class="rk-tag">' + escapeHtml(text) + '</i>' : '';
  }

  /* ---------------- ① Geekbench 6 单核跑分 ---------------- */
  function renderGb6() {
    var max = GB6_RANKS[0].score;  // 榜首分数作为 100% 条长基准
    var html = GB6_RANKS.map(function (p, i) {
      var w = Math.round(p.score / max * 1000) / 10;
      return '<div class="rk-row">'
        + '<div class="rk-no rk-no-' + ((i < 3) ? (i + 1) : 'n') + '">' + padNo(i) + '</div>'
        + '<div class="rk-main">'
        +   '<div class="rk-line">'
        +     '<span class="rk-name">' + escapeHtml(p.name) + '</span>'
        +     '<span class="rk-tags">' + tagHtml(p.screen) + tagHtml(p.soc) + '</span>'
        +   '</div>'
        +   '<div class="rk-bar">'
        +     '<div class="rk-fill" style="width:' + w + '%"></div>'
        +     '<span class="rk-val' + (w < 18 ? ' rk-val-out' : '') + '" style="left:' + w + '%">' + p.score + '</span>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    $('listGb6').innerHTML = html;  // 只写列表容器，面板标题不动
  }

  /* ---------------- ② SoC 综合性能天梯 ---------------- */
  function renderSoc() {
    var max = SOC_LADDER[0].score;
    var html = SOC_LADDER.map(function (c, i) {
      var w = Math.round(c.score / max * 1000) / 10;
      return '<div class="rk-row">'
        + '<div class="rk-no rk-no-' + ((i < 3) ? (i + 1) : 'n') + '">' + padNo(i) + '</div>'
        + '<div class="rk-main">'
        +   '<div class="rk-line">'
        +     '<span class="rk-name">' + escapeHtml(c.name) + '</span>'
        +   '</div>'
        +   '<div class="rk-bar">'
        +     '<div class="rk-fill" style="width:' + w + '%"></div>'
        +     '<span class="rk-val' + (w < 18 ? ' rk-val-out' : '') + '" style="left:' + w + '%">' + c.score + '</span>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    $('listSoc').innerHTML = html;
  }

  /* ---------------- ③ 三小时综合续航（分段堆叠条） ---------------- */
  /* 六个测试环节的配色，顺序与 data.js 的 segs 严格对应：
     和平精英 / 购物+后台 / 哔哩哔哩 / 微博 / 微信 / 抖音；
     紫色段 = 剩余电量 */
  var SEG_COLORS = ['#4f7ce8', '#e85d6c', '#43b581', '#5aa9f0', '#f0a44a', '#9aa7b8'];
  var SEG_NAMES = ['和平精英', '购物+后台', '哔哩哔哩', '微博', '微信', '抖音'];

  function renderBattery() {
    var html = BATTERY_RANKS.map(function (p, i) {
      /* 各环节耗电与剩余电量一起按比例归一化成条宽：
         个别机型原图分项相加与剩余值有 1~9 个百分点出入，归一化后条不会溢出 */
      var used = p.segs.reduce(function (a, b) { return a + b; }, 0);
      var total = used + p.remain;
      var segsHtml = p.segs.map(function (v, j) {
        /* 太窄的段不塞数字，避免文字重叠；hover 时 title 仍可看全 */
        var showNum = v / total >= 0.045 ? v : '';
        return '<div class="rk-seg" title="' + SEG_NAMES[j] + ' 耗电 ' + v + '%"'
          + ' style="flex:' + v + ';background:' + SEG_COLORS[j] + '">' + showNum + '</div>';
      }).join('');
      return '<div class="rk-row">'
        + '<div class="rk-no rk-no-' + ((i < 3) ? (i + 1) : 'n') + '">' + padNo(i) + '</div>'
        + '<div class="rk-main">'
        +   '<div class="rk-line">'
        +     '<span class="rk-name">' + escapeHtml(p.name) + '</span>'
        +     '<span class="rk-tags">' + tagHtml(p.spec) + tagHtml(p.bat) + '</span>'
        +     '<span class="rk-remain">剩余 <b>' + p.remain + '%</b></span>'
        +   '</div>'
        +   '<div class="rk-bar rk-bar-stack">'
        +     segsHtml
        +     '<div class="rk-seg rk-seg-left" title="剩余电量 ' + p.remain + '%"'
        +       ' style="flex:' + p.remain + '">' + (p.remain >= 8 ? p.remain + '%' : '') + '</div>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    $('listBattery').innerHTML = html;  // 图例是面板里的独立元素，不能随列表一起覆盖

    /* 图例（只生成一次，颜色 / 名称与上面分段一一对应，末尾加紫色剩余电量） */
    var legend = SEG_COLORS.map(function (color, j) {
      return '<span class="rk-legend-item"><i style="background:' + color + '"></i>' + SEG_NAMES[j] + ' 0.5h</span>';
    }).join('')
      + '<span class="rk-legend-item"><i class="rk-legend-left"></i>剩余电量</span>';
    $('batteryLegend').innerHTML = legend;
  }

  /* ---------------- Tab 切换 ---------------- */
  function bindTabs() {
    document.querySelectorAll('.rk-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-rk-tab');
        document.querySelectorAll('.rk-tab').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        document.querySelectorAll('.rk-panel').forEach(function (panel) {
          panel.classList.toggle('active', panel.id === 'panel' + key.charAt(0).toUpperCase() + key.slice(1));
        });
        /* 切换后回到顶部：芯片 / 续航榜单很长，换榜时停在中间会困惑 */
        var head = document.querySelector('.rk-tabs-wrap');
        if (head) window.scrollTo({ top: head.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
      });
    });
  }

  /* 脚本在 body 末尾引入，DOM 已就绪，直接渲染 */
  renderGb6();
  renderSoc();
  renderBattery();
  bindTabs();

})();
