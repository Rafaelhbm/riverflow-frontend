'use strict';

(function () {
  const saasCarousel = {
    track: null,
    dotsContainer: null,
    currentIndex: 0,
    autoPlayInterval: null,
    resizeTimeout: null,
    scrollTimeout: null,
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

      const dots = this.dotsContainer?.querySelectorAll('[data-saas-dot]');
      dots?.forEach((dot, index) => dot.addEventListener('click', () => this.goTo(index)));

      // Atualiza os dots conforme o usuário rola/desliza de lado
      this.track.addEventListener('scroll', () => {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => this.syncFromScroll(), 90);
      }, { passive: true });

      // Arrastar com o mouse (toque e trackpad já rolam de lado nativamente)
      this.enableMouseDragScroll();

      this.track.addEventListener('mouseenter', () => { this.isHovered = true; this.stopAutoPlay(); });
      this.track.addEventListener('mouseleave', () => { this.isHovered = false; this.startAutoPlay(); });

      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
      });
    },

    enableMouseDragScroll() {
      const track = this.track;
      let down = false, startX = 0, startScroll = 0, moved = false;

      track.style.cursor = 'grab';

      track.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = false;
        startX = e.clientX;
        startScroll = track.scrollLeft;
        track.style.cursor = 'grabbing';
        track.style.userSelect = 'none';
        this.stopAutoPlay();
        try { track.setPointerCapture(e.pointerId); } catch (_) {}
      });

      track.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 5) moved = true;
        track.scrollLeft = startScroll - dx;
      });

      const up = (e) => {
        if (!down) return;
        down = false;
        track.style.cursor = 'grab';
        track.style.userSelect = '';
        this.startAutoPlay();
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      track.addEventListener('pointerup', up);
      track.addEventListener('pointercancel', up);

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

    cardStep() {
      const firstCard = this.track?.querySelector('[data-saas-item]');
      return (firstCard?.offsetWidth || 1) + 24;
    },

    goTo(index) {
      this.currentIndex = Math.max(0, Math.min(index, this.getMaxIndex()));
      this.track.scrollTo({ left: this.currentIndex * this.cardStep(), behavior: 'smooth' });
      this.updateDots();
    },

    syncFromScroll() {
      const idx = Math.round(this.track.scrollLeft / this.cardStep());
      this.currentIndex = Math.max(0, Math.min(idx, this.getMaxIndex()));
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
      this.stopAutoPlay();
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

  document.addEventListener('DOMContentLoaded', () => saasCarousel.init());
})();
