'use strict';

(function() {
  const navbar = {
    element: null,
    drawer: null,
    overlay: null,
    hamburger: null,
    body: null,
    lastScrollY: 0,
    ticking: false,
    navHeight: 64,

    init() {
      this.element = document.querySelector('.navbar');
      this.drawer = document.querySelector('.nav-drawer');
      this.overlay = document.querySelector('.nav-overlay');
      this.hamburger = document.querySelector('[data-hamburger]');
      this.body = document.body;

      if (!this.element) return;

      this.setupScrollListener();
      this.setupMobileMenu();
      this.setupAnchorLinks();
    },

    setupScrollListener() {
      window.addEventListener('scroll', () => {
        if (!this.ticking) {
          window.requestAnimationFrame(() => this.handleScroll());
          this.ticking = true;
        }
      });
    },

    handleScroll() {
      const currentScrollY = window.scrollY;

      // Hide navbar when scrolling down past 80px
      if (currentScrollY > this.lastScrollY && currentScrollY > 80) {
        this.element.classList.add('navbar--hidden');
      } else {
        this.element.classList.remove('navbar--hidden');
      }

      // Add scrolled class for background opacity
      if (currentScrollY > 20) {
        this.element.classList.add('navbar--scrolled');
      } else {
        this.element.classList.remove('navbar--scrolled');
      }

      this.lastScrollY = currentScrollY;
      this.ticking = false;
    },

    setupMobileMenu() {
      if (!this.hamburger) return;

      this.hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDrawer();
      });

      if (this.overlay) {
        this.overlay.addEventListener('click', () => this.closeDrawer());
      }

      // Close drawer when clicking links
      const links = this.drawer?.querySelectorAll('a');
      if (links) {
        links.forEach(link => {
          link.addEventListener('click', () => this.closeDrawer());
        });
      }

      // Close drawer on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDrawer();
        }
      });
    },

    toggleDrawer() {
      if (this.drawer?.classList.contains('drawer--open')) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    },

    openDrawer() {
      this.drawer?.classList.add('drawer--open');
      this.overlay?.classList.add('nav-overlay--visible');
      this.hamburger?.classList.add('hamburger--active');
      this.hamburger?.setAttribute('aria-expanded', 'true');
      this.body.classList.add('no-scroll');
    },

    closeDrawer() {
      this.drawer?.classList.remove('drawer--open');
      this.overlay?.classList.remove('nav-overlay--visible');
      this.hamburger?.classList.remove('hamburger--active');
      this.hamburger?.setAttribute('aria-expanded', 'false');
      this.body.classList.remove('no-scroll');
    },

    setupAnchorLinks() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        this.scrollToElement(target);
      });
    },

    scrollToElement(element) {
      const offsetTop = element.offsetTop - this.navHeight;
      window.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: 'smooth'
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    navbar.init();
  });
})();
