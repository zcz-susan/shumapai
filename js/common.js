/* ==========================================================================
   common.js —— 全站公共脚本
   --------------------------------------------------------------------------
   负责：深色模式切换、手机端折叠菜单、导航搜索、通用工具函数、
        文章卡片 HTML 渲染、正文简易排版解析。
   依赖：data.js（需在本文件之前引入）
   ========================================================================== */

/* 尽早给 html 打上 js 标记：滚动渐入等增强样式只在 html.js 下生效，
   脚本被禁用或加载失败时 CSS 不会隐藏任何内容 */
document.documentElement.classList.add('js');

/* ------------------------- 一、通用小工具函数 ------------------------- */

/* 按 id 获取元素，写起来短一点 */
function $(id) { return document.getElementById(id); }

/* HTML 特殊字符转义，防止文章标题里的 < > & 等字符破坏页面 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* '2026-09-05' → '2026年9月5日'；'2026-08' → '2026年8月' */
function formatDate(d) {
  var parts = String(d).split('-');
  if (parts.length === 3) {
    return parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  }
  if (parts.length === 2) {
    return parts[0] + '年' + Number(parts[1]) + '月';
  }
  return d;
}

/* 简易防抖：输入框连续打字时只在停下 300ms 后执行一次搜索 */
function debounce(fn, wait) {
  var timer = null;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
  };
}

/* 图片加载失败时的兜底占位图（离线或图片服务不可用时显示，避免出现裂图） */
function imgFallback(label) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">'
    + '<rect width="100%" height="100%" fill="#dce6f7"/>'
    + '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" '
    + 'font-family="sans-serif" font-size="30" fill="#7c93bd">'
    + (label || '图片') + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* 文章按发布时间倒序排列（新的在前），多个页面共用 */
function articlesSortedByDate() {
  return ARTICLES.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
  });
}

/* ----------------------- 互动数据（本地存储） ------------------------ */
/* 纯静态站点没有后端，点赞与评论只保存在访客自己的浏览器 localStorage 中：
   dp_likes                已点赞的文章 id 映射
   dp_comments_<文章id>     该文章下访客发表的评论数组
   dp_name                 上次评论/投稿使用的昵称 */

/* 安全读取 / 写入 localStorage */
function storageRead(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
function storageWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/* ==========================================================================
   云后端集成（Supabase，可选，免实名认证）
   --------------------------------------------------------------------------
   本站默认纯静态：评论/点赞/投稿只存本机 localStorage，仅当前访客可见。
   若希望「所有访客共享」评论与点赞，请在下方 SUPABASE_CONFIG 填入你的
   Supabase 项目地址和 anon 公钥（两项都填才启用）；留空则退回纯本地存储。
   注册：https://supabase.com/ （可用 GitHub 账号直接登录，无需实名认证，
   免费版 500MB 数据库，小站够用；建表 SQL 见随附的设置说明）。
   说明：anon key 设计上就是公开给前端使用的，数据安全靠 Supabase 后台的
   RLS 行级权限策略保证（只能查/发评论，不能删改），放在 GitHub Pages 安全。
   ========================================================================== */
var SUPABASE_CONFIG = {
  url: 'https://adxmycavobnniqqjhvql.supabase.co',
  anonKey: 'sb_publishable_Q2b9CU8GRW3TpTlHrG40qg_VKPC9jIR'
};

/* 两个值都填了才视为启用云端 */
function cloudReady() {
  return !!(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

/* 唯一访客标识：用于云端防重复点赞，存在 localStorage */
function getClientId() {
  var cid = '';
  try { cid = localStorage.getItem('dp_client_id') || ''; } catch (e) {}
  if (!cid) {
    cid = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem('dp_client_id', cid); } catch (e) {}
  }
  return cid;
}

/* 统一请求封装：path 形如 'comments?article_id=eq.1'。
   返回 { status: http码, data: 解析后的JSON }；未配置/网络错误返回 {status:0,data:null}，
   任何异常都在这里消化，调用方只需判断 status，不会打断页面 */
function cloudRequest(method, path, body) {
  if (!cloudReady()) return Promise.resolve({ status: 0, data: null });
  var url = SUPABASE_CONFIG.url.replace(/\/+$/, '') + '/rest/v1/' + path;
  var headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': 'Bearer ' + SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json'
  };
  var opt = { method: method, headers: headers };
  if (body) opt.body = JSON.stringify(body);
  return fetch(url, opt).then(function (res) {
    return res.text().then(function (text) {
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { status: res.status, data: data };
    });
  }).catch(function () { return { status: 0, data: null }; });
}

/* ---------- 云端评论（表 comments） ---------- */
/* 读取云端评论；返回 null 表示未配置/失败，调用方保持本地数据不变 */
function cloudGetComments(id) {
  return cloudRequest('GET',
    'comments?article_id=eq.' + Number(id) + '&order=created_at.asc&limit=500')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.map(function (row) {
        return { name: row.name || '热心网友', text: row.body || '', time: row.created_at || '' };
      });
    });
}
/* 新增一条云端评论；成功返回 true */
function cloudAddComment(id, comment) {
  return cloudRequest('POST', 'comments', {
    article_id: Number(id),
    name: comment.name,
    body: comment.text
  }).then(function (r) { return r.status === 201; });
}

/* ---------- 云端点赞（表 likes，一条记录 = 一个访客的一次点赞） ---------- */
/* 云端真实点赞数 = likes 表中该文章的记录数；返回 null 表示未配置/失败 */
function cloudGetLikeCount(articleId) {
  return cloudRequest('GET',
    'likes?article_id=eq.' + Number(articleId) + '&select=id')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.length;
    });
}
/* 点赞 / 取消：按 clientId 查唯一记录，存在则删、不存在则建；幂等 */
function cloudSetLike(articleId, liked) {
  var cid = getClientId();
  return cloudRequest('GET',
    'likes?article_id=eq.' + Number(articleId) + '&client_id=eq.' + encodeURIComponent(cid)
    + '&select=id&limit=1')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return false;
      var row = r.data[0];
      if (liked) {
        if (row) return true;  // 已有点赞记录，幂等成功
        return cloudRequest('POST', 'likes', {
          article_id: Number(articleId),
          client_id: cid
        }).then(function (x) { return x.status === 201; });
      }
      if (!row) return true;   // 本来就没有记录，幂等成功
      return cloudRequest('DELETE', 'likes?id=eq.' + row.id)
        .then(function (x) { return x.status >= 200 && x.status < 300; });
    });
}

/* ---------- 云端投稿（表 submissions） ---------- */
/* 读取云端投稿（仅 type=submit），按时间倒序；返回 null 表示未配置/失败 */
function cloudGetSubmissions() {
  return cloudRequest('GET',
    'submissions?type=eq.submit&order=created_at.desc&limit=200')
    .then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.data)) return null;
      return r.data.map(function (row) {
        var t = row.created_at || '';
        return {
          name: row.author || '匿名网友',
          category: row.category || '其他数码',
          title: row.title || '',
          content: row.body || '',
          date: String(t).slice(0, 10)
        };
      });
    });
}
/* 新增一条云端投稿/反馈；成功返回 true */
function cloudAddSubmission(d) {
  return cloudRequest('POST', 'submissions', {
    type: d.type || 'submit',
    author: d.author || '匿名网友',
    category: d.category || '其他数码',
    title: d.title || '',
    body: d.content || ''
  }).then(function (r) { return r.status === 201; });
}

/* ==========================================================================
   云账号（Supabase Auth：邮箱 + 密码 登录 / 注册）
   --------------------------------------------------------------------------
   直接用 fetch 调 Supabase Auth REST API，不引入任何 SDK。
   注意：这里不复用 cloudRequest()——它把 Authorization 写死为 anonKey，
   而 Auth 请求需要携带真正的用户 access_token，因此单独封装 authRequest()。
   会话保存在 localStorage（键 dp_auth），结构：
   { access_token, refresh_token, expires_at(秒级时间戳),
     user: { id, email, nickname } }
   ========================================================================== */

/* 读取本地会话；结构不完整一律视为未登录 */
function getAuthSession() {
  var s = storageRead('dp_auth', null);
  return (s && s.access_token && s.user) ? s : null;
}
function setAuthSession(s) { storageWrite('dp_auth', s); }
function clearAuthSession() {
  try { localStorage.removeItem('dp_auth'); } catch (e) {}
}

/* 当前登录用户的昵称（未登录返回 ''） */
function authNickname() {
  var s = getAuthSession();
  return (s && s.user && s.user.nickname) || '';
}

/* Auth 接口统一请求封装：path 形如 'signup' 或 'token?grant_type=password'。
   accessToken 可选（登出时传用户 token）；未配置云端 / 网络错误返回 {status:0}，
   任何异常都在这里消化，与 cloudRequest 风格一致 */
function authRequest(path, body, accessToken) {
  if (!cloudReady()) return Promise.resolve({ status: 0, data: null });
  var headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json'
  };
  if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
  return fetch(SUPABASE_CONFIG.url.replace(/\/+$/, '') + '/auth/v1/' + path, {
    method: 'POST', headers: headers, body: JSON.stringify(body || {})
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { status: res.status, data: data };
    });
  }).catch(function () { return { status: 0, data: null }; });
}

/* 把 Auth 接口返回的数据整理成本站会话结构；缺 token / user 视为失败 */
function normalizeAuthSession(data) {
  if (!data || !data.user || !data.access_token) return null;
  var meta = data.user.user_metadata || {};
  var email = data.user.email || '';
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || '',
    expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
    user: {
      id: data.user.id || '',
      email: email,
      /* 注册时未传昵称则用邮箱前缀兜底，保证按钮上始终有字可显 */
      nickname: meta.nickname || (email ? email.split('@')[0] : '用户')
    }
  };
}

/* 非 2xx / 网络错误 → 友好中文提示。
   Supabase 错误体常见字段：{code:'email_not_confirmed',msg:'...'}
   或旧版 {error:'invalid_grant',error_description:'...'}，这里都做兼容 */
function authErrorMessage(status, data) {
  if (status === 0) return '网络异常，请检查网络后重试';
  var code = String((data && (data.code || data.error)) || '').toLowerCase();
  var msg = String((data && (data.msg || data.error_description || data.message)) || '');
  /* code 与文字描述一起匹配：旧版 GoTrue 对「邮箱未验证」返回的是
     error=invalid_grant + error_description='Email not confirmed'，
     只看 code 会误判成密码错误 */
  var hay = (code + ' ' + msg).toLowerCase();
  if (status === 400) {
    if (hay.indexOf('not_confirmed') > -1 || hay.indexOf('not confirmed') > -1) {
      return '邮箱还没有验证，请先点击确认邮件里的链接（留意垃圾邮件）';
    }
    if (hay.indexOf('already') > -1 || hay.indexOf('exists') > -1) {
      return '该邮箱已注册，请直接登录';
    }
    if (code.indexOf('invalid') > -1 || hay.indexOf('invalid login') > -1) {
      return '邮箱或密码不正确';
    }
    if (hay.indexOf('rate_limit') > -1 || hay.indexOf('too many') > -1) {
      return '操作太频繁，请稍后再试';
    }
    return msg || '邮箱或密码有误，或该邮箱已注册';
  }
  if (status === 422) return '密码太短，至少需要 6 位';
  if (status === 429) return '尝试过于频繁，请稍后再试';
  return msg ? ('操作失败：' + msg) : ('操作失败（错误码 ' + status + '）');
}

/* 简单邮箱格式校验 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/* 会话过期时用 refresh_token 静默续期一次；失败则清除本地会话 */
function refreshAuthSession() {
  var s = getAuthSession();
  if (!s || !s.refresh_token) return Promise.resolve(null);
  /* 未过期（留 60 秒缓冲）直接跳过，避免多余请求 */
  if ((s.expires_at || 0) * 1000 > Date.now() + 60 * 1000) return Promise.resolve(s);
  return authRequest('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
    .then(function (r) {
      var next = r.status === 200 ? normalizeAuthSession(r.data) : null;
      if (next) { setAuthSession(next); return next; }
      clearAuthSession();  // 刷新失败：refresh_token 大概率已失效，清掉
      return null;
    });
}

/* 邮箱 + 密码登录；成功返回会话，失败弹 err(中文提示) 并返回 null */
function authLogin(email, password, err) {
  return authRequest('token?grant_type=password', { email: email, password: password })
    .then(function (r) {
      var s = r.status === 200 ? normalizeAuthSession(r.data) : null;
      if (s) return s;
      err(authErrorMessage(r.status, r.data));
      return null;
    });
}

/* 邮箱注册（昵称写进 user_metadata）；成功返回 {session} 或 {needVerify:true}
   （站点开启「确认邮箱」时 Supabase 只返回 user 不返回 session） */
function authSignup(email, nickname, password, err) {
  return authRequest('signup', {
    email: email,
    password: password,
    data: { nickname: nickname }
  }).then(function (r) {
    if (r.status < 200 || r.status >= 300) {
      err(authErrorMessage(r.status, r.data));
      return null;
    }
    var s = normalizeAuthSession(r.data);
    if (s) return { session: s };
    if (r.data && r.data.user) {
      /* 开启「防用户枚举」后，重复注册会返回 identities 为空数组的影子用户，
         说明该邮箱其实已经注册过（Supabase 故意不直接报错以防探测邮箱） */
      if (Array.isArray(r.data.user.identities) && r.data.user.identities.length === 0) {
        err('该邮箱已注册，请直接登录（若忘记密码可在登录页再试或联系站长）');
        return null;
      }
      /* 后台开启了「确认邮箱」：只返回 user 不发会话，需要收信验证 */
      return { needVerify: true };
    }
    err('注册响应异常，请稍后再试（HTTP ' + r.status + '）');
    return null;
  });
}

/* 退出登录：云端注销尽力而为（失败也无所谓），本地会话一定清除 */
function authLogout() {
  var s = getAuthSession();
  if (s && s.access_token) authRequest('logout', {}, s.access_token);
  clearAuthSession();
}

/* ------------------------ 登录入口与弹窗 UI ------------------------ */

/* 昵称超长截断：超过 6 字只留前 6 字 + … */
function shortNickname(nick) {
  nick = String(nick || '');
  return nick.length > 6 ? nick.slice(0, 6) + '…' : nick;
}

/* 登录 / 退出后广播事件，article.js / submit.js 监听后同步刷新昵称框 */
function notifyAuthChange() {
  try {
    document.dispatchEvent(new CustomEvent('dp_auth_change'));
  } catch (e) {
    var ev = document.createEvent('Event');  // 老浏览器兜底
    ev.initEvent('dp_auth_change', false, false);
    document.dispatchEvent(ev);
  }
}

/* 刷新导航上的登录按钮：未登录显示「登录」，已登录显示昵称（超长截断） */
function renderLoginBtn() {
  var session = getAuthSession();
  var nick = session ? (session.user.nickname || '用户') : '';
  document.querySelectorAll('.login-btn').forEach(function (btn) {
    btn.innerHTML = '<span class="login-btn-ico" aria-hidden="true">👤</span>'
      + '<span class="login-btn-txt">' + escapeHtml(nick ? shortNickname(nick) : '登录') + '</span>';
    btn.title = nick ? ('已登录：' + (session.user.email || nick)) : '登录 / 注册';
  });
}

/* ------------------------ 已登录用户小菜单 ------------------------ */
var __userMenu = null;

function closeUserMenu() {
  if (__userMenu) __userMenu.classList.remove('open');
}

/* 点昵称弹出的小菜单：展示账号信息 + 退出登录 */
function openUserMenu(btn) {
  if (!__userMenu) {
    __userMenu = document.createElement('div');
    __userMenu.className = 'user-menu';
    document.body.appendChild(__userMenu);
    /* 点菜单与登录按钮之外的任意区域关闭 */
    document.addEventListener('click', function (e) {
      if (!__userMenu.classList.contains('open')) return;
      if (e.target.closest('.user-menu') || e.target.closest('.login-btn')) return;
      closeUserMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeUserMenu();
    });
    window.addEventListener('scroll', closeUserMenu);  // 菜单是固定定位，滚动即错位，直接关
    window.addEventListener('resize', closeUserMenu);
  }
  var session = getAuthSession();
  if (!session) return;
  __userMenu.innerHTML =
    '<div class="user-menu-head"><strong>' + escapeHtml(session.user.nickname || '用户') + '</strong>'
    + '<span>' + escapeHtml(session.user.email || '') + '</span></div>'
    + '<button type="button" class="user-menu-item" id="userLogoutBtn">退出登录</button>';
  $('userLogoutBtn').addEventListener('click', function () {
    authLogout();
    closeUserMenu();
    renderLoginBtn();
    notifyAuthChange();
    showToast('已退出登录');
  });
  /* 固定定位到登录按钮正下方（右缘对齐），滚动时由上面的监听自动关闭 */
  var rect = btn.getBoundingClientRect();
  __userMenu.style.top = (rect.bottom + 8) + 'px';
  __userMenu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
  __userMenu.classList.add('open');
}

/* -------------------------- 登录 / 注册弹窗 -------------------------- */
var __authMask = null;   // 遮罩 + 对话框，首次打开时创建，全站只建一次

function switchAuthTab(name) {
  __authMask.querySelectorAll('.auth-tab').forEach(function (t) {
    t.classList.toggle('active', t.getAttribute('data-auth-tab') === name);
  });
  __authMask.querySelectorAll('.auth-form').forEach(function (f) {
    f.classList.toggle('active', f.getAttribute('data-auth-form') === name);
  });
}

/* 在表单内显示提示：isError=true 红字报错，否则绿色成功提示 */
function showAuthMsg(form, text, isError) {
  var el = form.querySelector('.auth-msg');
  el.textContent = text || '';
  el.classList.toggle('error', !!isError);
  el.classList.toggle('ok', !isError && !!text);
}

/* 提交按钮加载态：文字换成「请稍候…」并禁用，结束后还原 */
function setAuthLoading(btn, loading) {
  if (loading) {
    btn.setAttribute('data-orig-text', btn.textContent);
    btn.textContent = '请稍候…';
    btn.disabled = true;
  } else {
    btn.textContent = btn.getAttribute('data-orig-text') || btn.textContent;
    btn.removeAttribute('data-orig-text');
    btn.disabled = false;
  }
}

/* 登录 / 注册成功后的统一收尾：存会话、关弹窗、刷新按钮并广播 */
function onAuthSuccess(session) {
  setAuthSession(session);
  closeLoginModal();
  closeUserMenu();
  renderLoginBtn();
  notifyAuthChange();
  showToast('欢迎回来，' + (session.user.nickname || '用户'));
}

function openLoginModal() {
  ensureLoginModal();
  switchAuthTab('login');
  showAuthMsg($('authLoginForm'), '', false);
  showAuthMsg($('authSignupForm'), '', false);
  __authMask.classList.add('open');
  /* 聚焦第一个输入框，方便直接输入 */
  var first = __authMask.querySelector('.auth-form.active input');
  if (first) setTimeout(function () { first.focus(); }, 60);
}

function closeLoginModal() {
  if (__authMask) __authMask.classList.remove('open');
}

/* 构建弹窗 DOM（div 动态创建，不用 <dialog> 以兼容旧浏览器） */
function ensureLoginModal() {
  if (__authMask) return;

  __authMask = document.createElement('div');
  __authMask.className = 'auth-mask';
  __authMask.id = 'authMask';
  __authMask.innerHTML =
    '<div class="auth-dialog" role="dialog" aria-modal="true" aria-label="登录或注册">'
    +   '<button type="button" class="auth-close" aria-label="关闭">✕</button>'
    +   '<div class="auth-tabs">'
    +     '<button type="button" class="auth-tab active" data-auth-tab="login">登录</button>'
    +     '<button type="button" class="auth-tab" data-auth-tab="signup">注册</button>'
    +   '</div>'
    +   '<form class="auth-form active" data-auth-form="login" id="authLoginForm" novalidate>'
    +     '<label class="auth-field"><span>邮箱</span>'
    +       '<input type="email" id="authLoginEmail" placeholder="you@example.com" autocomplete="email"></label>'
    +     '<label class="auth-field"><span>密码</span>'
    +       '<input type="password" id="authLoginPwd" placeholder="至少 6 位" autocomplete="current-password"></label>'
    +     '<p class="auth-msg"></p>'
    +     '<button type="submit" class="btn btn-primary auth-submit">登录</button>'
    +   '</form>'
    +   '<form class="auth-form" data-auth-form="signup" id="authSignupForm" novalidate>'
    +     '<label class="auth-field"><span>邮箱</span>'
    +       '<input type="email" id="authSignupEmail" placeholder="you@example.com" autocomplete="email"></label>'
    +     '<label class="auth-field"><span>昵称</span>'
    +       '<input type="text" id="authSignupNick" maxlength="12" placeholder="怎么称呼你？（最多 12 字）"></label>'
    +     '<label class="auth-field"><span>密码</span>'
    +       '<input type="password" id="authSignupPwd" placeholder="至少 6 位" autocomplete="new-password"></label>'
    +     '<label class="auth-field"><span>确认密码</span>'
    +       '<input type="password" id="authSignupPwd2" placeholder="再输入一遍密码" autocomplete="new-password"></label>'
    +     '<p class="auth-msg"></p>'
    +     '<button type="submit" class="btn btn-primary auth-submit">注册</button>'
    +   '</form>'
    + '</div>';
  document.body.appendChild(__authMask);

  /* 关闭：右上角 ✕ / 点遮罩空白处 / Esc */
  __authMask.querySelector('.auth-close').addEventListener('click', closeLoginModal);
  __authMask.addEventListener('click', function (e) {
    if (e.target === __authMask) closeLoginModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && __authMask.classList.contains('open')) closeLoginModal();
  });

  /* 登录 / 注册标签页切换 */
  __authMask.querySelectorAll('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchAuthTab(tab.getAttribute('data-auth-tab'));
    });
  });

  /* 登录提交 */
  var loginForm = $('authLoginForm');
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var submitBtn = loginForm.querySelector('.auth-submit');
    var email = $('authLoginEmail').value.trim();
    var pwd = $('authLoginPwd').value;
    if (!isValidEmail(email)) { showAuthMsg(loginForm, '请输入正确的邮箱地址', true); return; }
    if (pwd.length < 6) { showAuthMsg(loginForm, '密码太短，至少需要 6 位', true); return; }
    showAuthMsg(loginForm, '', false);
    setAuthLoading(submitBtn, true);
    authLogin(email, pwd, function (msg) {
      setAuthLoading(submitBtn, false);
      showAuthMsg(loginForm, msg, true);
    }).then(function (s) {
      if (s) onAuthSuccess(s);
    });
  });

  /* 注册提交 */
  var signupForm = $('authSignupForm');
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var submitBtn = signupForm.querySelector('.auth-submit');
    var email = $('authSignupEmail').value.trim();
    var nick = $('authSignupNick').value.trim();
    var pwd = $('authSignupPwd').value;
    var pwd2 = $('authSignupPwd2').value;
    if (!isValidEmail(email)) { showAuthMsg(signupForm, '请输入正确的邮箱地址', true); return; }
    if (!nick) { showAuthMsg(signupForm, '请填写昵称', true); return; }
    if (pwd.length < 6) { showAuthMsg(signupForm, '密码太短，至少需要 6 位', true); return; }
    if (pwd !== pwd2) { showAuthMsg(signupForm, '两次输入的密码不一致', true); return; }
    showAuthMsg(signupForm, '', false);
    setAuthLoading(submitBtn, true);
    authSignup(email, nick, pwd, function (msg) {
      setAuthLoading(submitBtn, false);
      showAuthMsg(signupForm, msg, true);
    }).then(function (res) {
      if (!res) return;
      if (res.needVerify) {
        /* 后台开启了「确认邮箱」：注册成功但没直接发会话。
           再用同一密码试登录一次——站长若关闭了邮箱确认，这一步会直接成功；
           仍要求验证时，GoTrue 返回 email_not_confirmed，再引导去收信 */
        showAuthMsg(signupForm, '注册成功，正在自动登录…', false);
        authLogin(email, pwd, function () { /* 错误统一在下面按返回值处理 */ })
          .then(function (s2) {
            setAuthLoading(submitBtn, false);
            if (s2) { onAuthSuccess(s2); return; }
            showAuthMsg(signupForm,
              '注册成功！请先到邮箱查收确认邮件（留意垃圾邮件），点击验证链接后再登录。', false);
          });
        return;
      }
      onAuthSuccess(res.session);
    });
  });
}

/* ------------------------ 导航登录入口注入 ------------------------ */
/* 在每个页面的 .nav-bar 里、主题切换按钮之前插入登录按钮（不改 HTML） */
function initLoginUI() {
  document.querySelectorAll('.nav-bar').forEach(function (bar) {
    if (bar.querySelector('.login-btn')) return;  // 防止重复注入
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn login-btn';
    btn.id = 'loginBtn';
    var themeBtn = bar.querySelector('.theme-toggle');
    if (themeBtn) bar.insertBefore(btn, themeBtn);
    else bar.appendChild(btn);
    btn.addEventListener('click', function () {
      if (getAuthSession()) {
        /* 已登录：点昵称开 / 关小菜单 */
        if (__userMenu && __userMenu.classList.contains('open')) closeUserMenu();
        else openUserMenu(btn);
      } else {
        openLoginModal();
      }
    });
  });
  renderLoginBtn();
  /* 会话过期则静默刷新一次（失败会清掉会话），随后统一刷新按钮并广播，
     让评论 / 投稿页的昵称框与最新登录状态保持一致 */
  refreshAuthSession().then(function () {
    renderLoginBtn();
    notifyAuthChange();
  });
}

/* 点赞：基础赞数在 data.js（a.likes），本机点赞后再 +1 */
function getLikedMap() {
  var m = storageRead('dp_likes', {});
  return (m && typeof m === 'object') ? m : {};
}
function isArticleLiked(id) { return !!getLikedMap()[id]; }
function likeCount(a) { return (a.likes || 0) + (isArticleLiked(a.id) ? 1 : 0); }
function setArticleLiked(id, liked) {
  var m = getLikedMap();
  if (liked) { m[id] = 1; } else { delete m[id]; }
  storageWrite('dp_likes', m);
}

/* 评论：每篇文章一个数组，元素结构 {name, text, time} */
function getComments(id) {
  var list = storageRead('dp_comments_' + id, []);
  return Array.isArray(list) ? list : [];
}
function addComment(id, comment) {
  var list = getComments(id);
  list.push(comment);
  storageWrite('dp_comments_' + id, list);
}

/* ISO 时间 → '2026-09-12 14:30' 友好格式 */
function formatTime(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* 轻量提示条（复制链接、点赞成功等反馈用） */
var __toastTimer = null;
function showToast(msg) {
  var t = $('dpToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'dpToast';
    t.className = 'dp-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
}

/* 点赞按钮：卡片与详情页同构，统一用 data-like="文章id" 标识。
   点击后只更新局部数字，不整页重绘；同一篇文章的所有按钮一起同步。 */
function syncLikeUI(id) {
  var article = ARTICLES.filter(function (a) { return a.id === Number(id); })[0];
  var liked = isArticleLiked(id);
  document.querySelectorAll('button[data-like="' + id + '"]').forEach(function (btn) {
    btn.classList.toggle('is-liked', liked);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    var num = btn.querySelector('.like-num');
    if (num && article) num.textContent = likeCount(article);
  });
}

/* 异步用云端真实赞数刷新所有该文章按钮的数字（不改 is-liked 心形态）。
   云端数 = Like 表记录数；显示数 = data.js 种子基数 a.likes + 云端数。
   未配置/失败则保持本地数字不动。 */
function syncLikeUICloud(id) {
  cloudGetLikeCount(id).then(function (n) {
    if (n == null) return;
    var article = ARTICLES.filter(function (a) { return a.id === Number(id); })[0];
    var total = (article ? (article.likes || 0) : 0) + n;
    document.querySelectorAll('button[data-like="' + id + '"] .like-num')
      .forEach(function (num) { num.textContent = total; });
  });
}

/* 批量刷新当前页面可见卡片的云端赞数与评论数（只查页面上存在的文章） */
function refreshCloudStats() {
  var ids = [];
  document.querySelectorAll('button[data-like]').forEach(function (btn) {
    var id = btn.getAttribute('data-like');
    if (ids.indexOf(id) === -1) ids.push(id);
  });
  if (!ids.length) return;
  ids.forEach(function (id) {
    syncLikeUICloud(id);
    cloudGetComments(id).then(function (list) {
      if (list == null) return;
      var n = list.length;
      document.querySelectorAll('[data-href="article.html?id=' + id + '"] .stat-comments')
        .forEach(function (el) { el.textContent = '💬 ' + n; });
    });
  });
}

/* 点赞同步锁：上一次云端同步没完成前忽略新的点击，
   防止手机双击/快速连点导致「查询时记录还没插入→漏删除→云端残留孤儿记录」，
   孤儿记录会让赞数永远降不下来（表现为“取消不了”） */
var __likeSyncing = {};

function initLikeAction() {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-like]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-like');
    if (__likeSyncing[id]) return;  // 同步进行中，忽略本次点击
    __likeSyncing[id] = true;
    var liked = !isArticleLiked(id);
    /* 本地即时切换：保证 UI 零延迟反馈 */
    setArticleLiked(id, liked);
    syncLikeUI(id);
    showToast(liked ? '点赞成功，谢谢你的喜欢' : '已取消点赞');
    /* 异步同步到云端；取消失败时明确提示（一般是云端缺 DELETE 权限策略） */
    cloudSetLike(id, liked).then(function (ok) {
      delete __likeSyncing[id];
      if (ok) {
        syncLikeUICloud(id);
      } else if (!liked) {
        showToast('云端取消失败，已在本机取消');
      } else {
        showToast('云端同步失败，点赞暂存本机');
      }
    });
  });
}

/* ----------------------- 二、文章卡片渲染（共用） ---------------------- */
/* 首页和列表页都用同一个卡片样式，改这里全站生效 */
function articleCardHtml(a) {
  // 角标优先级：未设置则不显示
  var badge = a.unboxing
    ? '<span class="card-badge badge-unbox">开箱</span>'
    : (a.hot ? '<span class="card-badge badge-hot">热门</span>' : '');

  // 标签点击跳到文章列表并自动按该标签筛选
  var tags = a.tags.map(function (t) {
    return '<a class="tag" href="articles.html?tag=' + encodeURIComponent(t) + '">'
      + escapeHtml(t) + '</a>';
  }).join('');

  return ''
    + '<article class="article-card" data-href="article.html?id=' + a.id + '">'
    +   '<a class="card-cover" href="article.html?id=' + a.id + '" aria-label="' + escapeHtml(a.title) + '">'
    +     '<img src="' + a.cover + '" alt="' + escapeHtml(a.title) + '" loading="lazy" '
    +       'onerror="this.onerror=null;this.src=imgFallback(\'文章配图\')">'
    +     badge
    +   '</a>'
    +   '<div class="card-body">'
    +     '<div class="card-tags">' + tags + '</div>'
    +     '<h3 class="card-title"><a href="article.html?id=' + a.id + '">' + escapeHtml(a.title) + '</a></h3>'
    +     '<p class="card-excerpt">' + escapeHtml(a.excerpt) + '</p>'
    +     '<div class="card-meta">'
    +       '<span class="card-date">' + formatDate(a.date) + '</span>'
    +       '<span class="card-stats">'
    +         '<span class="stat-comments" title="评论数">💬 ' + getComments(a.id).length + '</span>'
    +         '<button type="button" class="like-btn' + (isArticleLiked(a.id) ? ' is-liked' : '')
    +           '" data-like="' + a.id + '" aria-pressed="' + (isArticleLiked(a.id) ? 'true' : 'false')
    +           '" title="点赞"><span class="like-ico" aria-hidden="true">♥</span>'
    +           '<span class="like-num">' + likeCount(a) + '</span></button>'
    +       '</span>'
    +     '</div>'
    +   '</div>'
    + '</article>';
}

/* --------------- 三、正文简易排版（data.js 里 content 的格式） --------------- */
/* 支持：## 小标题 / 空行分段 / ![说明](图片) / - 列表项 / > 引用 */
function renderArticleContent(raw) {
  return raw.split(/\n{2,}/).map(function (block) {
    var text = block.trim();
    if (!text) return '';

    // 小标题
    if (text.indexOf('## ') === 0) {
      return '<h2>' + escapeHtml(text.slice(3).trim()) + '</h2>';
    }

    // 图片：![图片说明](图片地址)
    var imgMatch = text.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      return '<figure>'
        + '<img src="' + imgMatch[2] + '" alt="' + escapeHtml(imgMatch[1]) + '" '
        +   'loading="lazy" onerror="this.onerror=null;this.src=imgFallback(\'正文配图\')">'
        + '<figcaption>' + escapeHtml(imgMatch[1]) + '</figcaption>'
        + '</figure>';
    }

    // 引用块
    if (text.indexOf('> ') === 0) {
      return '<blockquote>' + escapeHtml(text.slice(2).trim()) + '</blockquote>';
    }

    // 无序列表：连续多行且每行以 “- ” 开头
    var lines = text.split('\n');
    if (lines.length > 0 && lines.every(function (l) { return /^- /.test(l.trim()); })) {
      var items = lines.map(function (l) {
        return '<li>' + escapeHtml(l.trim().slice(2)) + '</li>';
      }).join('');
      return '<ul>' + items + '</ul>';
    }

    // 普通段落
    return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

/* ------------------------ 四、深色模式切换 ---------------------------- */
/* 统一使用内联 SVG 图标（代替 emoji）：跨平台渲染一致，且能用 currentColor 跟随主题变色。
   深色时按钮显示太阳（点击去浅色），浅色时显示月亮，与原交互逻辑保持一致。 */
var ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z"/></svg>';
var ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
/* 手机端汉堡菜单的「展开 / 收起」图标 */
var ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function initThemeToggle() {
  var btn = $('themeToggle');
  if (!btn) return;

  /* 同步手机浏览器状态栏配色（<meta name="theme-color">），深浅色各一个底色 */
  function syncThemeColor(dark) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0a0d14' : '#f5f6f8');
  }

  // 根据当前模式刷新按钮图标（页面初始模式由 <head> 内的内联脚本设置）
  function syncIcon() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
    btn.title = dark ? '切换到浅色模式' : '切换到深色模式';
    btn.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    syncThemeColor(dark);
  }
  syncIcon();

  btn.addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {} // 本地记住选择
    syncIcon();
  });
}

/* ---------------------- 五、手机端折叠菜单 --------------------------- */
function initNavToggle() {
  var btn = $('navToggle');
  var menu = $('navMenu');
  if (!btn || !menu) return;

  /* 同步按钮图标与无障碍状态：屏幕阅读器靠 aria-expanded 判断菜单开合 */
  function syncNav() {
    var open = menu.classList.contains('open');
    btn.innerHTML = open ? ICON_CLOSE : ICON_MENU;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? '收起菜单' : '打开菜单');
  }
  syncNav();

  btn.addEventListener('click', function () {
    menu.classList.toggle('open');
    syncNav();
  });

  // 点击菜单项后自动收起
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      menu.classList.remove('open');
      syncNav();
    }
  });

  // 按 Esc 也收起菜单（键盘用户）
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      menu.classList.remove('open');
      syncNav();
      btn.focus();
    }
  });
}

/* ------------------------- 六、导航栏搜索 ----------------------------- */
function initNavSearch() {
  var input = $('navSearchInput');
  var btn = $('navSearchBtn');
  if (!input) return;

  // 如果当前是文章列表页且 URL 上带搜索词，回填到输入框
  if (/articles\.html$/.test(location.pathname)) {
    var q = new URLSearchParams(location.search).get('q');
    if (q) input.value = q;
  }

  function go() {
    var kw = input.value.trim();
    location.href = 'articles.html' + (kw ? '?q=' + encodeURIComponent(kw) : '');
  }
  btn && btn.addEventListener('click', go);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') go();
  });

  /* ---------- 热搜榜下拉：搜索框聚焦 / 输入时弹出，按热度取前 5 篇 ----------
     热度 = data.js 基础赞数（a.likes）+ 云端真实点赞数（异步获取），
     云端取不到时退回基础值排序，拿到云端数据后更新数字并重排重渲染一次。 */
  var drop = null;        // 下拉容器（首次打开时动态创建，挂在 .nav-search 内）
  var hotItems = null;    // 参与排名的前 5 篇文章（含热度），本页只初始化一次
  var cloudDone = false;  // 云端赞数是否已拉取（本页只拉一次，避免重复请求）

  /* 创建下拉容器并绑定行点击跳转 */
  function ensureDrop() {
    if (drop) return drop;
    drop = document.createElement('div');
    drop.className = 'hot-drop';
    // .nav-search 已设置 position:relative，下拉绝对定位于其下方
    input.parentNode.appendChild(drop);
    // 点击某一行 → 跳到对应文章详情页
    drop.addEventListener('click', function (e) {
      var item = e.target.closest('.hot-drop-item');
      if (item) location.href = 'article.html?id=' + item.getAttribute('data-id');
    });
    return drop;
  }

  /* 组装榜单数据：复制基础数据并按基础赞数倒序取前 5 */
  function buildHotItems() {
    hotItems = ARTICLES.map(function (a) {
      return { id: a.id, title: a.title, base: a.likes || 0, heat: a.likes || 0 };
    }).sort(function (x, y) { return y.heat - x.heat; }).slice(0, 5);
  }

  /* 渲染下拉：排名序号（前三名金/银/铜高亮）+ 标题 + 右侧热度值 */
  function renderDrop() {
    var d = ensureDrop();
    var html = '<div class="hot-drop-head">🔥 热搜榜</div>';
    hotItems.forEach(function (it, i) {
      var cls = i === 0 ? ' top-1' : (i === 1 ? ' top-2' : (i === 2 ? ' top-3' : ''));
      html += '<div class="hot-drop-item' + cls + '" data-id="' + it.id + '">'
        + '<span class="hot-drop-rank">' + (i + 1) + '</span>'
        + '<span class="hot-drop-title">' + escapeHtml(it.title) + '</span>'
        + '<span class="hot-drop-heat">🔥 ' + it.heat + '</span>'
        + '</div>';
    });
    d.innerHTML = html;
  }

  /* 异步拉取云端真实赞数：全部返回后重排一次；下拉开着才需要重渲染 */
  function fetchCloudHeat() {
    if (cloudDone || !hotItems) return;
    cloudDone = true;
    var left = hotItems.length;
    hotItems.forEach(function (it) {
      cloudGetLikeCount(it.id).then(function (n) {
        if (n != null) it.heat = it.base + n; // 热度 = 基础赞数 + 云端赞数
        left--;
        if (left === 0) {
          hotItems.sort(function (x, y) { return y.heat - x.heat; });
          if (drop && drop.classList.contains('open')) renderDrop();
        }
      });
    });
  }

  function openHotDrop() {
    if (!hotItems) buildHotItems();
    renderDrop();
    drop.classList.add('open');
    fetchCloudHeat();
  }

  function closeHotDrop() {
    if (drop) drop.classList.remove('open');
  }

  // 聚焦或输入时弹出热搜榜；mousedown 兜底（个别浏览器/插件会吞掉 focus 事件）
  input.addEventListener('mousedown', openHotDrop);
  input.addEventListener('focus', openHotDrop);
  input.addEventListener('input', openHotDrop);
  // 失焦延迟 150ms 再关闭，避免吃掉下拉项的 click 事件
  input.addEventListener('blur', function () {
    setTimeout(closeHotDrop, 150);
  });
  // 点击页面其他区域关闭
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-search')) closeHotDrop();
  });
  // 按 Esc 关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeHotDrop();
  });
}

/* ---------- 七、整卡可点击：点击带 data-href 的卡片任意位置跳转 --------- */
function initCardClick() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input')) return; // 点到链接/按钮则不拦截
    var card = e.target.closest('[data-href]');
    if (card) location.href = card.getAttribute('data-href');
  });
}

/* ------------------- 八、滚动渐入（IntersectionObserver） ------------------- */
/* 给文章卡片与各 section 的直接子元素加 .reveal-in，进入视口后补 .is-visible，
   播放「上移 10px + 淡入」的入场动效。CSS 只在 html.js 下应用初始隐藏，
   因此无 JS、或旧版 Firefox / Safari 不支持 IntersectionObserver 时
   直接 return，不做任何隐藏，内容始终完整可见。 */
function initRevealOnScroll() {
  // 浏览器不支持 IntersectionObserver：放弃动效，内容保持可见
  if (typeof IntersectionObserver !== 'function') return;

  // 排除轮播：其子元素（轨道/箭头）自带 transform 过渡，避免相互干扰
  var targets = document.querySelectorAll('.article-card, main section:not(.carousel) > *');
  if (!targets.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('is-visible');
      observer.unobserve(el); // 只播放一次，之后不再监听该元素
      // 入场播完后移除辅助类与级联延迟，把过渡节奏还给卡片自身的 hover 效果
      var delay = parseFloat(el.style.transitionDelay) || 0;
      setTimeout(function () {
        el.classList.remove('reveal-in', 'is-visible');
        el.style.transitionDelay = '';
      }, delay + 600);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });

  targets.forEach(function (el, i) {
    el.classList.add('reveal-in');
    // 级联延迟：按 DOM 序号每个 +60ms，封顶 300ms
    el.style.transitionDelay = Math.min(i * 60, 300) + 'ms';
    observer.observe(el);
  });
}

/* ----------------------------- 初始化 -------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  initThemeToggle();
  initNavToggle();
  initNavSearch();
  initCardClick();
  initLikeAction();
  initLoginUI();  // 注入导航登录入口 + 会话静默续期

  // 滚动渐入：本文件的 DOMContentLoaded 监听先于各页渲染脚本注册，
  // 用 setTimeout(0) 推迟到本轮事件全部处理完后收集，才能拿到脚本渲染出的卡片
  setTimeout(initRevealOnScroll, 0);

  // 云端统计异步刷新：延迟一点，等列表/详情页脚本先把卡片渲染出来再拉云端数据
  setTimeout(refreshCloudStats, 300);

  // 页脚年份自动更新
  var yearEl = $('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 用 data.js 中的 SITE.name 填充页面里的站点名称（改一处全站生效）
  if (typeof SITE !== 'undefined') {
    var nameEl = $('siteName');
    if (nameEl) nameEl.textContent = SITE.name;
    var footerName = document.querySelector('.footer-site-name');
    if (footerName) footerName.textContent = SITE.name;
    // 把标题里的站点名统一替换成当前 SITE.name（兼容旧站名）
    document.title = document.title.replace(/深蓝数码志/g, SITE.name);
  }
});
