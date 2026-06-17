'use strict';

/**
 * RiverFlow — Painel admin: editor de curso (/admin/curso?id=<courseId>).
 *
 * Carrega a árvore completa do curso (módulos → aulas → materiais) e permite:
 *  • editar dados gerais e publicar/despublicar o curso;
 *  • criar/editar/reordenar/excluir módulos e aulas (reordenação por ↑/↓);
 *  • upload de vídeo e materiais (direto ao Storage via signed upload URL);
 *  • publicar/despublicar aula; moderar comentários da aula.
 *
 * Só roda após 'admin:ready' (sessão admin confirmada).
 */

(function () {
  const stateEl   = document.querySelector('[data-state]');
  const editorEl  = document.querySelector('[data-editor]');
  const modulesEl = document.querySelector('[data-modules]');
  const detailEl  = document.querySelector('[data-detail]');
  const detailEmptyEl = document.querySelector('[data-detail-empty]');
  const courseForm = document.querySelector('[data-course-form]');
  if (!editorEl) return;

  const A = window.Admin;
  const esc = (v) => A.escapeHtml(v);
  const courseId = new URLSearchParams(window.location.search).get('id');

  let course = null;          // árvore atual
  let selectedLessonId = null;

  function setState(msg) { if (stateEl) { stateEl.textContent = msg || ''; stateEl.hidden = !msg; } }
  function fb(el, msg, type) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'admin-feedback' + (type ? ' admin-feedback--' + type : '');
  }

  function findLesson(id) {
    for (const m of course.modules) {
      const l = m.lessons.find((x) => x.id === id);
      if (l) return { lesson: l, module: m };
    }
    return null;
  }

  // ─── Carregar ────────────────────────────────────────────────────────────
  async function load() {
    if (!courseId) { setState('Curso não informado.'); return; }
    setState('Carregando curso...');
    try {
      const { course: c } = await A.api(`/courses/${encodeURIComponent(courseId)}`);
      course = c;
      setState('');
      editorEl.hidden = false;
      renderCourseForm();
      renderTree();
      if (selectedLessonId && findLesson(selectedLessonId)) renderDetail(selectedLessonId);
    } catch (err) {
      setState('Não foi possível carregar o curso: ' + err.message);
    }
  }

  // ─── Dados gerais ──────────────────────────────────────────────────────────
  function renderCourseForm() {
    document.querySelector('[data-course-title]').textContent = course.titulo || 'Curso';
    const badge = document.querySelector('[data-course-badge]');
    const pub = course.status === 'publicado';
    badge.textContent = pub ? 'publicado' : 'rascunho';
    badge.className = 'badge ' + (pub ? 'badge--ok' : 'badge--draft');
    const toggle = document.querySelector('[data-course-toggle]');
    toggle.textContent = pub ? 'Despublicar' : 'Publicar';

    const f = courseForm;
    f.titulo.value = course.titulo || '';
    f.slug.value = course.slug || '';
    f.saas_id.value = course.saas_id || '';
    f.ordem.value = course.ordem != null ? course.ordem : 0;
    f.capa_url.value = course.capa_url || '';
    f.descricao.value = course.descricao || '';
    f.o_que_aprende.value = Array.isArray(course.o_que_aprende) ? course.o_que_aprende.join('\n') : '';
  }

  courseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fbEl = courseForm.querySelector('[data-course-feedback]');
    fb(fbEl, '', null);
    const body = {
      titulo: courseForm.titulo.value.trim(),
      slug: courseForm.slug.value.trim().toLowerCase(),
      saas_id: courseForm.saas_id.value.trim() || null,
      ordem: parseInt(courseForm.ordem.value, 10) || 0,
      capa_url: courseForm.capa_url.value.trim() || null,
      descricao: courseForm.descricao.value.trim() || null,
      o_que_aprende: courseForm.o_que_aprende.value.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (body.titulo.length < 2) return fb(fbEl, 'Informe o título.', 'error');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug)) return fb(fbEl, 'Slug inválido.', 'error');
    try {
      const { course: c } = await A.api(`/courses/${courseId}`, { method: 'PATCH', body });
      course = Object.assign(course, c);
      renderCourseForm();
      fb(fbEl, 'Dados salvos.', 'success');
    } catch (err) { fb(fbEl, err.message, 'error'); }
  });

  document.querySelector('[data-course-toggle]').addEventListener('click', async (e) => {
    const next = course.status === 'publicado' ? 'rascunho' : 'publicado';
    e.target.disabled = true;
    try {
      const { course: c } = await A.api(`/courses/${courseId}/status`, { method: 'PATCH', body: { status: next } });
      course.status = c.status;
      renderCourseForm();
    } catch (err) {
      fb(courseForm.querySelector('[data-course-feedback]'), err.message, 'error');
    } finally { e.target.disabled = false; }
  });

  // ─── Árvore de módulos/aulas ───────────────────────────────────────────────
  function moduleHtml(m, idx, total) {
    const lessons = m.lessons.map((l, li) => {
      const pub = l.status === 'publicado';
      return `
        <li class="tree-lesson ${l.id === selectedLessonId ? 'is-selected' : ''}" data-lesson="${esc(l.id)}">
          <span class="badge badge--dot ${pub ? 'badge--ok' : 'badge--draft'}" title="${pub ? 'publicada' : 'rascunho'}"></span>
          <button class="tree-lesson__title" data-edit-lesson>${esc(l.titulo)}</button>
          <span class="tree-lesson__video">${l.hasVideo ? '🎬' : '—'}</span>
          <span class="tree-actions">
            <button class="icon-btn" data-move-lesson="up" ${li === 0 ? 'disabled' : ''} aria-label="Subir aula">↑</button>
            <button class="icon-btn" data-move-lesson="down" ${li === m.lessons.length - 1 ? 'disabled' : ''} aria-label="Descer aula">↓</button>
            <button class="icon-btn icon-btn--danger" data-del-lesson aria-label="Excluir aula">✕</button>
          </span>
        </li>`;
    }).join('');
    return `
      <div class="tree-module" data-module="${esc(m.id)}">
        <div class="tree-module__head">
          <input class="tree-module__title" value="${esc(m.titulo)}" data-module-title maxlength="160" aria-label="Título do módulo">
          <span class="tree-actions">
            <button class="icon-btn" data-move-module="up" ${idx === 0 ? 'disabled' : ''} aria-label="Subir módulo">↑</button>
            <button class="icon-btn" data-move-module="down" ${idx === total - 1 ? 'disabled' : ''} aria-label="Descer módulo">↓</button>
            <button class="icon-btn icon-btn--danger" data-del-module aria-label="Excluir módulo">✕</button>
          </span>
        </div>
        <ul class="tree-lessons">${lessons || '<li class="tree-empty">Sem aulas ainda.</li>'}</ul>
        <button class="btn btn--ghost btn--sm tree-add-lesson" data-add-lesson>+ Aula</button>
      </div>`;
  }

  function renderTree() {
    modulesEl.innerHTML = course.modules.length
      ? course.modules.map((m, i) => moduleHtml(m, i, course.modules.length)).join('')
      : '<p class="admin-state">Nenhum módulo ainda. Adicione o primeiro.</p>';
  }

  document.querySelector('[data-add-module]').addEventListener('click', async () => {
    const titulo = window.prompt('Título do módulo:');
    if (!titulo || !titulo.trim()) return;
    try {
      await A.api(`/courses/${courseId}/modules`, { method: 'POST', body: { titulo: titulo.trim(), ordem: course.modules.length } });
      await load();
    } catch (err) { setState(err.message); }
  });

  // Reordenação local + persistência
  function move(arr, from, to) { const [it] = arr.splice(from, 1); arr.splice(to, 0, it); }
  async function persistOrder(table, parentPath, items) {
    const payload = items.map((it, i) => ({ id: it.id, ordem: i }));
    await A.api(parentPath, { method: 'POST', body: { items: payload } });
  }

  modulesEl.addEventListener('click', async (e) => {
    const moduleEl = e.target.closest('[data-module]');
    if (!moduleEl) return;
    const mId = moduleEl.dataset.module;
    const mIdx = course.modules.findIndex((m) => m.id === mId);
    const mod = course.modules[mIdx];

    // Mover módulo
    if (e.target.matches('[data-move-module]')) {
      const dir = e.target.dataset.moveModule === 'up' ? -1 : 1;
      move(course.modules, mIdx, mIdx + dir);
      renderTree();
      try { await persistOrder('modules', `/courses/${courseId}/modules/reorder`, course.modules); }
      catch (err) { setState(err.message); await load(); }
      return;
    }
    // Excluir módulo
    if (e.target.matches('[data-del-module]')) {
      if (!window.confirm('Excluir este módulo e suas aulas?')) return;
      try { await A.api(`/modules/${mId}`, { method: 'DELETE' }); await load(); }
      catch (err) { setState(err.message); }
      return;
    }
    // Adicionar aula
    if (e.target.matches('[data-add-lesson]')) {
      const titulo = window.prompt('Título da aula:');
      if (!titulo || !titulo.trim()) return;
      try {
        const { lesson } = await A.api(`/modules/${mId}/lessons`, { method: 'POST', body: { titulo: titulo.trim(), ordem: mod.lessons.length } });
        selectedLessonId = lesson.id;
        await load();
      } catch (err) { setState(err.message); }
      return;
    }

    const lessonEl = e.target.closest('[data-lesson]');
    if (!lessonEl) return;
    const lId = lessonEl.dataset.lesson;
    const lIdx = mod.lessons.findIndex((l) => l.id === lId);

    if (e.target.matches('[data-edit-lesson]')) { selectedLessonId = lId; renderDetail(lId); renderTree(); return; }
    if (e.target.matches('[data-move-lesson]')) {
      const dir = e.target.dataset.moveLesson === 'up' ? -1 : 1;
      move(mod.lessons, lIdx, lIdx + dir);
      renderTree();
      try { await persistOrder('lessons', `/modules/${mId}/lessons/reorder`, mod.lessons); }
      catch (err) { setState(err.message); await load(); }
      return;
    }
    if (e.target.matches('[data-del-lesson]')) {
      if (!window.confirm('Excluir esta aula?')) return;
      try {
        await A.api(`/lessons/${lId}`, { method: 'DELETE' });
        if (selectedLessonId === lId) { selectedLessonId = null; renderDetailEmpty(); }
        await load();
      } catch (err) { setState(err.message); }
    }
  });

  // Salvar título do módulo ao sair do campo (blur)
  modulesEl.addEventListener('blur', async (e) => {
    if (!e.target.matches('[data-module-title]')) return;
    const mId = e.target.closest('[data-module]').dataset.module;
    const mod = course.modules.find((m) => m.id === mId);
    const val = e.target.value.trim();
    if (!val || val === mod.titulo) { e.target.value = mod.titulo; return; }
    try { await A.api(`/modules/${mId}`, { method: 'PATCH', body: { titulo: val } }); mod.titulo = val; }
    catch (err) { setState(err.message); e.target.value = mod.titulo; }
  }, true);

  // ─── Painel de detalhe da aula (vídeo, materiais, comentários) ─────────────
  function renderDetailEmpty() {
    detailEl.hidden = true; detailEl.innerHTML = '';
    detailEmptyEl.hidden = false;
  }

  function renderDetail(lessonId) {
    const found = findLesson(lessonId);
    if (!found) return renderDetailEmpty();
    const l = found.lesson;
    const pub = l.status === 'publicado';
    detailEmptyEl.hidden = true;
    detailEl.hidden = false;
    detailEl.innerHTML = `
      <div class="admin-head admin-head--inline">
        <h2>Aula</h2>
        <div class="admin-head__actions">
          <span class="badge ${pub ? 'badge--ok' : 'badge--draft'}" data-lesson-badge>${pub ? 'publicada' : 'rascunho'}</span>
          <button class="btn btn--sm" data-lesson-toggle>${pub ? 'Despublicar' : 'Publicar'}</button>
        </div>
      </div>
      <form class="admin-form" data-lesson-form>
        <label class="field"><span>Título</span><input name="titulo" type="text" maxlength="200" value="${esc(l.titulo)}" required></label>
        <label class="field"><span>Descrição</span><textarea name="descricao" rows="3" maxlength="4000">${esc(l.descricao || '')}</textarea></label>
        <label class="field"><span>Duração (segundos)</span><input name="duracao_seg" type="number" min="0" step="1" value="${l.duracao_seg != null ? l.duracao_seg : ''}"></label>
        <p class="admin-feedback" data-lesson-feedback role="status" aria-live="polite"></p>
        <div class="admin-form__actions"><button type="submit" class="btn btn--primary">Salvar aula</button></div>
      </form>

      <div class="admin-upload">
        <h3>Vídeo ${l.hasVideo ? '<span class="badge badge--ok">enviado</span>' : '<span class="badge badge--draft">pendente</span>'}</h3>
        <input type="file" accept="video/mp4,video/webm,video/quicktime" data-video-input>
        <div class="admin-progress" data-video-progress hidden><div></div></div>
        <p class="admin-feedback" data-video-feedback role="status" aria-live="polite"></p>
      </div>

      <div class="admin-upload">
        <h3>Materiais</h3>
        <ul class="admin-materials" data-materials></ul>
        <input type="file" data-material-input>
        <p class="admin-feedback" data-material-feedback role="status" aria-live="polite"></p>
      </div>

      <div class="admin-comments">
        <h3>Comentários</h3>
        <div class="admin-state" data-comments-state>Carregando...</div>
        <div data-comments></div>
      </div>`;

    wireDetail(found);
    renderMaterials(l);
    loadComments(lessonId);
  }

  function wireDetail(found) {
    const l = found.lesson;
    const form = detailEl.querySelector('[data-lesson-form]');
    const fbEl = detailEl.querySelector('[data-lesson-feedback]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      fb(fbEl, '', null);
      const body = {
        titulo: form.titulo.value.trim(),
        descricao: form.descricao.value.trim() || null,
        duracao_seg: form.duracao_seg.value ? parseInt(form.duracao_seg.value, 10) : undefined,
      };
      if (!body.titulo) return fb(fbEl, 'Informe o título da aula.', 'error');
      try {
        const { lesson } = await A.api(`/lessons/${l.id}`, { method: 'PATCH', body });
        Object.assign(l, { titulo: lesson.titulo, descricao: lesson.descricao, duracao_seg: lesson.duracao_seg });
        fb(fbEl, 'Aula salva.', 'success');
        renderTree();
      } catch (err) { fb(fbEl, err.message, 'error'); }
    });

    detailEl.querySelector('[data-lesson-toggle]').addEventListener('click', async (e) => {
      const next = l.status === 'publicado' ? 'rascunho' : 'publicado';
      e.target.disabled = true;
      try {
        const { lesson } = await A.api(`/lessons/${l.id}/status`, { method: 'PATCH', body: { status: next } });
        l.status = lesson.status;
        renderDetail(l.id); renderTree();
      } catch (err) { fb(fbEl, err.message, 'error'); e.target.disabled = false; }
    });

    // Upload de vídeo
    const vInput = detailEl.querySelector('[data-video-input]');
    const vFb = detailEl.querySelector('[data-video-feedback]');
    const vProg = detailEl.querySelector('[data-video-progress]');
    vInput.addEventListener('change', async () => {
      const file = vInput.files[0];
      if (!file) return;
      fb(vFb, '', null); vProg.hidden = false; vInput.disabled = true;
      try {
        const sign = await A.api('/uploads/video-url', {
          method: 'POST',
          body: { courseId, lessonId: l.id, filename: file.name, contentType: file.type },
        });
        await A.uploadSigned(sign.bucket, sign.path, sign.token, file);
        await A.api('/uploads/video-confirm', { method: 'POST', body: { lessonId: l.id, path: sign.path } });
        l.hasVideo = true;
        fb(vFb, 'Vídeo enviado com sucesso.', 'success');
        renderDetail(l.id); renderTree();
      } catch (err) {
        fb(vFb, err.message, 'error'); vInput.disabled = false; vProg.hidden = true;
      }
    });

    // Upload de material
    const mInput = detailEl.querySelector('[data-material-input]');
    const mFb = detailEl.querySelector('[data-material-feedback]');
    mInput.addEventListener('change', async () => {
      const file = mInput.files[0];
      if (!file) return;
      fb(mFb, '', null); mInput.disabled = true;
      try {
        const sign = await A.api('/uploads/material-url', {
          method: 'POST',
          body: { lessonId: l.id, filename: file.name, contentType: file.type },
        });
        await A.uploadSigned(sign.bucket, sign.path, sign.token, file);
        const { material } = await A.api('/uploads/material-confirm', {
          method: 'POST',
          body: { lessonId: l.id, nome: file.name, path: sign.path, tamanho_bytes: file.size },
        });
        l.materials = l.materials || [];
        l.materials.push(material);
        fb(mFb, 'Material adicionado.', 'success');
        renderMaterials(l);
      } catch (err) { fb(mFb, err.message, 'error'); }
      finally { mInput.disabled = false; mInput.value = ''; }
    });
  }

  function renderMaterials(l) {
    const ul = detailEl.querySelector('[data-materials]');
    if (!ul) return;
    const mats = l.materials || [];
    ul.innerHTML = mats.length
      ? mats.map((m) => `<li data-material="${esc(m.id)}"><span>${esc(m.nome)}</span><button class="icon-btn icon-btn--danger" data-del-material aria-label="Excluir material">✕</button></li>`).join('')
      : '<li class="tree-empty">Nenhum material.</li>';
    ul.onclick = async (e) => {
      if (!e.target.matches('[data-del-material]')) return;
      const id = e.target.closest('[data-material]').dataset.material;
      if (!window.confirm('Excluir este material?')) return;
      try {
        await A.api(`/uploads/material/${id}`, { method: 'DELETE' });
        l.materials = l.materials.filter((m) => m.id !== id);
        renderMaterials(l);
      } catch (err) { fb(detailEl.querySelector('[data-material-feedback]'), err.message, 'error'); }
    };
  }

  // ─── Moderação de comentários ──────────────────────────────────────────────
  async function loadComments(lessonId) {
    const stateC = detailEl.querySelector('[data-comments-state]');
    const wrap = detailEl.querySelector('[data-comments]');
    try {
      const { comments } = await A.api(`/comments/lesson/${lessonId}`);
      stateC.hidden = true;
      if (!comments.length) { wrap.innerHTML = '<p class="tree-empty">Nenhum comentário ainda.</p>'; return; }
      wrap.innerHTML = comments.map((c) => {
        const oculto = c.status === 'oculto';
        return `
          <div class="comment ${c.parent_id ? 'comment--reply' : ''} ${oculto ? 'comment--hidden' : ''}" data-comment="${esc(c.id)}">
            <div class="comment__head"><strong>${esc(c.autor)}</strong>${oculto ? '<span class="badge badge--draft">oculto</span>' : ''}</div>
            <p class="comment__text">${esc(c.texto)}</p>
            <div class="comment__actions">
              <button class="btn btn--sm" data-c-toggle="${esc(c.status)}">${oculto ? 'Reexibir' : 'Ocultar'}</button>
              ${c.parent_id ? '' : '<button class="btn btn--ghost btn--sm" data-c-reply>Responder</button>'}
              <button class="btn btn--danger btn--sm" data-c-del>Excluir</button>
            </div>
          </div>`;
      }).join('');
    } catch (err) { stateC.hidden = false; stateC.textContent = err.message; }
  }

  // Delegação das ações de comentário
  detailEl && detailEl.addEventListener('click', async (e) => {
    const cEl = e.target.closest('[data-comment]');
    if (!cEl) return;
    const id = cEl.dataset.comment;

    if (e.target.matches('[data-c-toggle]')) {
      const next = e.target.dataset.cToggle === 'oculto' ? 'visivel' : 'oculto';
      e.target.disabled = true;
      try { await A.api(`/comments/${id}/status`, { method: 'PATCH', body: { status: next } }); await loadComments(selectedLessonId); }
      catch (err) { e.target.disabled = false; window.alert(err.message); }
    }
    if (e.target.matches('[data-c-del]')) {
      if (!window.confirm('Excluir este comentário?')) return;
      try { await A.api(`/comments/${id}`, { method: 'DELETE' }); await loadComments(selectedLessonId); }
      catch (err) { window.alert(err.message); }
    }
    if (e.target.matches('[data-c-reply]')) {
      const texto = window.prompt('Sua resposta:');
      if (!texto || !texto.trim()) return;
      try { await A.api(`/comments/${id}/reply`, { method: 'POST', body: { texto: texto.trim() } }); await loadComments(selectedLessonId); }
      catch (err) { window.alert(err.message); }
    }
  });

  document.addEventListener('admin:ready', load);
})();
