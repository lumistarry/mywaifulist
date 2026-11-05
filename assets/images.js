/* 图片延迟加载：等页面结构、样式、文字全部就绪后，再自动加载图片。
   - 初始 HTML 里没有任何 <img src>，浏览器不会为图片发请求
   - 页面 load 之后，利用浏览器空闲时段启动
   - 视口内（含上下 600px 预取）优先；其余在空闲时后台补齐
   - 同时最多 3 张，避免带宽突发；失败则保留文字占位块 */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;

  var MAX = 3;
  var active = 0;
  var queue = [];
  var pending = [];
  var started = false;
  var filling = false;

  function schedule(fn) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1500 });
    else setTimeout(fn, 150);
  }

  function pump() {
    if (!started) return;
    while (active < MAX && queue.length) {
      var el = queue.shift();
      if (!el.isConnected || el.dataset.done) continue;
      active++;
      load(el);
    }
  }

  function finish(el) {
    el.dataset.done = '1';
    active--;
    pump();
  }

  /* 记住已成功加载的图片，供列表重绘时直接复用，避免切换分类后重新加载/淡入 */
  var loaded = Object.create(null);
  window.DeferredImages = {
    isLoaded: function (src) { return !!loaded[src]; }
  };

  function show(el, src) {
    var img = document.createElement('img');
    img.src = src;
    img.alt = el.getAttribute('data-alt') || '';
    img.decoding = 'async';
    img.className = 'is-loaded';
    img.dataset.id = el.getAttribute('data-id') || '';
    loaded[src] = 1;
    el.replaceWith(img);
  }

  function load(el) {
    var src = el.getAttribute('data-src');
    var pre = new Image();
    pre.onload = function () {
      if (el.isConnected) show(el, src);
      finish(el);
    };
    pre.onerror = function () {
      el.classList.remove('ph-pending');
      finish(el);
    };
    pre.src = src;
  }

  function enqueue(el, front) {
    if (el.dataset.queued) return;
    el.dataset.queued = '1';
    if (front) queue.unshift(el); else queue.push(el);
    pump();
  }

  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          enqueue(e.target, true);
        });
      }, { rootMargin: '600px 0px' })
    : null;

  function collect() {
    var nodes = app.querySelectorAll('.ph-pending[data-src]:not([data-seen])');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.dataset.seen = '1';
      pending.push(el);
      if (io) io.observe(el);
    }
    if (started) fill();
  }

  function fill() {
    if (filling || !started) return;
    filling = true;
    step();
  }

  function step() {
    schedule(function () {
      pending = pending.filter(function (p) { return p.isConnected && !p.dataset.done; });
      var added = 0;
      for (var i = 0; i < pending.length && added < MAX; i++) {
        if (!pending[i].dataset.queued) {
          enqueue(pending[i]);
          added++;
        }
      }
      if (pending.length) {
        if (added) step(); else setTimeout(step, 300);
      } else {
        filling = false;
      }
    });
  }

  function start() {
    if (started) return;
    started = true;
    collect();
    fill();
    pump();
  }

  if ('MutationObserver' in window) {
    new MutationObserver(collect).observe(app, { childList: true, subtree: true });
  }
  if (document.readyState === 'complete') schedule(start);
  else window.addEventListener('load', function () { schedule(start); });
})();
