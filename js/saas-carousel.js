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

      // Arrastar/deslizar (mouse + toque) com drag contínuo e snap
      this.enableDrag();

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

    enableDrag() {
      const track = this.track;
      let startX = 0, baseOffset = 0, cardWidth = 0, dragging = false, moved = false;

      track.style.cursor = 'grab';
      track.style.touchAction = 'pan-y';
      track.style.userSelect = 'none';

      const onDown = (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        const firstCard = track.querySelector('[data-saas-item]');
        cardWidth = (firstCard?.offsetWidth || 1) + 24;
        baseOffset = -this.currentIndex * cardWidth;
        track.style.transition = 'none';
        track.style.cursor = 'grabbing';
        this.stopAutoPlay();
        try { track.setPointerCapture(e.pointerId); } catch (_) {}
      };

      const onMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 5) moved = true;
        track.style.transform = `translateX(${baseOffset + dx}px)`;
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        track.style.transition = '';
        track.style.cursor = 'grab';
        const dx = (typeof e.clientX === 'number' ? e.clientX : startX) - startX;
        let steps = Math.round(-dx / cardWidth);
        if (steps === 0 && Math.abs(dx) > 40) steps = dx < 0 ? 1 : -1;
        this.goTo(this.currentIndex + steps);
        this.startAutoPlay();
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      track.addEventListener('pointerdown', onDown);
      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
      track.addEventListener('pointercancel', onUp);

      track.addEventListener('click', (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);

      track.addEventListener('dragstart', (e) => e.preventDefault());
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
