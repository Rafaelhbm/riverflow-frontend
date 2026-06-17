'use strict';

/**
 * RiverFlow — Cursos na home (#cursos)
 *
 * Busca GET /api/courses (público) e renderiza um card por curso publicado, com
 * a informação completa do que ele ensina sobre o SaaS direcionado (descrição +
 * "o que você aprende"). O botão "Adquirir curso" leva ao cadastro:
 *   • Deslogado → /cadastro?next=/curso/<slug>  (cria a conta; depois entra na
 *     Área de Usuários com o e-mail e senha escolhidos)
 *   • Logado    → /curso/<slug>                  (vai direto ao curso)
 *
 * Curso é grátis; o requisito é apenas ter conta.
 */

(function () {
  const grid = document.querySelector('[data-courses-grid]');
  const stateEl = document.querySelector('[data-courses-state]');
  if (!grid) return;

  function setState(msg) {
    if (!stateEl) return;
    stateEl.textContent = msg || '';
    stateEl.hidden = !msg;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function learnHtml(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lis = items.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    return `
      <div class="home-course__learn">
        <span class="home-course__learn-label">O que você aprende</span>
        <ul>${lis}</ul>
      </div>`;
  }

  function cardHtml(course) {
    const slug = escapeHtml(course.slug);
    const cover = course.capa_url
      ? `<img class="home-course__cover" src="${escapeHtml(course.capa_url)}" alt="" loading="lazy">`
      : `<div class="home-course__cover home-course__cover--ph" aria-hidden="true"><span>River<b>Flow</b></span></div>`;
    const badge = course.saas_id
      ? `<span class="home-course__badge">${escapeHtml(course.saas_id)}</span>` : '';
    const about = course.saas_id
      ? `<p class="home-course__about">Curso do sistema <strong>${escapeHtml(course.saas_id)}</strong></p>` : '';
    const desc = course.descricao
      ? `<p class="home-course__desc">${escapeHtml(course.descricao)}</p>` : '';
    return `
      <article class="home-course">
        <div class="home-course__thumb">${cover}${badge}</div>
        <div class="home-course__body">
          <h3 class="home-course__title">${escapeHtml(course.titulo)}</h3>
          ${about}
          ${desc}
          ${learnHtml(course.o_que_aprende)}
          <button class="home-course__btn" type="button" data-slug="${slug}">
            Adquirir curso
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </article>`;
  }

  async function acquire(slug) {
    const next = `/curso/${slug}`;
    let session = null;
    try {
      if (window.RiverFlowAuth) session = await window.RiverFlowAuth.getSession();
    } catch (_) { /* trata como deslogado */ }
    if (session) window.location.assign(next);
    else window.location.assign('/cadastro?next=' + encodeURIComponent(next));
  }

  async function init() {
    setState('Carregando cursos...');
    let courses = [];
    try {
      const res = await fetch('/api/courses', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      courses = data.courses || data || [];
    } catch (_) {
      setState('Não foi possível carregar os cursos agora.');
      return;
    }
    if (!Array.isArray(courses) || !courses.length) {
      setState('Novos cursos chegando em breve.');
      return;
    }
    setState('');
    grid.innerHTML = courses.map(cardHtml).join('');
    grid.querySelectorAll('[data-slug]').forEach((btn) => {
      btn.addEventListener('click', () => acquire(btn.dataset.slug));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
