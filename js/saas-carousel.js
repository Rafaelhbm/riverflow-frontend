'use strict';

(function () {
  const saasCarousel = {
    track: null,
    dotsContainer: null,
    currentIndex: 0,
    autoPlayInterval: null,
    touchStartX: 0,
    resizeTimeout: null,
    isHovered: false,

    init() {
      this.track = document.querySelector('[data-saas-track]');
      this.dotsContainer = document.querySelector('[data-saas-dots]');

      if (!this.track) return;

      this.buildDots();
      this.setupEvents();
      this.startAutoPlay();
    },

    setupEvents() {
      const nextBtn = document.querySelector('[data-saas-next]');
      const prevBtn = document.querySelector('[data-saas-prev]');

      if (nextBtn) nextBtn.addEventListener('click', () => this.next());
      if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

      // Dots click
      const dots = this.dotsContainer?.querySelectorAll('[data-saas-dot]');
      dots?.forEach((dot, index) => {
        dot.addEventListener('click', () => this.goTo(index));
      });

      // Touch swipe
      this.track.addEventListener('touchstart', (e) => {
        this.touchStartX = e.touches[0].clientX;
      });
      this.track.addEventListener('touchend', (e) => {
        const diff = this.touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) diff > 0 ? this.next() : this.prev();
      });

      // Arrastar com o mouse (desktop)
      this.enableMouseDrag();

      // Pause on hover
      this.track.addEventListener('mouseenter', () => {
        this.isHovered = true;
        this.stopAutoPlay();
      });
      this.track.addEventListener('mouseleave', () => {
        this.isHovered = false;
        this.startAutoPlay();
      });

      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
      });
    },

    enableMouseDrag() {
      let startX = 0, dragging = false, moved = false;
      this.track.style.cursor = 'grab';

      this.track.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        dragging = true; moved = false; startX = e.clientX;
        this.track.style.cursor = 'grabbing';
        this.stopAutoPlay();
      });

      window.addEventListener('pointermove', (e) => {
        if (dragging && Math.abs(e.clientX - startX) > 8) moved = true;
      });

      window.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        this.track.style.cursor = 'grab';
        const diff = startX - e.clientX;
        if (Math.abs(diff) > 40) { diff > 0 ? this.next() : this.prev(); }
        this.startAutoPlay();
      });

      this.track.addEventListener('click', (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);

      this.track.addEventListener('dragstart', (e) => e.preventDefault());
    },

    buildDots() {
      if (!this.dotsContainer) return;
      this.dotsContainer.innerHTML = '';
      const maxIndex = this.getMaxIndex();

      for (let i = 0; i <= maxIndex; i++) {
        const dot = document.createElement('button');
        dot.setAttribute('data-saas-dot', i);
        dot.className = i === 0 ? 'dot dot--active' : 'dot';
        dot.setAttribute('aria-label', `Ir para produto ${i + 1}`);
        this.dotsContainer.appendChild(dot);
      }
    },

    getVisibleCount() {
      const w = window.innerWidth;
      if (w >= 1100) return 3;
      if (w >= 768) return 2;
      return 1;
    },

    getMaxIndex() {
      const cards = this.track?.querySelectorAll('[data-saas-item]');
      return Math.max(0, (cards?.length || 0) - this.getVisibleCount());
    },

    goTo(index) {
      const maxIndex = this.getMaxIndex();
      this.currentIndex = Math.max(0, Math.min(index, maxIndex));

      const firstCard = this.track?.querySelector('[data-saas-item]');
      const cardWidth = (firstCard?.offsetWidth || 0) + 24;
      this.track.style.transform = `translateX(-${this.currentIndex * cardWidth}px)`;
      this.updateDots();
    },

    next() {
      const max = this.getMaxIndex();
      this.goTo(this.currentIndex >= max ? 0 : this.currentIndex + 1);
    },

    prev() {
      const max = this.getMaxIndex();
      this.goTo(this.currentIndex <= 0 ? max : this.currentIndex - 1);
    },

    updateDots() {
      this.dotsContainer?.querySelectorAll('[data-saas-dot]').forEach((dot, i) => {
        dot.classList.toggle('dot--active', i === this.currentIndex);
      });
    },

    startAutoPlay() {
      if (this.isHovered) return;
      this.autoPlayInterval = setInterval(() => this.next(), 6000);
    },

    stopAutoPlay() {
      clearInterval(this.autoPlayInterval);
    },

    handleResize() {
      if (this.currentIndex > this.getMaxIndex()) this.currentIndex = this.getMaxIndex();
      this.buildDots();
      this.goTo(this.currentIndex);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    saasCarousel.init();
  });
})();
