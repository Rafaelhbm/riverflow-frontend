'use strict';

/**
 * RiverFlow — Catálogo de cursos (/cursos)
 *
 * Busca GET /api/courses (público) e renderiza um card por curso publicado.
 * O CTA "Acessar curso grátis" depende do login:
 *   • Deslogado → /cadastro?next=/curso/<slug>
 *   • Logado    → POST /api/enroll (Bearer do Supabase) → /curso/<slug>
 *
 * Sem valor monetário aqui: curso é grátis, requisito é só estar cadastrado.
 */

(function () {
  const grid = document.querySelector('[data-courses-grid]');
  const stateEl = document.querySelector('[data-courses-state]');
  if (!grid) return;

  function setState(msg) {
    if (stateEl) stateEl.textContent = msg || '';
    stateEl && (stateEl.hidden = !msg);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bulletsHtml(items) {
    if (!Array.isArray(items) || !items.length) return '';
    const lis = items.slice(0, 4).map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    return `<ul class="course-card__learn">${lis}</ul>`;
  }

  function cardHtml(course) {
    const cover = course.capa_url
      ? `<img class="course-card__cover" src="${escapeHtml(course.capa_url)}" alt="" loading="lazy">`
      : `<div class="course-card__cover course-card__cover--placeholder" aria-hidden="true"></div>`;
    const badge = course.saas_id
      ? `<span class="course-card__badge">${escapeHtml(course.saas_id)}</span>`
      : '';
    const desc = course.descricao
      ? `<p class="course-card__desc">${escapeHtml(course.descricao)}</p>`
      : '';
    return `
      <article class="course-card" data-slug="${escapeHtml(course.slug)}">
        ${cover}
        <div class="course-card__body">
          ${badge}
          <h3 class="course-card__title">${escapeHtml(course.titulo)}</h3>
          ${desc}
          ${bulletsHtml(course.o_que_aprende)}
          <a class="course-card__cta" href="#" data-enroll>Acessar curso grátis &rarr;</a>
        </div>
      </article>`;
  }

  // Sessão atual via RiverFlowAuth (auth.js). Null se deslogado ou indisponível.
  async function currentSession() {
    try {
      if (window.RiverFlowAuth && typeof window.RiverFlowAuth.getSession === 'function') {
        return await window.RiverFlowAuth.getSession();
      }
    } catch (_) { /* segue como deslogado */ }
    return null;
  }

  function wireCtas(session) {
    grid.querySelectorAll('[data-enroll]').forEach((cta) => {
      const card = cta.closest('.course-card');
      const slug = card && card.dataset.slug;
      if (!slug) return;
      const courseUrl = `/curso/${encodeURIComponent(slug)}`;

      if (!session) {
        // Deslogado: cadastra e volta para o curso.
        cta.setAttribute('href', `/cadastro?next=${encodeURIComponent(courseUrl)}`);
        return;
      }

      // Logado: matricula (idempotente) e abre o curso.
      cta.setAttribute('href', courseUrl);
      cta.addEventListener('click', async (e) => {
        e.preventDefault();
        if (cta.classList.contains('is-loading')) return;
        const original = cta.innerHTML;
        cta.classList.add('is-loading');
        cta.textContent = 'Matriculando...';
        setState('');
        try {
          const res = await fetch('/api/enroll', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ slug }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a matrícula.');
          window.location.assign(data.courseUrl || courseUrl);
        } catch (err) {
          cta.classList.remove('is-loading');
          cta.innerHTML = original;
          setState(err.message);
        }
      });
    });
  }

  setState('Carregando cursos...');
  fetch('/api/courses', { headers: { Accept: 'application/json' } })
    .then((res) => {
      if (!res.ok) throw new Error('catálogo indisponível (' + res.status + ')');
      return res.json();
    })
    .then(async (data) => {
      const courses = data && Array.isArray(data.courses) ? data.courses : [];
      if (!courses.length) {
        setState('Em breve, novos cursos gratuitos por aqui.');
        return;
      }
      setState('');
      grid.innerHTML = courses.map(cardHtml).join('');
      wireCtas(await currentSession());
    })
    .catch((err) => {
      setState('Não foi possível carregar os cursos agora. Tente novamente em instantes.');
      console.info('[CURSOS] catálogo não carregado:', err.message);
    });
})();
