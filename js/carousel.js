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

      // Arrastar/deslizar (mouse + toque) com drag contínuo e snap
      this.enableDrag();

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

    enableDrag() {
      const track = this.track;
      let startX = 0, baseOffset = 0, cardWidth = 0, dragging = false, moved = false;

      track.style.cursor = 'grab';
      track.style.touchAction = 'pan-y';
      track.style.userSelect = 'none'; // permite rolar a página na vertical

      const onDown = (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        const firstCard = track.querySelector('[data-carousel-item]');
        cardWidth = (firstCard?.offsetWidth || 1) + 24; // 24px de gap
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
        track.style.transform = `translateX(${baseOffset + dx}px)`; // segue o cursor/dedo
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        track.style.transition = '';
        track.style.cursor = 'grab';
        const dx = (typeof e.clientX === 'number' ? e.clientX : startX) - startX;
        let steps = Math.round(-dx / cardWidth);
        if (steps === 0 && Math.abs(dx) > 40) steps = dx < 0 ? 1 : -1; // arraste curto e rápido
        this.goTo(this.currentIndex + steps); // encaixa no slide (com clamp)
        this.startAutoPlay();
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      track.addEventListener('pointerdown', onDown);
      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
      track.addEventListener('pointercancel', onUp);

      // Um arraste não deve disparar o clique em links/cards
      track.addEventListener('click', (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);

      // Evita o "ghost drag" nativo de imagens/links
      track.addEventListener('dragstart', (e) => e.preventDefault());
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
