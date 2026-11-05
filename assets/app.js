/* My Waifu List · 纯原生 JS，零依赖、零网络请求
   数据来自 data/site-data.js（由 tools/build_data.py 生成） */
(function () {
  'use strict';

  var D = window.SITE_DATA;
  var app = document.getElementById('app');
  if (!D) {
    app.innerHTML = '<p class="empty">数据未生成，请双击 update.bat 后刷新页面。</p>';
    return;
  }

  var KEY = 'mywifulist-theme';
  function getTheme() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setTheme(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式忽略 */ } }

  var state = { q: '', ip: 'all', theme: getTheme() || 'dark' };
  var cardState = {};
  var index = {};
  D.ips.forEach(function (ip) {
    ip.characters.forEach(function (ch) { index[ch.id] = ch; });
  });

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function st(id) {
    if (!cardState[id]) cardState[id] = { i: 0, open: false };
    return cardState[id];
  }

  function syncTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    var btn = document.getElementById('theme');
    btn.textContent = state.theme === 'dark' ? '☀' : '☾';
    btn.title = state.theme === 'dark' ? '切换到浅色' : '切换到深色';
  }

  document.getElementById('intro').innerHTML = D.intro.map(function (s) {
    return '<p>' + esc(s) + '</p>';
  }).join('');
  document.getElementById('statline').innerHTML =
    '<span><b>' + D.stats.ips + '</b> 个 IP</span>' +
    '<span><b>' + D.stats.characters + '</b> 位角色</span>' +
    '<span><b>' + D.stats.images + '</b> 张图片</span>';
  document.getElementById('generated').textContent = (function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s || '');
    return m ? m[1] + '年' + m[2] + '月' + m[3] + '日 ' + m[4] + ':' + m[5] : s;
  })(D.generated);
  document.getElementById('chips').innerHTML =
    '<button class="chip active" type="button" data-ip="all">全部 <i>' + D.stats.characters + '</i></button>' +
    D.ips.map(function (ip) {
      return '<button class="chip" type="button" data-ip="' + ip.id + '">' +
        esc(ip.name) + ' <i>' + ip.characters.length + '</i></button>';
    }).join('');

  function placeholder(ch) {
    return '<div class="ph"><span>' + esc(ch.name.slice(0, 1)) + '</span></div>';
  }

  function mediaInner(ch, s) {
    var imgs = ch.images || [];
    if (!imgs.length) return placeholder(ch) + '<span class="badge">0 张</span>';
    var html =
      '<img src="' + esc(imgs[s.i]) + '" alt="' + esc(ch.name) + ' 第 ' + (s.i + 1) +
      ' 张" loading="lazy" decoding="async" data-id="' + esc(ch.id) + '">' +
      '<span class="badge">' + imgs.length + ' 张</span>';
    if (imgs.length > 1) {
      html +=
        '<div class="media-nav">' +
        '<button type="button" data-act="prev" aria-label="上一张">‹</button>' +
        '<button type="button" data-act="next" aria-label="下一张">›</button></div>' +
        '<div class="dots">' + imgs.map(function (_, i) {
          return '<i class="' + (i === s.i ? 'on' : '') + '"></i>';
        }).join('') + '</div>';
    }
    return html;
  }

  function galleryHtml(ch) {
    var imgs = ch.images || [];
    return '<div class="inline-gallery">' + imgs.map(function (src, i) {
      return '<img src="' + esc(src) + '" alt="' + esc(ch.name) + ' 第 ' + (i + 1) +
        ' 张" loading="lazy" decoding="async" data-id="' + esc(ch.id) + '">';
    }).join('') + '</div>';
  }

  function cardHtml(ch) {
    var imgs = ch.images || [];
    var s = st(ch.id);
    return '<article class="card" data-id="' + esc(ch.id) + '">' +
      '<div class="card-media">' + mediaInner(ch, s) + '</div>' +
      '<div class="card-body"><h3>' + esc(ch.name) + '</h3>' +
      (ch.tag ? '<span class="tag" title="（' + esc(ch.tag) + '）">' + esc(ch.tag) + '</span>' : '') +
      (ch.tag ? '' : '<div class="card-meta">本体</div>') + '</div>' +
      (imgs.length > 1
        ? '<button class="expand" type="button" data-act="toggle">' +
          (s.open ? '收起' : '展开全部 ' + imgs.length + ' 张') + '</button>'
        : '') +
      (s.open ? galleryHtml(ch) : '') +
      '</article>';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var visible = 0;
    var groups = [];
    D.ips.forEach(function (ip) {
      if (state.ip !== 'all' && ip.id !== state.ip) return;
      var chars = ip.characters.filter(function (ch) {
        if (!q) return true;
        return (ch.name + ' ' + ch.tag + ' ' + ip.name).toLowerCase().indexOf(q) !== -1;
      });
      if (!chars.length) return;
      visible += chars.length;
      groups.push({ id: ip.id, name: ip.name, note: ip.note, characters: chars });
    });
    return { groups: groups, visible: visible };
  }

  function draw() {
    var d = filtered();
    document.getElementById('resultline').innerHTML =
      '显示 <b>' + d.visible + '</b> / ' + D.stats.characters + ' 位角色 · ' +
      d.groups.length + ' 个 IP' + (state.q ? ' · 关键词「' + esc(state.q) + '」' : '');
    if (!d.visible) {
      app.innerHTML = '<p class="empty">没有匹配的角色。</p>';
      return;
    }
    app.innerHTML = d.groups.map(function (ip) {
      return '<section class="ip-section" id="ip-' + ip.id + '">' +
        '<div class="section-head"><h2>' + esc(ip.name) + '</h2>' +
        '<span class="count">' + ip.characters.length + ' 位</span>' +
        (ip.note ? '<p class="section-note">' + esc(ip.note) + '</p>' : '') +
        '</div><div class="cards">' +
        ip.characters.map(function (ch) { return cardHtml(ch); }).join('') +
        '</div></section>';
    }).join('');
  }

  var qEl = document.getElementById('q');
  qEl.addEventListener('input', function () {
    state.q = qEl.value;
    document.getElementById('clear').hidden = !qEl.value;
    draw();
  });
  document.getElementById('clear').addEventListener('click', function () {
    qEl.value = ''; state.q = ''; this.hidden = true; qEl.focus(); draw();
  });
  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    state.ip = b.dataset.ip;
    var all = this.querySelectorAll('.chip');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === b);
    draw();
  });
  /* 鼠标滚轮在 IP 分类条上横向滚动；滚到两端时把滚动交还给页面 */
  var chipsEl = document.getElementById('chips');
  chipsEl.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    var max = chipsEl.scrollWidth - chipsEl.clientWidth;
    if (max <= 1) return;
    var atStart = chipsEl.scrollLeft <= 1;
    var atEnd = chipsEl.scrollLeft >= max - 1;
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    e.preventDefault();
    chipsEl.scrollLeft = Math.max(0, Math.min(max, chipsEl.scrollLeft + e.deltaY));
  }, { passive: false });

  document.getElementById('theme').addEventListener('click', function () {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(state.theme);
    syncTheme();
  });

  /* 卡片内切换 / 展开（事件委托，重绘后依然有效） */
  app.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var card = btn.closest('.card');
    if (!card) return;
    var ch = index[card.dataset.id];
    var imgs = ch.images || [];
    var s = st(ch.id);
    var act = btn.dataset.act;
    if (act === 'next' && imgs.length) s.i = (s.i + 1) % imgs.length;
    else if (act === 'prev' && imgs.length) s.i = (s.i - 1 + imgs.length) % imgs.length;
    else if (act === 'toggle') s.open = !s.open;
    card.querySelector('.card-media').innerHTML = mediaInner(ch, s);
    var ex = card.querySelector('.expand');
    if (ex) ex.textContent = s.open ? '收起' : '展开全部 ' + imgs.length + ' 张';
    var old = card.querySelector('.inline-gallery');
    if (old) old.remove();
    if (s.open) card.insertAdjacentHTML('beforeend', galleryHtml(ch));
  });

  /* 图片缺失或路径错误时回退成占位块，不显示碎图 */
  app.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG') return;
    var ch = index[img.dataset.id];
    if (!ch) return;
    var ph = document.createElement('div');
    ph.className = 'ph';
    ph.innerHTML = '<span>' + esc(ch.name.slice(0, 1)) + '</span>';
    img.replaceWith(ph);
  }, true);

  syncTheme();
  draw();
})();
