'use strict';

(function() {
  const carousel = {
    track: null,
    dotsContainer: null,
    currentIndex: 0,
    autoPlayInterval: null,
    touchStartX: 0,
    resizeTimeout: null,
    isHovered: false,

    init() {
      this.track = document.querySelector('[data-carousel-track]');
      this.dotsContainer = document.querySelector('[data-carousel-dots]');

      if (!this.track) return;

      this.buildDots();
      this.setupEvents();
      this.startAutoPlay();
    },

    setupEvents() {
      // Navigation buttons
      const nextBtn = document.querySelector('[data-carousel-next]');
      const prevBtn = document.querySelector('[data-carousel-prev]');

      if (nextBtn) nextBtn.addEventListener('click', () => this.next());
      if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

      // Dots click
      const dots = this.dotsContainer?.querySelectorAll('[data-dot]');
      dots?.forEach((dot, index) => {
        dot.addEventListener('click', () => this.goTo(index));
      });

      // Touch events
      this.track.addEventListener('touchstart', (e) => {
        this.touchStartX = e.touches[0].clientX;
      });

      this.track.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = this.touchStartX - touchEndX;
        if (Math.abs(diff) > 40) {
          diff > 0 ? this.next() : this.prev();
        }
      });

      // Arrastar com o mouse (desktop)
      this.enableMouseDrag();

      // Pause autoplay on hover
      this.track.addEventListener('mouseenter', () => {
        this.isHovered = true;
        this.stopAutoPlay();
      });

      this.track.addEventListener('mouseleave', () => {
        this.isHovered = false;
        this.startAutoPlay();
      });

      // Debounced resize
      window.addEventListener('resize', () => {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
      });
    },

    enableMouseDrag() {
      let startX = 0, dragging = false, moved = false;
      this.track.style.cursor = 'grab';

      this.track.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return; // toque já tratado
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

      // Impede que um arraste dispare o clique em links/cards
      this.track.addEventListener('click', (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);

      // Evita o "ghost drag" nativo de imagens/links
      this.track.addEventListener('dragstart', (e) => e.preventDefault());
    },

    buildDots() {
      if (!this.dotsContainer) return;

      this.dotsContainer.innerHTML = '';
      const maxIndex = this.getMaxIndex();

      for (let i = 0; i <= maxIndex; i++) {
        const dot = document.createElement('button');
        dot.setAttribute('data-dot', i);
        dot.className = i === 0 ? 'dot dot--active' : 'dot';
        dot.setAttribute('aria-label', `Ir para slide ${i + 1}`);
        this.dotsContainer.appendChild(dot);
      }
    },

    getVisibleCount() {
      const width = window.innerWidth;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    },

    getMaxIndex() {
      const cards = this.track?.querySelectorAll('[data-carousel-item]');
      const totalCards = cards?.length || 0;
      const visibleCount = this.getVisibleCount();
      return Math.max(0, totalCards - visibleCount);
    },

    goTo(index) {
      const maxIndex = this.getMaxIndex();
      this.currentIndex = Math.max(0, Math.min(index, maxIndex));

      const firstCard = this.track?.querySelector('[data-carousel-item]');
      const cardWidth = (firstCard?.offsetWidth || 0) + 24; // 24px gap
      const offset = this.currentIndex * cardWidth;

      this.track.style.transform = `translateX(-${offset}px)`;
      this.updateDots();
    },

    next() {
      const maxIndex = this.getMaxIndex();
      const nextIndex = this.currentIndex >= maxIndex ? 0 : this.currentIndex + 1;
      this.goTo(nextIndex);
    },

    prev() {
      const maxIndex = this.getMaxIndex();
      const prevIndex = this.currentIndex <= 0 ? maxIndex : this.currentIndex - 1;
      this.goTo(prevIndex);
    },

    updateDots() {
      const dots = this.dotsContainer?.querySelectorAll('[data-dot]');
      dots?.forEach((dot, index) => {
        if (index === this.currentIndex) {
          dot.classList.add('dot--active');
        } else {
          dot.classList.remove('dot--active');
        }
      });
    },

    startAutoPlay() {
      if (this.isHovered) return;

      this.autoPlayInterval = setInterval(() => {
        this.next();
      }, 5000);
    },

    stopAutoPlay() {
      clearInterval(this.autoPlayInterval);
    },

    handleResize() {
      const maxIndex = this.getMaxIndex();
      if (this.currentIndex > maxIndex) {
        this.currentIndex = maxIndex;
      }
      this.buildDots();
      this.goTo(this.currentIndex);
    },

    destroy() {
      this.stopAutoPlay();
      clearTimeout(this.resizeTimeout);
      window.removeEventListener('resize', () => this.handleResize());
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    carousel.init();
  });
})();
