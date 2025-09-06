// @ts-nocheck
(() => {
  'use strict';

  /* -------------------- Utilities -------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // simple debounce for resize-like events
  const debounce = (fn, wait = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  };

  // throttle using requestAnimationFrame
  const rafThrottle = (fn) => {
    let scheduled = false;
    return (...args) => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        fn.apply(null, args);
        scheduled = false;
      });
    };
  };

  // more robust visibility test for focusable elements
  const isVisible = (el) => {
    if (!el) return false;
    // element must have at least one client rect and non-zero area
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const r = rects[0];
    return r.width > 0 && r.height > 0;
  };

  /* ================= 1) Loader ================= */
  (() => {
    const loader = document.getElementById('loader');
    if (!loader) return;

    const hide = () => {
      if (loader.dataset.done === '1') return;
      loader.dataset.done = '1';
      loader.style.transition = 'opacity .35s ease, visibility .35s ease';
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
      setTimeout(() => {
        if (loader && loader.parentNode) loader.remove();
      }, 450);
    };

    // Prefer load event; fallback timeout
    window.addEventListener('load', hide, { once: true, passive: true });
    setTimeout(hide, 2500);
  })();

  /* ================= 2) Scroll Reveal ================= */
  (() => {
    const els = $$('.reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      els.forEach(el => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    els.forEach(el => io.observe(el));
  })();

  /* ================= 3) Active Nav / Ink ================= */
  (() => {
    const nav = $('.nav-list');
    if (!nav) return;

    const links = $$('.nav-list a', nav);
    const ink = $('.nav-ink', nav);
    const sections = $$('main > section[id]');
    const baseTitle = document.title || '';
    let activeLink = null;

    if (!links.length || !sections.length) {
      if (ink) ink.style.display = 'none';
      return;
    }

    const moveInk = (target) => {
      if (!ink || !target) return;
      const r = target.getBoundingClientRect();
      const pr = nav.getBoundingClientRect();
      ink.style.width = `${Math.max(0, r.width)}px`;
      ink.style.left = `${r.left - pr.left}px`;
    };

    const setActiveLink = (link) => {
      if (!link || link === activeLink) return;
      activeLink = link;
      links.forEach(a => a.classList.remove('is-active'));
      link.classList.add('is-active');

      const href = link.getAttribute('href') || '';
      const id = href.startsWith('#') ? href.slice(1) : null;
      const titleEl = id ? document.getElementById(id)?.querySelector('h1, h2') : null;
      document.title = titleEl ? `${titleEl.textContent.trim()} | ${baseTitle}` : baseTitle;

      moveInk(link);
    };

    // IntersectionObserver to find the current section in view
    const observer = new IntersectionObserver(entries => {
      // pick the entry with highest intersection ratio that isIntersecting
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      const link = links.find(a => a.getAttribute('href') === `#${id}`);
      if (link) setActiveLink(link);
    }, { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.01, 0.25, 0.5, 0.75, 1] });

    sections.forEach(s => observer.observe(s));

    // Smooth scroll for same-page anchors (centralized)
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        // prefer smooth if allowed
        const opts = prefersReducedMotion ? {} : { behavior: 'smooth' };
        try {
          target.scrollIntoView(opts);
          // update URL but avoid pushing identical hash multiple times
          if (location.hash !== id) history.pushState(null, '', id);
          else history.replaceState(null, '', id);
        } catch (err) {
          target.scrollIntoView();
        }
      });
    });

    links.forEach(a => a.addEventListener('mouseenter', () => moveInk(a)));
    nav.addEventListener('mouseleave', () => moveInk(activeLink || links[0]));
    window.addEventListener('resize', debounce(() => moveInk(activeLink || links[0]), 120));
    window.addEventListener('load', () => {
      const initial = location.hash ? links.find(a => a.getAttribute('href') === location.hash) : links[0];
      setActiveLink(initial || links[0]);
    });
  })();

  /* ================= 4) Header shadow ================= */
  (() => {
    const header = $('.site-header');
    if (!header) return;
    const onScroll = rafThrottle(() => header.classList.toggle('scrolled', window.scrollY > 8));
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ================= 5) Hero Slideshow (fade + gentle parallax) ================= */
  (() => {
    const slides = $$('.hero-slides img');
    if (!slides.length) return;

    let idx = 0;
    let intervalId = null;
    const show = (i) => slides.forEach((img, n) => img.classList.toggle('active', n === i));
    show(0);

    if (slides.length > 1 && !prefersReducedMotion) {
      intervalId = setInterval(() => {
        idx = (idx + 1) % slides.length;
        show(idx);
      }, 6000);
    }

    const hero = $('.hero');
    const onScroll = rafThrottle(() => {
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      // progress -1 (above) to 1 (below)
      const p = Math.max(-1, Math.min(1, (rect.top + rect.height * 0.4) / vh - 0.4));
      const active = slides.find(s => s.classList.contains('active')) || slides[0];
      // translate a few pixels & slight scale for depth
      const y = p * -12;
      active.style.transform = `translate3d(0, ${y}px, 0) scale(1.04)`;
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', onScroll, { once: true });

    // cleanup when navigating away (helps in SPA contexts)
    window.addEventListener('unload', () => {
      if (intervalId) clearInterval(intervalId);
    });
  })();

  /* ================= 6) Mobile Drawer ================= */
  (() => {
    const toggle = $('.nav-toggle');
    const drawer = $('.drawer');
    // prefer explicit id for scrim if present
    const scrim = document.getElementById('drawer-scrim') || document.querySelector('.scrim');
    if (!toggle || !drawer || !scrim) return;

    const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastFocused = null;

    const open = () => {
      lastFocused = document.activeElement;
      toggle.setAttribute('aria-expanded', 'true');
      drawer.classList.add('open');
      drawer.removeAttribute('aria-hidden');
      scrim.classList.add('is-visible');
      scrim.hidden = false;
      scrim.removeAttribute('aria-hidden');
      document.body.style.overflow = 'hidden';

      const first = drawer.querySelector(FOCUSABLE) || drawer.querySelector('.drawer-close') || toggle;
      first?.focus();

      document.addEventListener('keydown', handleKeydown);
    };

    const close = (restoreFocus = true) => {
      toggle.setAttribute('aria-expanded', 'false');
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      scrim.classList.remove('is-visible');
      scrim.hidden = true;
      scrim.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      document.removeEventListener('keydown', handleKeydown);
      if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(drawer.querySelectorAll(FOCUSABLE)).filter(isVisible);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    toggle.addEventListener('click', () => drawer.classList.contains('open') ? close() : open());
    scrim.addEventListener('click', () => close());
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) close();
    });

    // set initial aria state
    drawer.setAttribute('aria-hidden', 'true');
    scrim.hidden = true;
    scrim.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  })();

  /* ================= 7) Contact Form ================= */
  (() => {
    const form = document.getElementById('contact-form');
    const feedbackEl = document.getElementById('contact-feedback');
    if (!form || !feedbackEl) return;

    let abortController = null;

    // Basic client-side validation hook (optional)
    const validate = (data) => {
      // return { ok: true } or { ok: false, message: '...' }
      // Implement your validations here; currently always OK.
      return { ok: true };
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // prevent double submits
      if (form.getAttribute('aria-busy') === 'true') return;

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const v = validate(data);
      if (!v.ok) {
        feedbackEl.textContent = v.message || 'Please check the form fields.';
        feedbackEl.style.color = 'var(--danger)';
        return;
      }

      // Abort previous pending request if any
      try {
        if (abortController) {
          abortController.abort();
        }
      } catch (_) { /* ignore */ }

      abortController = new AbortController();

      feedbackEl.textContent = 'Sending...';
      feedbackEl.style.color = 'var(--muted)';
      form.setAttribute('aria-busy', 'true');

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: abortController.signal,
        });

        // non-JSON ok responses handled gracefully
        const contentType = res.headers.get('Content-Type') || '';
        const result = contentType.includes('application/json') ? await res.json() : { message: await res.text() };

        if (!res.ok) {
          throw new Error(result?.message || `Server returned ${res.status}`);
        }

        feedbackEl.textContent = result.message || 'Message sent — thank you!';
        feedbackEl.style.color = 'var(--success)';
        form.reset();
      } catch (err) {
        if (err.name === 'AbortError') {
          feedbackEl.textContent = 'Request cancelled.';
        } else {
          console.error('Contact form error:', err);
          feedbackEl.textContent = err.message || 'An error occurred. Please try again later.';
        }
        feedbackEl.style.color = 'var(--danger)';
      } finally {
        form.setAttribute('aria-busy', 'false');
        setTimeout(() => {
          if (feedbackEl) feedbackEl.textContent = '';
        }, 5000);
      }
    });
  })();

  /* ================= 8) Year ================= */
  (() => {
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  })();

  /* ================= About gallery lightbox ================= */
  (() => {
    const thumbs = $$('.about-thumb');
    const dlg = document.getElementById('about-lightbox');
    const img = dlg?.querySelector('.lightbox-img');
    const closeBtn = dlg?.querySelector('.lightbox-close');

    if (!thumbs.length || !dlg || !img) return;

    // If <dialog> isn't available, provide a minimal fallback
    const useDialog = typeof HTMLDialogElement !== 'undefined' && typeof dlg.showModal === 'function';

    const open = (src) => {
      img.src = src;
      if (useDialog) {
        try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); } // safe fallback
        closeBtn?.focus();
      } else {
        dlg.classList.add('open-fallback');
        dlg.setAttribute('aria-hidden', 'false');
      }
    };

    const close = () => {
      if (useDialog) {
        try { dlg.close(); } catch (_) { dlg.removeAttribute('open'); }
      } else {
        dlg.classList.remove('open-fallback');
        dlg.setAttribute('aria-hidden', 'true');
      }
      // release memory / stop loads
      img.src = '';
    };

    thumbs.forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.getAttribute('data-full') || btn.querySelector('img')?.src;
        if (src) open(src);
      });
    });

    closeBtn?.addEventListener('click', close);

    // click outside image closes (for dialog)
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if ((useDialog && dlg.open) || dlg.classList.contains('open-fallback')) close();
      }
    });
  })();

})();

// Drawer accessibility & focus-trap (kept outside IIFE above for clarity)
(() => {
  const drawer = document.getElementById('drawer-menu');
  const scrim = document.getElementById('drawer-scrim') || document.querySelector('.scrim');
  const toggle = document.querySelector('.nav-toggle'); // your hamburger button
  const closeBtns = drawer ? drawer.querySelectorAll('[data-drawer-dismiss], .drawer-close') : [];
  const links = drawer ? Array.from(drawer.querySelectorAll('a[href^="#"], .drawer-nav a')) : [];
  if (!drawer || !scrim || !toggle) return;

  // Focusable selector used in trap
  const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let lastFocused = null;

  const openDrawer = () => {
    lastFocused = document.activeElement;
    drawer.classList.add('open');
    drawer.removeAttribute('aria-hidden');
    scrim.classList.add('is-visible');
    scrim.hidden = false;
    scrim.removeAttribute('aria-hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    const first = drawer.querySelector(FOCUSABLE) || drawer.querySelector('.drawer-close');
    first && first.focus();

    document.addEventListener('keydown', handleKeydown);
  };

  const closeDrawer = (restoreFocus = true) => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('is-visible');
    scrim.hidden = true;
    scrim.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    document.removeEventListener('keydown', handleKeydown);
    if (restoreFocus && lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  };

  const handleKeydown = (e) => {
    // ESC closes drawer
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // focus trap: Tab / Shift+Tab
    if (e.key === 'Tab') {
      const focusable = Array.from(drawer.querySelectorAll(FOCUSABLE)).filter(isVisible);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Toggle button behavior
  toggle.addEventListener('click', () => {
    if (drawer.classList.contains('open')) closeDrawer();
    else openDrawer();
  });

  // scrim clicks close
  scrim.addEventListener('click', () => closeDrawer());

  // internal close buttons/hamburger inside drawer
  closeBtns.forEach(btn => btn.addEventListener('click', () => closeDrawer()));

  // when a nav link is clicked, close drawer and update aria-current
  links.forEach(a => {
    a.addEventListener('click', (ev) => {
      closeDrawer(false); // don't restore focus to previously focused element (we navigate)
      links.forEach(l => l.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');
    });
  });

  // Close drawer when route changes via popstate (optional)
  window.addEventListener('popstate', () => {
    if (drawer.classList.contains('open')) closeDrawer();
  });

  // Ensure initial states are correct (server-render friendly)
  drawer.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
  scrim.setAttribute('aria-hidden', 'true');
  toggle.setAttribute('aria-expanded', 'false');
})();

/* ================= Utility: Close all overlays on startup ================= */
(() => {
  function closeAllOverlays() {
    // Close native dialogs (if any are open) and ensure they are hidden
    document.querySelectorAll('dialog').forEach((dlg) => {
      try {
        // If dialog API exists and dialog is open, close it
        if (typeof dlg.close === 'function' && dlg.hasAttribute('open')) {
          try { dlg.close(); } catch (_) { dlg.removeAttribute('open'); }
        } else {
          // remove any leftover 'open' attribute and inline display styles
          dlg.removeAttribute('open');
        }
      } catch (err) {
        // defensive: ignore any errors
        console.warn('closeAllOverlays: dialog close failed', err);
      } finally {
        // reset visual state in case inline styles force it visible
        try { dlg.style.display = 'none'; } catch (_) { }
        try { dlg.classList.remove('open-fallback', 'closing'); } catch (_) { }
        try { dlg.setAttribute('aria-hidden', 'true'); } catch (_) { }
      }
    });

    // Hide scrims / fallback scrims
    document.querySelectorAll('.scrim, .modal-scrim, #svc-scrim, #drawer-scrim').forEach((s) => {
      try { s.classList.remove('is-visible'); } catch (_) { }
      try { s.hidden = true; } catch (_) { }
      try { s.setAttribute('aria-hidden', 'true'); } catch (_) { }
      try { s.style.pointerEvents = 'none'; } catch (_) { }
      try { s.style.opacity = ''; } catch (_) { }
    });

    // Ensure drawer is closed
    const drawer = document.getElementById('drawer-menu') || document.getElementById('drawer');
    if (drawer) {
      try { drawer.classList.remove('open'); } catch (_) { }
      try { drawer.setAttribute('aria-hidden', 'true'); } catch (_) { }
    }

    // Reset body overflow (in case it was locked)
    try { document.body.style.overflow = ''; } catch (_) { }

    // Reset any modal overlay classes that could cover page
    document.querySelectorAll('.open, .open-fallback, .closing').forEach((el) => {
      try { el.classList.remove('open', 'open-fallback', 'closing'); } catch (_) { }
    });
  }

  // Run on DOM ready and pageshow (handles bfcache navigation)
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(closeAllOverlays, 20);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(closeAllOverlays, 20));
  }
  window.addEventListener('pageshow', () => setTimeout(closeAllOverlays, 20));
})();
