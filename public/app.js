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
    }, { threshold: 0.15 });
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

  /* ================= 5) Hero Background ================= */
  // Static hero image only; no slideshow/parallax to keep it calm


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

      // Basic validation
      if (!data.name || !data.email || !data.message) {
        feedbackEl.textContent = 'Please fill in all required fields.';
        feedbackEl.style.color = 'var(--danger)';
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        feedbackEl.textContent = 'Please enter a valid email address.';
        feedbackEl.style.color = 'var(--danger)';
        return;
      }

      feedbackEl.textContent = 'Sending...';
      feedbackEl.style.color = 'var(--muted)';
      form.setAttribute('aria-busy', 'true');
      form.querySelector('button').disabled = true; // Disable button during send

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
        console.error('Contact form submission error:', err);
        feedbackEl.textContent = err.message;
        feedbackEl.style.color = 'var(--danger)';
      } finally {
        form.setAttribute('aria-busy', 'false');
        form.querySelector('button').disabled = false; // Re-enable
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

/* ================= About gallery lightbox (Improved) ================= */
(() => {
  const thumbs = document.querySelectorAll('.about-thumb');
  const dlg = document.getElementById('about-lightbox');
  const img = dlg?.querySelector('.lightbox-img');
  const closeBtn = dlg?.querySelector('.lightbox-close');

  if (!thumbs.length || !dlg || !img || !closeBtn) return;

  // Open the dialog with the correct image source
  const openDialog = (src) => {
    img.src = src;
    dlg.showModal();
  };

  // Close the dialog
  const closeDialog = () => dlg.close();

  // Listen for the native 'close' event for any necessary cleanup
  dlg.addEventListener('close', () => {
    // Clear the src to prevent a flash of the old image next time
    img.src = '';
  });

  // Attach click listeners to all thumbnail buttons
  thumbs.forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-full') || btn.querySelector('img')?.src;
      if (src) openDialog(src);
    });
  });

  // Attach click listener to the custom close button
  closeBtn.addEventListener('click', closeDialog);

  // Close when clicking on the backdrop (the dialog element itself)
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeDialog();
  });
})();

/* ================= 9) Enhanced Navigation Ink Effect ================= */
(() => {
  const ink = document.querySelector('.nav-ink');
  if (!ink) return;

  // Show ink on page load
  setTimeout(() => {
    ink.classList.add('active');
  }, 500);
})();

/* ================= 10) Performance Optimizations ================= */
(() => {
  // Preload critical images
  const criticalImages = [
    '/assets/final_logo.png'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });

  // Lazy load non-critical images
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  }
})();

/* ================= 11) Enhanced Animations ================= */
(() => {
  // Add entrance animations for service cards
  if ('IntersectionObserver' in window) {
    const cards = document.querySelectorAll('.svc-card');
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.animation = `fadeInUp 0.6s ease forwards`;
          }, index * 150);
          cardObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    cards.forEach(card => cardObserver.observe(card));
  }

  // Add CSS for fadeInUp animation
  if (!document.querySelector('#dynamic-animations')) {
    const style = document.createElement('style');
    style.id = 'dynamic-animations';
    style.textContent = `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .svc-card {
          opacity: 0;
        }
      `;
    document.head.appendChild(style);
  }
})();

/* ================= 7) Sticky Header Fallback ================= */
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  // Check if CSS sticky is supported and working
  const isStickySupported = () => {
    const testEl = document.createElement('div');
    testEl.style.position = 'sticky';
    testEl.style.top = '0';
    return testEl.style.position === 'sticky';
  };

  // Fallback sticky positioning
  const updateHeaderPosition = () => {
    const scrollY = window.scrollY;

    if (scrollY > 0) {
      header.classList.add('scrolled');
      // Force position if CSS sticky fails
      if (getComputedStyle(header).position !== 'sticky') {
        header.style.position = 'fixed';
        header.style.top = '0';
        header.style.width = '100%';
        header.style.zIndex = '1200';
      }
    } else {
      header.classList.remove('scrolled');
      // Reset if using fallback
      if (header.style.position === 'fixed') {
        header.style.position = '';
        header.style.top = '';
        header.style.width = '';
      }
    }

    lastScrollY = scrollY;
    ticking = false;
  };

  // Throttled scroll handler
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(updateHeaderPosition);
      ticking = true;
    }
  };

  // Only use fallback if CSS sticky might not work
  if (!isStickySupported() || /MSIE|Trident/.test(navigator.userAgent)) {
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    // Still listen for scroll to add/remove scrolled class
    window.addEventListener('scroll', () => {
      if (window.scrollY > 0) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }
})();

/* ================= Hero Slideshow ================= */
(() => {
  const slideTrack = document.querySelector('.slide-track');
  const slides = document.querySelectorAll('.slide');
  const navDots = document.querySelectorAll('.nav-dot');
  const progressRing = document.querySelector('.progress-ring-progress');

  if (!slides.length || !navDots.length) return;

  let currentSlide = 0;
  let isAutoPlaying = true;
  let autoPlayInterval;
  let progressInterval;

  // Calculate progress ring values
  const circumference = 2 * Math.PI * 56; // radius = 56
  if (progressRing) {
    progressRing.style.strokeDasharray = circumference;
    progressRing.style.strokeDashoffset = circumference;
  }

  // Update slide and progress
  const updateSlide = (index, animate = true) => {
    // Remove active from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    navDots.forEach(dot => dot.classList.remove('active'));

    // Add active to current slide and dot
    slides[index].classList.add('active');
    navDots[index].classList.add('active');

    currentSlide = index;

    // Reset progress ring animation
    if (progressRing && animate) {
      progressRing.style.transition = 'none';
      progressRing.style.strokeDashoffset = circumference;

      // Restart progress animation
      setTimeout(() => {
        progressRing.style.transition = 'stroke-dashoffset 5s linear';
        progressRing.style.strokeDashoffset = 0;
      }, 50);
    }
  };

  // Auto advance slides
  const startAutoPlay = () => {
    if (autoPlayInterval) clearInterval(autoPlayInterval);

    autoPlayInterval = setInterval(() => {
      if (!isAutoPlaying) return;

      const nextSlide = (currentSlide + 1) % slides.length;
      updateSlide(nextSlide);
    }, 5000);
  };

  // Pause auto play
  const pauseAutoPlay = () => {
    isAutoPlaying = false;
    if (progressRing) {
      progressRing.style.animationPlayState = 'paused';
    }
  };

  // Resume auto play
  const resumeAutoPlay = () => {
    isAutoPlaying = true;
    if (progressRing) {
      progressRing.style.animationPlayState = 'running';
    }
  };

  // Navigation dot click handlers
  navDots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (index !== currentSlide) {
        updateSlide(index);
        // Restart auto play from new position
        if (isAutoPlaying) {
          startAutoPlay();
        }
      }
    });
  });

  // Pause on hover
  const slideshowContainer = document.querySelector('.hero-slideshow-container');
  if (slideshowContainer) {
    slideshowContainer.addEventListener('mouseenter', pauseAutoPlay);
    slideshowContainer.addEventListener('mouseleave', resumeAutoPlay);
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!slideshowContainer) return;

    const containerRect = slideshowContainer.getBoundingClientRect();
    const isVisible = containerRect.top < window.innerHeight && containerRect.bottom > 0;

    if (!isVisible) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevSlide = currentSlide === 0 ? slides.length - 1 : currentSlide - 1;
      updateSlide(prevSlide);
      if (isAutoPlaying) startAutoPlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextSlide = (currentSlide + 1) % slides.length;
      updateSlide(nextSlide);
      if (isAutoPlaying) startAutoPlay();
    }
  });

  // Touch/swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  if (slideshowContainer) {
    slideshowContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slideshowContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  const handleSwipe = () => {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next slide
        const nextSlide = (currentSlide + 1) % slides.length;
        updateSlide(nextSlide);
      } else {
        // Swipe right - previous slide
        const prevSlide = currentSlide === 0 ? slides.length - 1 : currentSlide - 1;
        updateSlide(prevSlide);
      }

      if (isAutoPlaying) startAutoPlay();
    }
  };

  // Initialize slideshow
  updateSlide(0, false);
  startAutoPlay();

  // Pause when page becomes hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAutoPlay();
    } else {
      resumeAutoPlay();
      if (isAutoPlaying) startAutoPlay();
    }
  });
})();