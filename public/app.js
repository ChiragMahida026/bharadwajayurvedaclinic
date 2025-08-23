// @ts-nocheck
(() => {
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
      setTimeout(() => loader.remove(), 450);
    };
    window.addEventListener('load', hide, { once: true });
    setTimeout(hide, 2500);
  })();

  /* ================= 2) Scroll Reveal ================= */
  (() => {
    const els = document.querySelectorAll('.reveal');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  })();

  /* ================= 3) Active Nav / Ink ================= */
  (() => {
    const nav = document.querySelector('.nav-list');
    const links = Array.from(document.querySelectorAll('.nav-list a'));
    const ink = document.querySelector('.nav-ink');
    const sections = Array.from(document.querySelectorAll('main > section[id]'));
    const baseTitle = document.title;
    let activeLink = null;
    if (!links.length || !sections.length || !nav) return;

    const moveInk = (target) => {
      if (!ink || !target) return;
      const r = target.getBoundingClientRect();
      const pr = nav.getBoundingClientRect();
      ink.style.width = `${r.width}px`;
      ink.style.left = `${r.left - pr.left}px`;
    };

    const setActiveLink = (link) => {
      if (!link || link === activeLink) return;
      activeLink = link;
      links.forEach(a => a.classList.remove('is-active'));
      link.classList.add('is-active');

      const id = link.getAttribute('href').slice(1);
      const titleEl = document.getElementById(id)?.querySelector('h1, h2');
      document.title = titleEl ? `${titleEl.textContent.trim()} | ${baseTitle}` : baseTitle;

      moveInk(link);
    };

    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(e => e.isIntersecting);
      if (!entry) return;
      const id = entry.target.id;
      const link = links.find(a => a.getAttribute('href') === `#${id}`);
      if (link) setActiveLink(link);
    }, { rootMargin: '-50% 0px -50% 0px' });

    sections.forEach(s => observer.observe(s));

    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', id);
      });
    });

    links.forEach(a => a.addEventListener('mouseenter', () => moveInk(a)));
    nav.addEventListener('mouseleave', () => moveInk(activeLink || links[0]));
    window.addEventListener('resize', () => moveInk(activeLink || links[0]));

    window.addEventListener('load', () => {
      const initial = location.hash
        ? links.find(a => a.getAttribute('href') === location.hash)
        : links[0];
      setActiveLink(initial || links[0]);
    });
  })();

  /* ================= 4) Header shadow ================= */
  (() => {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  /* ================= 5) Hero Slideshow (fade + gentle parallax) ================= */
  (() => {
    const slides = Array.from(document.querySelectorAll('.hero-slides img'));
    if (!slides.length) return;

    let i = 0;
    const show = (idx) => slides.forEach((img, n) => img.classList.toggle('active', n === idx));
    show(0);

    if (slides.length > 1) {
      setInterval(() => {
        i = (i + 1) % slides.length;
        show(i);
      }, 6000); // calm
    }

    // Gentle parallax on scroll (depth without distraction)
    const onScroll = () => {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      // progress -1 (above) to 1 (below), clamp to [-1,1]
      const p = Math.max(-1, Math.min(1, (rect.top + rect.height * 0.4) / vh - 0.4));
      const active = slides.find(s => s.classList.contains('active')) || slides[0];
      // translate a few pixels & slight scale for depth
      const y = p * -12; // move opposite to scroll
      active.style.transform = `translate3d(0, ${y}px, 0) scale(1.04)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', onScroll, { once: true });
  })();


  /* ================= 6) Mobile Drawer ================= */
  (() => {
    const toggle = document.querySelector('.nav-toggle');
    const drawer = document.querySelector('.drawer');
    const scrim = document.querySelector('.scrim');
    if (!toggle || !drawer || !scrim) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      drawer.classList.toggle('open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      scrim.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    };

    toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('open')));
    scrim.addEventListener('click', () => setOpen(false));
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false);
    });
  })();

  /* ================= 7) Contact Form ================= */
  (() => {
    const form = document.getElementById('contact-form');
    const feedbackEl = document.getElementById('contact-feedback');
    if (!form || !feedbackEl) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      feedbackEl.textContent = 'Sending...';
      feedbackEl.style.color = 'var(--muted)';
      form.setAttribute('aria-busy', 'true');

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'An error occurred.');

        feedbackEl.textContent = result.message;
        feedbackEl.style.color = 'var(--success)';
        form.reset();
      } catch (err) {
        feedbackEl.textContent = err.message;
        feedbackEl.style.color = 'var(--danger)';
      } finally {
        form.setAttribute('aria-busy', 'false');
        setTimeout(() => { feedbackEl.textContent = ''; }, 5000);
      }
    });
  })();

  /* ================= 8) Year ================= */
  (() => {
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  })();
})();

/* ================= About gallery lightbox ================= */
(() => {
  const thumbs = document.querySelectorAll('.about-thumb');
  const dlg = document.getElementById('about-lightbox');
  const img = dlg?.querySelector('.lightbox-img');
  const closeBtn = dlg?.querySelector('.lightbox-close');

  if (!thumbs.length || !dlg || !img) return;

  const open = (src) => {
    img.src = src;
    dlg.showModal();
  };
  const close = () => dlg.close();

  thumbs.forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-full') || btn.querySelector('img')?.src;
      if (src) open(src);
    });
  });

  closeBtn?.addEventListener('click', close);
  dlg.addEventListener('click', (e) => {
    // click outside image closes
    if (e.target === dlg) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dlg.open) close();
  });
})();
