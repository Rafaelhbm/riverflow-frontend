'use strict';

/**
 * RiverFlow — Painel admin: lista de cursos (/admin).
 * Lista todos os cursos (rascunho + publicado), cria novo, publica/despublica e
 * exclui. Só roda depois do evento 'admin:ready' (sessão admin confirmada).
 */

(function () {
  const listEl  = document.querySelector('[data-courses]');
  const stateEl = document.querySelector('[data-state]');
  const form    = document.querySelector('[data-new-course-form]');
  const fbEl    = form && form.querySelector('[data-feedback]');
  const newBtn  = document.querySelector('[data-new-course]');
  if (!listEl) return;

  const esc = (v) => window.Admin.escapeHtml(v);
  function setState(msg) { if (stateEl) { stateEl.textContent = msg || ''; stateEl.hidden = !msg; } }
  function feedback(msg, type) {
    if (!fbEl) return;
    fbEl.textContent = msg || '';
    fbEl.className = 'admin-feedback' + (type ? ' admin-feedback--' + type : '');
  }

  function rowHtml(c) {
    const pub = c.status === 'publicado';
    return `
      <article class="admin-row" data-id="${esc(c.id)}">
        <div class="admin-row__main">
          <span class="badge ${pub ? 'badge--ok' : 'badge--draft'}">${pub ? 'publicado' : 'rascunho'}</span>
          <a class="admin-row__title" href="curso?id=${encodeURIComponent(c.id)}">${esc(c.titulo)}</a>
          <span class="admin-row__meta">/${esc(c.slug)}${c.saas_id ? ' · ' + esc(c.saas_id) : ''}</span>
        </div>
        <div class="admin-row__actions">
          <a class="btn btn--ghost btn--sm" href="curso?id=${encodeURIComponent(c.id)}">Editar</a>
          <button class="btn btn--sm" data-toggle="${esc(c.status)}">${pub ? 'Despublicar' : 'Publicar'}</button>
          <button class="btn btn--danger btn--sm" data-delete>Excluir</button>
        </div>
      </article>`;
  }

  async function load() {
    setState('Carregando cursos...');
    try {
      const { courses } = await window.Admin.api('/courses');
      if (!courses.length) { setState('Nenhum curso ainda. Crie o primeiro acima.'); listEl.innerHTML = ''; return; }
      setState('');
      listEl.innerHTML = courses.map(rowHtml).join('');
    } catch (err) {
      setState('Não foi possível carregar os cursos: ' + err.message);
    }
  }

  // Delegação de eventos da lista (publicar/despublicar/excluir).
  listEl.addEventListener('click', async (e) => {
    const row = e.target.closest('.admin-row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.matches('[data-toggle]')) {
      const next = e.target.dataset.toggle === 'publicado' ? 'rascunho' : 'publicado';
      e.target.disabled = true;
      try {
        await window.Admin.api(`/courses/${id}/status`, { method: 'PATCH', body: { status: next } });
        await load();
      } catch (err) {
        e.target.disabled = false;
        setState(err.message);
      }
    }

    if (e.target.matches('[data-delete]')) {
      if (!window.confirm('Excluir este curso e todo o seu conteúdo? Esta ação não pode ser desfeita.')) return;
      e.target.disabled = true;
      try {
        await window.Admin.api(`/courses/${id}`, { method: 'DELETE' });
        await load();
      } catch (err) {
        e.target.disabled = false;
        setState(err.message);
      }
    }
  });

  // Form de novo curso
  if (newBtn && form) {
    newBtn.addEventListener('click', () => { form.hidden = false; feedback('', null); form.titulo.focus(); });
    form.querySelector('[data-cancel]').addEventListener('click', () => { form.hidden = true; form.reset(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      feedback('', null);
      const titulo = form.titulo.value.trim();
      const slug   = form.slug.value.trim().toLowerCase();
      const saas   = form.saas_id.value.trim();
      if (titulo.length < 2) return feedback('Informe o título do curso.', 'error');
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return feedback('Slug inválido (minúsculas, números e hífens).', 'error');

      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const { course } = await window.Admin.api('/courses', {
          method: 'POST', body: { titulo, slug, saas_id: saas || undefined },
        });
        window.location.assign(`curso?id=${encodeURIComponent(course.id)}`);
      } catch (err) {
        submit.disabled = false;
        feedback(err.message, 'error');
      }
    });
  }

  document.addEventListener('admin:ready', load);
})();
