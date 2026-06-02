'use strict';

(function() {
  const animations = {
    observer: null,
    prefersReducedMotion: false,

    init() {
      // Check if user prefers reduced motion
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (this.prefersReducedMotion) {
        this.applyReducedMotion();
        return;
      }

      this.setupObserver();
    },

    setupObserver() {
      const options = {
        threshold: 0.12,
        rootMargin: '0px 0px -50px 0px'
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            this.observer?.unobserve(entry.target);
          }
        });
      }, options);

      const revealElements = document.querySelectorAll('.reveal');
      revealElements.forEach(element => {
        this.observer?.observe(element);
      });
    },

    applyReducedMotion() {
      const revealElements = document.querySelectorAll('.reveal');
      revealElements.forEach(element => {
        element.classList.add('reveal--visible');
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    animations.init();
  });
})();
