(function () {
  var root = document.documentElement;

  // 테마 전환. 기본은 밝은 테마이고 OS 설정은 따르지 않는다
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // 아키텍처 그림 확대
  document.querySelectorAll('.diagram img').forEach(function (img) {
    img.addEventListener('click', function () {
      var box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', img.alt);
      var big = document.createElement('img');
      big.src = img.src;
      big.alt = img.alt;
      box.appendChild(big);
      var close = function () {
        box.remove();
        document.removeEventListener('keydown', onKey, true);
      };
      // 모달 안 그림은 Esc가 모달까지 닫지 않게 막고, 모달 위에 보이도록 모달 안에 붙인다
      var onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
      box.addEventListener('click', close);
      document.addEventListener('keydown', onKey, true);
      (img.closest('dialog[open]') || document.body).appendChild(box);
    });
  });

  // NOVA 요청 흐름: 단계별 재생
  document.querySelectorAll('[data-flow]').forEach(function (box) {
    var svg = box.querySelector('svg');
    var dot = svg.querySelector('.flow-dot');
    var btns = box.querySelectorAll('.flow-steps button');
    var caps = box.querySelectorAll('.flow-cap p');
    var play = box.querySelector('.flow-play');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var T = 87, B = 225;
    var S = [
      { n: ['user'], e: [], p: [[76, T]] },
      { n: ['edge'], e: ['user-edge'], p: [[76, T], [226, T]] },
      { n: ['wr', 'valkey'], e: ['edge-wr', 'wr-valkey'], p: [[226, T], [376, T], [376, B], [376, T]] },
      { n: ['po', 'db'], e: ['wr-po', 'po-db'], p: [[376, T], [526, T], [526, B], [526, T]] },
      { n: ['sqs'], e: ['po-sqs'], p: [[526, T], [676, T]] },
      { n: ['wk'], e: ['sqs-wk'], p: [[676, T], [826, T]] },
      { n: ['ext'], e: ['wk-ext'], p: [[826, T], [976, T]] },
      { n: ['dlq', 'slack'], e: ['sqs-dlq', 'dlq-slack'], p: [[676, T], [676, B], [826, B]], warn: true }
    ];
    var cur = -1, timer = null, raf = null, playing = false;
    var mark = function (i) {
      svg.querySelectorAll('.node, .edge').forEach(function (el) { el.classList.remove('on', 'done'); });
      for (var k = 0; k <= i; k++) {
        S[k].n.forEach(function (id) { var el = svg.querySelector('[data-n="' + id + '"]'); if (el) el.classList.add(k === i ? 'on' : 'done'); });
        S[k].e.forEach(function (id) { var el = svg.querySelector('[data-e="' + id + '"]'); if (el) el.classList.add(k === i ? 'on' : 'done'); });
      }
      btns.forEach(function (b, k) { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); });
      caps.forEach(function (c, k) { c.hidden = k !== i; });
      dot.classList.toggle('warn', !!S[i].warn);
      var sc = box.querySelector('.flow-scroll');
      if (sc && sc.scrollWidth > sc.clientWidth + 4) {
        var r = svg.querySelector('[data-n="' + S[i].n[0] + '"] rect');
        var scale = svg.getBoundingClientRect().width / 1056;
        var cx = (+r.getAttribute('x') + 64) * scale;
        sc.scrollTo({ left: Math.max(0, cx - sc.clientWidth / 2), behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    var move = function (pts, done) {
      cancelAnimationFrame(raf);
      var place = function (x, y) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); };
      if (reduce || pts.length < 2) { var l = pts[pts.length - 1]; place(l[0], l[1]); if (done) done(); return; }
      var segs = [], total = 0;
      for (var k = 1; k < pts.length; k++) {
        var d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        segs.push(d); total += d;
      }
      var dur = Math.max(500, total / 0.32), t0 = null;
      var tick = function (ts) {
        if (t0 === null) t0 = ts;
        var r = Math.min(1, (ts - t0) / dur), e = r < .5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2;
        var dist = e * total, k = 0;
        while (k < segs.length - 1 && dist > segs[k]) { dist -= segs[k]; k++; }
        var f = segs[k] ? dist / segs[k] : 1, a = pts[k], b = pts[k + 1];
        place(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
        if (r < 1) raf = requestAnimationFrame(tick); else if (done) done();
      };
      raf = requestAnimationFrame(tick);
    };
    var go = function (i, cb) { cur = i; mark(i); move(S[i].p, cb); };
    var stop = function () {
      playing = false; clearTimeout(timer); box.classList.remove('playing');
      play.querySelector('.flow-play-t').textContent = cur >= S.length - 1 ? '다시 재생' : '재생';
    };
    var step = function () {
      if (!playing) return;
      if (cur >= S.length - 1) { stop(); return; }
      go(cur + 1, function () { timer = setTimeout(step, 1700); });
    };
    var start = function () {
      playing = true; box.classList.add('playing');
      play.querySelector('.flow-play-t').textContent = '멈춤';
      if (cur >= S.length - 1) cur = -1;
      step();
    };
    play.addEventListener('click', function () { if (playing) stop(); else start(); });
    btns.forEach(function (b, k) { b.addEventListener('click', function () { stop(); go(k); }); });
    go(0);
    if (!reduce && 'IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { seen.disconnect(); setTimeout(start, 500); }
      }, { threshold: 0.5 });
      seen.observe(box);
    }
  });

  // 결과 타일을 누르면 해당 항목을 펼쳐 보여 준다
  var openTarget = function (hash) {
    if (!hash || hash.length < 2) return;
    var el = document.getElementById(hash.slice(1));
    if (el && el.tagName === 'DETAILS') {
      el.open = true;
      setTimeout(function () { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' }); }, 0);
    }
  };
  document.querySelectorAll('a[href^="#s-"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      history.replaceState(null, '', a.getAttribute('href'));
      openTarget(a.getAttribute('href'));
    });
  });
  if (/^#s-/.test(location.hash)) window.addEventListener('load', function () { openTarget(location.hash); });

  // 프로젝트 목차: 지금 보는 위치를 표시하고, 누르면 그 항목으로 이동해 펼친다
  (function () {
    var work = document.getElementById('work');
    var cases = document.querySelectorAll('.case[data-toc]');
    if (!work || !cases.length) return;
    var items = [].slice.call(document.querySelectorAll('.stories details[data-toc]:not([hidden])'));
    var nav = document.createElement('nav');
    nav.className = 'toc'; nav.setAttribute('aria-label', '프로젝트 목차');
    var html = '<p class="toc-h">프로젝트 목차</p><ol>';
    cases.forEach(function (c) {
      html += '<li class="toc-case" data-case="' + c.id + '"><a href="#' + c.id + '">' + c.dataset.toc + '</a><ol>';
      var inGrp = false;
      c.querySelectorAll('.stories > .group, .stories > details[data-toc]:not([hidden])').forEach(function (el) {
        if (el.tagName === 'P') {
          if (inGrp) html += '</ol></li>';
          html += '<li class="toc-grp"><span class="toc-g">' + el.textContent + '</span><ol>'; inGrp = true;
        } else html += '<li class="toc-item"><a href="#' + el.id + '" data-id="' + el.id + '">' + el.dataset.toc + '</a></li>';
      });
      if (inGrp) html += '</ol></li>';
      html += '</ol></li>';
    });
    nav.innerHTML = html + '</ol>';
    document.body.appendChild(nav);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'toc-btn'; btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '☰ <span>프로젝트 목차</span>';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      var on = nav.classList.toggle('panel'); btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) {
        var c = nav.querySelector('.toc-item a.cur') || nav.querySelector('.toc-case.cur > a');
        if (c) nav.scrollTop = c.offsetTop - nav.clientHeight / 3;
      }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('panel') && !nav.contains(e.target) && !btn.contains(e.target)) {
        nav.classList.remove('panel'); btn.setAttribute('aria-expanded', 'false');
      }
    });

    var go = function (d) {
      items.forEach(function (o) { if (o !== d && o.open) o.open = false; });
      d.open = true;
      window.scrollTo({ top: d.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' });
      nav.classList.remove('panel'); btn.setAttribute('aria-expanded', 'false');
      spy();
    };
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return;
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      if (el.tagName === 'DETAILS') go(el);
      else { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' }); nav.classList.remove('panel'); }
    });

    // 펼친 항목 끝에 이전, 접기, 다음 버튼
    items.forEach(function (d, i) {
      var end = document.createElement('div'); end.className = 'story-end';
      var prev = items[i - 1], next = items[i + 1];
      var here = d.closest('.case');
      var label = function (o) {
        var c = o.closest('.case');
        return c !== here ? c.dataset.toc + ' · ' + o.dataset.toc : o.dataset.toc;
      };
      end.innerHTML = (prev ? '<button type="button" class="prev">← ' + label(prev) + '</button>' : '<span></span>') +
        '<button type="button" class="fold">접기</button>' +
        (next ? '<button type="button" class="next">' + (next.closest('.case') !== here ? '다음 프로젝트: ' : '') + label(next) + ' →</button>' : '<span></span>');
      d.querySelector('.story').appendChild(end);
      end.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.classList.contains('prev')) go(prev);
        else if (b.classList.contains('next')) go(next);
        else { d.open = false; window.scrollTo({ top: d.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' }); spy(); }
      });
    });

    var links = nav.querySelectorAll('.toc-item a');
    var label = btn.querySelector('span');
    var spy = function () {
      var r = work.getBoundingClientRect();
      var inWork = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.3;
      // 휴대폰에서는 결과 카드가 버튼 자리에 오면 버튼을 잠시 숨겨 숫자를 가리지 않게 함
      var hide = false;
      if (window.innerWidth <= 640) {
        document.querySelectorAll('.case .hl').forEach(function (h) {
          var b = h.getBoundingClientRect();
          if (b.top < window.innerHeight && b.bottom > window.innerHeight - 80) hide = true;
        });
      }
      nav.classList.toggle('show', inWork); btn.classList.toggle('show', inWork && !hide);
      if (!inWork) nav.classList.remove('panel');
      var line = 90, cur = null, curCase = null;
      items.forEach(function (d) { if (d.getBoundingClientRect().top <= line + 40) cur = d; });
      cases.forEach(function (c) { if (c.getBoundingClientRect().top <= line + 40) curCase = c; });
      if (cur && curCase && !curCase.contains(cur)) cur = null;
      if (cur && !cur.open && cur.getBoundingClientRect().bottom < line) cur = null;
      links.forEach(function (a) {
        var d = document.getElementById(a.dataset.id);
        a.classList.toggle('cur', !!cur && d === cur);
        a.classList.toggle('open', d.open);
      });
      nav.querySelectorAll('.toc-case').forEach(function (li) {
        li.classList.toggle('cur', !!curCase && li.dataset.case === curCase.id);
      });
      label.innerHTML = curCase ? '<b>' + curCase.dataset.toc + '</b>' + (cur ? ' · ' + cur.dataset.toc : '') : '프로젝트 목차';
    };
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; spy(); });
    }, { passive: true });
    window.addEventListener('resize', spy);
    items.forEach(function (d) { d.addEventListener('toggle', spy); });
    spy();
  })();

  // 개인 프로젝트: 카드를 누르면 모달로 연다. #p-이름 주소로 바로 열 수도 있다
  (function () {
    var dialogs = document.querySelectorAll('dialog.pmodal');
    if (!dialogs.length || typeof HTMLDialogElement === 'undefined') return;
    var lastCard = null;
    var open = function (d, push) {
      if (d.open) return;
      d.showModal(); root.classList.add('modal-open'); d.querySelector('.pmodal-body').scrollTop = 0;
      if (push) history.replaceState(null, '', '#' + d.id);
    };
    var close = function (d) { if (d.open) d.close(); };
    dialogs.forEach(function (d) {
      d.querySelector('.pmodal-close').addEventListener('click', function () { close(d); });
      d.addEventListener('click', function (e) { if (e.target === d) close(d); });
      d.addEventListener('close', function () {
        root.classList.remove('modal-open');
        if (location.hash === '#' + d.id) history.replaceState(null, '', '#deep');
        if (lastCard) lastCard.focus();
      });
    });
    document.querySelectorAll('a.dcard[href^="#p-"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var d = document.getElementById(a.getAttribute('href').slice(1));
        if (!d) return;
        e.preventDefault(); lastCard = a; open(d, true);
      });
    });
    var fromHash = function () {
      var d = /^#p-/.test(location.hash) && document.getElementById(location.hash.slice(1));
      if (d && d.tagName === 'DIALOG') {
        var deep = document.getElementById('deep');
        if (deep) window.scrollTo({ top: deep.getBoundingClientRect().top + window.scrollY - 60, behavior: 'instant' });
        lastCard = document.querySelector('a.dcard[href="' + location.hash + '"]');
        open(d, false);
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  })();

  // 프로젝트 카드: 마우스로 끌어서 좌우로 넘기고, 화살표 버튼으로도 넘긴다
  (function () {
    var strip = document.querySelector('.pcards');
    if (!strip) return;
    // 카드는 링크라서 그대로 두면 브라우저가 링크 끌기(주소 끌어다 놓기)를 시작해 넘기기가 멈춘다
    strip.querySelectorAll('a, img').forEach(function (el) { el.setAttribute('draggable', 'false'); });
    strip.addEventListener('dragstart', function (e) { e.preventDefault(); });
    // 띠는 화면 양 끝까지 늘리고, 첫 카드와 멈추는 자리는 본문 왼쪽 선에 맞춘다
    var setGut = function () {
      var wrap = strip.parentElement, l = wrap.getBoundingClientRect().left, r = document.documentElement.clientWidth - wrap.getBoundingClientRect().right;
      strip.style.setProperty('--gl', l + 'px'); strip.style.setProperty('--gr', r + 'px');
    };
    setGut(); window.addEventListener('resize', setGut);
    var down = false, moved = false, startX = 0, startLeft = 0;
    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = strip.scrollLeft;
      e.preventDefault(); // 글자 선택과 링크 끌기를 막는다
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; strip.classList.add('dragging'); }
      if (moved) strip.scrollLeft = startLeft - dx;
    });
    var end = function () {
      if (!down) return;
      down = false;
      if (moved) {
        strip.classList.remove('dragging');
        // 끌기를 놓은 자리에서 가장 가까운 카드로 맞춘다
        var cards = strip.querySelectorAll('.pcard'), best = 0, bd = Infinity;
        var pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
        var pos = function (c) { return c.offsetLeft - strip.offsetLeft - pad; };
        cards.forEach(function (c, i) { var d = Math.abs(pos(c) - strip.scrollLeft); if (d < bd) { bd = d; best = i; } });
        strip.scrollTo({ left: pos(cards[best]), behavior: 'smooth' });
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    // 끌고 난 뒤의 클릭은 카드 이동으로 보지 않는다
    strip.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

    var prev = document.querySelector('.pc-prev'), next = document.querySelector('.pc-next');
    var step = function () { var c = strip.querySelector('.pcard'); return c ? c.getBoundingClientRect().width + 24 : 400; };
    var sync = function () {
      if (!prev) return;
      prev.disabled = strip.scrollLeft < 4;
      next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4;
    };
    if (prev) {
      prev.addEventListener('click', function () { strip.scrollBy({ left: -step(), behavior: 'smooth' }); });
      next.addEventListener('click', function () { strip.scrollBy({ left: step(), behavior: 'smooth' }); });
    }
    strip.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    strip.addEventListener('keydown', function (e) {
      if (e.target !== strip) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); strip.scrollBy({ left: step(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); strip.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });
    window.addEventListener('resize', sync);
    sync();
  })();

  // 프로젝트 상세: 상단 메뉴 아래 읽은 만큼 차는 진행 막대
  (function () {
    var bar = document.querySelector('.nav-proj .nav-progress');
    if (!bar) return;
    var tick = false;
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      tick = false;
    };
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  // 스크롤하면 섹션이 차례로 나타난다
  var targets = document.querySelectorAll('.principles article, .case, .ai, .dcard, .timeline > li, .certs li, .stack > div');
  if (!('IntersectionObserver' in window)) { root.classList.add('no-io'); return; }
  targets.forEach(function (el) { el.classList.add('reveal'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(function (el) { io.observe(el); });
})();
