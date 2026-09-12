/* ==========================================================================
   home.js —— 首页脚本
   --------------------------------------------------------------------------
   负责：1. 顶部轮播大图（自动播放、左右箭头、圆点、手机滑动）
        2. “最新文章 / 热门推荐 / 近期开箱”三个板块的卡片渲染
   ========================================================================== */

/* ----------------------------- 轮播大图 ------------------------------ */
function initCarousel() {
  var box = $('carousel');
  if (!box || !CAROUSEL.length) return;

  // 1. 拼出轮播结构：轨道 + 箭头 + 圆点
  var slidesHtml = CAROUSEL.map(function (item, i) {
    return ''
      + '<div class="carousel-slide">'
      +   '<img src="' + item.image + '" alt="' + escapeHtml(item.title) + '" '
      +     'onerror="this.onerror=null;this.src=imgFallback(\'轮播图片\')">'
      +   '<div class="carousel-caption">'
      +     '<span class="tag">' + escapeHtml(item.tag) + '</span>'
      +     '<h2>' + escapeHtml(item.title) + '</h2>'
      +     '<p>' + escapeHtml(item.desc) + '</p>'
      +     '<a class="btn" href="' + item.link + '">查看文章 →</a>'
      +   '</div>'
      + '</div>';
  }).join('');

  var dotsHtml = CAROUSEL.map(function (_, i) {
    return '<button aria-label="第' + (i + 1) + '张" data-index="' + i + '"></button>';
  }).join('');

  box.innerHTML =
    '<div class="carousel-track" id="carouselTrack">' + slidesHtml + '</div>'
    + '<button class="carousel-arrow prev" id="carouselPrev" aria-label="上一张">‹</button>'
    + '<button class="carousel-arrow next" id="carouselNext" aria-label="下一张">›</button>'
    + '<div class="carousel-dots" id="carouselDots">' + dotsHtml + '</div>';

  // 2. 切换逻辑
  var track = $('carouselTrack');
  var dots = $('carouselDots').querySelectorAll('button');
  var current = 0;
  var timer = null;
  var DELAY = 5000; // 自动播放间隔：5 秒

  function go(index) {
    current = (index + CAROUSEL.length) % CAROUSEL.length; // 循环播放
    track.style.transform = 'translateX(-' + current * 100 + '%)';
    dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
  }
  function play() { stop(); timer = setInterval(function () { go(current + 1); }, DELAY); }
  function stop() { if (timer) clearInterval(timer); }

  $('carouselPrev').addEventListener('click', function () { go(current - 1); play(); });
  $('carouselNext').addEventListener('click', function () { go(current + 1); play(); });
  dots.forEach(function (d) {
    d.addEventListener('click', function () { go(Number(d.dataset.index)); play(); });
  });

  // 鼠标悬停时暂停自动播放，移开后继续
  box.addEventListener('mouseenter', stop);
  box.addEventListener('mouseleave', play);

  // 手机端手指左右滑动切换
  var touchX = 0;
  box.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { go(current + (dx < 0 ? 1 : -1)); play(); }
  }, { passive: true });

  go(0);
  play();
}

/* --------------------------- 三个文章板块 ---------------------------- */
function initSections() {
  var sorted = articlesSortedByDate(); // 已按发布时间倒序

  // 最新文章：取前 6 篇
  $('latestGrid').innerHTML = sorted.slice(0, 6).map(articleCardHtml).join('');

  // 热门推荐：data.js 中 hot: true 的文章，取前 4 篇
  var hot = sorted.filter(function (a) { return a.hot; }).slice(0, 4);
  var hotSection = $('hotSection');
  if (hot.length) {
    $('hotGrid').innerHTML = hot.map(articleCardHtml).join('');
  } else {
    hotSection.style.display = 'none';
  }

  // 近期开箱：data.js 中 unboxing: true 的文章，取前 4 篇
  var unbox = sorted.filter(function (a) { return a.unboxing; }).slice(0, 4);
  var unboxSection = $('unboxingSection');
  if (unbox.length) {
    $('unboxingGrid').innerHTML = unbox.map(articleCardHtml).join('');
  } else {
    unboxSection.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initCarousel();
  initSections();
});
