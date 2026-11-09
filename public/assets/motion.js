/* Scroll motion, modelled on the reference site's feel:
   smooth scroll, pinned hero with frames flying outward, word-by-word brightening,
   content rising in, clip-path reveal on media, section lag as the next block covers it.
   Everything is skipped for prefers-reduced-motion or if the libraries fail to load. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  if (reduce || !gsap || !ST) { document.documentElement.classList.remove('motion-pending'); return; }

  gsap.registerPlugin(ST);
  var root = document.documentElement;
  root.classList.add('motion');

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(1000, 16);
  }

  // In-page links glide, then move focus to the target for keyboard and screen reader users.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    var id = a.getAttribute('href');
    var target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, {
      duration: 1.6,
      onComplete: function () {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        history.replaceState(null, '', id);
      }
    });
  });

  /* ---------- Hero ---------- */
  var hero = document.querySelector('.hero');
  var stage = hero && hero.querySelector('.hero-stage');
  var frames = hero ? gsap.utils.toArray(hero.querySelectorAll('.frame')) : [];
  var line2 = hero && hero.querySelector('.line2');

  if (hero && stage) {
    var mm = gsap.matchMedia();

    // Frames fade in one by one, then bob gently.
    gsap.from(frames, { opacity: 0, duration: 1.4, stagger: 0.06, ease: 'power2.out' });
    frames.forEach(function (f, i) {
      gsap.to(f.querySelector('.frame-in'), { yPercent: i % 2 ? 5 : -5, duration: 3 + (i % 3), repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });

    var buildHero = function (pinned) {
      if (pinned) root.classList.add('hero-pinned');
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: pinned ? 'bottom bottom' : 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });
      // Frames fly away from the centre and grow.
      frames.forEach(function (f) {
        tl.to(f, {
          x: function () { var r = f.getBoundingClientRect(), s = stage.getBoundingClientRect(); return (r.left + r.width / 2 - (s.left + s.width / 2)) * 0.9; },
          y: function () { var r = f.getBoundingClientRect(), s = stage.getBoundingClientRect(); return (r.top + r.height / 2 - (s.top + s.height / 2)) * 0.9; },
          scale: 1.9,
          ease: 'power1.in'
        }, 0);
      });
      // The second headline line arrives early in the scroll.
      if (line2) tl.fromTo(line2, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.25, ease: 'none' }, 0.03);
      return function () { root.classList.remove('hero-pinned'); };
    };

    mm.add('(min-width: 720px) and (min-height: 700px)', function () { return buildHero(true); });
    mm.add('(max-width: 719px), (max-height: 699px)', function () { return buildHero(false); });
  }

  root.classList.remove('motion-pending');

  /* ---------- Word-by-word brightening ---------- */
  var seg = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Phrases stay on one line unless one is wider than its block (long Thai runs have no spaces), then it wraps between words.
  var fitPhrases = function (el) {
    var max = el.clientWidth;
    el.querySelectorAll('.ph').forEach(function (ph) {
      ph.classList.add('nw');
      if (ph.offsetWidth > max) ph.classList.remove('nw');
    });
  };
  var refit = function () { document.querySelectorAll('[data-reveal]').forEach(fitPhrases); };
  var refitTimer;
  window.addEventListener('resize', function () { clearTimeout(refitTimer); refitTimer = setTimeout(refit, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    var text = el.textContent.trim();
    var min = parseFloat(el.getAttribute('data-reveal')) || 0.4;
    // Lines only break at the spaces the copy already has; words inside a phrase brighten one by one.
    var phrases = text.split(/\s+/).map(function (ph) {
      var words = seg ? Array.from(seg.segment(ph), function (x) { return x.segment; }) : [ph];
      return '<span class="nw ph">' + words.map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join('') + '</span>';
    });
    el.innerHTML = '<span class="sr-only">' + esc(text) + '</span><span aria-hidden="true">' + phrases.join(' ') + '</span>';
    fitPhrases(el);
    gsap.fromTo(el.querySelectorAll('.w'), { opacity: min }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: true }
    });
  });

  /* ---------- Content rises in ---------- */
  var risers = gsap.utils.toArray([
    '.section-head > *', '.kicker', '.rule-list li', '.problem-list li',
    '.package', '.addon', '.feature-list li', '.timeline li', '.faq details',
    '.form-intro > *', '.form-wrap', '.disclaimer', '.footer-row'
  ].join(','));
  gsap.set(risers, { opacity: 0, y: 60 });
  var rise = function (batch) { gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', overwrite: true }); };
  // onLeave covers jumps past an element (hash links, End key, find in page) so nothing stays hidden.
  ST.batch(risers, { start: 'top 92%', once: true, onEnter: rise, onLeave: rise });

  /* ---------- Media: clip-path reveal + drift ---------- */
  gsap.utils.toArray('.chat').forEach(function (m) {
    gsap.fromTo(m, { clipPath: 'inset(10% 7% 10% 7% round 24px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'none',
      scrollTrigger: { trigger: m, start: 'top 95%', end: 'top 35%', scrub: true }
    });
    gsap.fromTo(m.querySelector('.chat-body'), { y: 24 }, {
      y: -24, ease: 'none',
      scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* ---------- Section lag: each block's content eases down as the next block covers it ---------- */
  var blocks = gsap.utils.toArray('main > .section');
  blocks.forEach(function (sec, i) {
    var next = blocks[i + 1];
    var inner = sec.querySelector(':scope > .container');
    if (!next || !inner) return;
    gsap.fromTo(inner, { yPercent: 0 }, {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true }
    });
  });

  /* ---------- Footer slides up into view ---------- */
  var footer = document.querySelector('.site-footer > .container');
  if (footer) {
    gsap.from(footer, {
      yPercent: -25, opacity: 0.5, ease: 'none',
      scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
  }

  /* Re-measure once fonts and images settle */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  window.addEventListener('load', function () { ST.refresh(); });
})();
