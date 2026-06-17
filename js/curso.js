'use strict';

/**
 * RiverFlow — Player do aluno (/curso/<slug>)
 *
 * Experiência de assistir: vídeo (signed URL só p/ matriculado) + playlist
 * lateral com progresso, descrição, materiais e comentários (árvore de 1 nível).
 *
 * Exige login (session-guard) e matrícula (o backend responde 403 se não).
 * Nada de conteúdo sensível mora no HTML: tudo vem do backend autenticado.
 */

(function () {
  if (!window.RiverFlowAuth || !window.RiverFlowGuard) {
    console.error('[CURSO] auth.js e session-guard.js precisam carregar antes de curso.js.');
    return;
  }

  const { getSession, signOut } = window.RiverFlowAuth;

  // ─── DOM ────────────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const stateEl     = $('[data-state]');
  const playerEl    = $('[data-player]');
  const videoEl     = $('[data-video]');
  const videoMsg    = $('[data-video-msg]');
  const lessonTitle = $('[data-lesson-title]');
  const lessonMod   = $('[data-lesson-module]');
  const lessonDesc  = $('[data-lesson-desc]');
  const completeBtn = $('[data-complete]');
  const completeLbl = $('[data-complete-label]');
  const materialsEl = $('[data-materials]');
  const materialsEmpty = $('[data-materials-empty]');
  const matCount    = $('[data-mat-count]');
  const commentsEl  = $('[data-comments]');
  const commentsState = $('[data-comments-state]');
  const commentForm = $('[data-comment-form]');
  const commentInput = $('[data-comment-input]');
  const commentFeedback = $('[data-comment-feedback]');
  const playlistEl  = $('[data-playlist]');
  const courseTitle = $('[data-course-title]');
  const progDone    = $('[data-progress-done]');
  const progTotal   = $('[data-progress-total]');
  const progFill    = $('[data-progress-fill]');

  // ─── Estado ─────────────────────────────────────────────────────────────
  let course = null;
  let lessons = [];          // achatado, na ordem da playlist
  let current = null;        // aula atual

  // ─── Helpers ────────────────────────────────────────────────────────────
  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return decodeURIComponent(last.replace(/\.html$/, ''));
  }

  function fmtDuration(seg) {
    if (!Number.isFinite(seg) || seg <= 0) return '';
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = Math.floor(seg % 60);
    const mm = String(m).padStart(h ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function fmtBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function setState(msg, isError) {
    if (!stateEl) return;
    stateEl.textContent = msg || '';
    stateEl.hidden = !msg;
    stateEl.classList.toggle('player-state--error', !!isError);
  }

  // fetch autenticado para a API. Lança Error(msg PT) em status != ok.
  async function api(path, opts) {
    opts = opts || {};
    const session = await getSession();
    const headers = Object.assign(
      { Accept: 'application/json' },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      session ? { Authorization: `Bearer ${session.access_token}` } : {}
    );
    const res = await fetch(`/api/courses${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* sem corpo */ }
    if (!res.ok) {
      const err = new Error(data.error || `Falha (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ─── Carregamento do curso ──────────────────────────────────────────────
  async function load() {
    const slug = slugFromPath();
    if (!slug) { setState('Curso não encontrado.', true); return; }

    setState('Carregando curso...');
    try {
      const data = await api(`/${encodeURIComponent(slug)}`);
      course = data.course;
    } catch (err) {
      if (err.status === 403) {
        setState('Você ainda não está matriculado neste curso. Volte ao catálogo para se matricular gratuitamente.', true);
      } else if (err.status === 404) {
        setState('Curso não encontrado.', true);
      } else {
        setState('Não foi possível carregar o curso agora. Tente novamente em instantes.', true);
      }
      console.info('[CURSO] não carregado:', err.message);
      return;
    }

    // achata as aulas na ordem dos módulos
    lessons = [];
    (course.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => { lessons.push(Object.assign({ moduleTitle: m.titulo }, l)); });
    });

    if (!lessons.length) {
      setState('Este curso ainda não tem aulas publicadas. Volte em breve.', false);
      return;
    }

    courseTitle.textContent = course.titulo || 'Curso';
    document.title = `${course.titulo} · RiverFlow`;
    renderPlaylist();
    updateProgress();

    setState('');
    playerEl.hidden = false;

    // começa pela 1ª aula não concluída (ou a 1ª).
    const first = lessons.find((l) => !l.concluida) || lessons[0];
    selectLesson(first.id);
  }

  // ─── Playlist ───────────────────────────────────────────────────────────
  function renderPlaylist() {
    const html = (course.modules || []).map((m) => {
      if (!m.lessons || !m.lessons.length) return '';
      const items = m.lessons.map((l) => {
        const dur = fmtDuration(l.duracao_seg);
        return `
          <button class="playlist-lesson" data-lesson="${escapeHtml(l.id)}" type="button">
            <span class="playlist-lesson__check" aria-hidden="true"></span>
            <span class="playlist-lesson__title">${escapeHtml(l.titulo)}</span>
            ${dur ? `<span class="playlist-lesson__dur">${dur}</span>` : ''}
          </button>`;
      }).join('');
      return `<div class="playlist-module">
        <p class="playlist-module__title">${escapeHtml(m.titulo)}</p>
        ${items}
      </div>`;
    }).join('');
    playlistEl.innerHTML = html;

    playlistEl.querySelectorAll('[data-lesson]').forEach((btn) => {
      btn.addEventListener('click', () => selectLesson(btn.dataset.lesson));
    });
    refreshPlaylistMarks();
  }

  // Atualiza marcadores de ativo/concluída sem re-renderizar tudo.
  function refreshPlaylistMarks() {
    playlistEl.querySelectorAll('[data-lesson]').forEach((btn) => {
      const l = lessons.find((x) => x.id === btn.dataset.lesson);
      const isActive = current && btn.dataset.lesson === current.id;
      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('is-done', !!(l && l.concluida));
      const check = btn.querySelector('.playlist-lesson__check');
      if (check) check.textContent = l && l.concluida ? '✓' : '';
    });
  }

  function updateProgress() {
    const done = lessons.filter((l) => l.concluida).length;
    const total = lessons.length;
    progDone.textContent = done;
    progTotal.textContent = total;
    progFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  }

  // ─── Aula atual ─────────────────────────────────────────────────────────
  async function selectLesson(lessonId) {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    current = lesson;

    lessonTitle.textContent = lesson.titulo;
    lessonMod.textContent = lesson.moduleTitle || '';
    lessonDesc.textContent = lesson.descricao || 'Sem descrição para esta aula.';
    renderMaterials(lesson.materials || []);
    renderComplete();
    refreshPlaylistMarks();
    setActiveTab('desc');
    loadComments(lesson.id);
    loadVideo(lesson.id);

    // rola para o topo no mobile ao trocar de aula
    if (window.matchMedia('(max-width: 980px)').matches) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function loadVideo(lessonId) {
    videoMsg.hidden = true;
    videoEl.hidden = false;
    videoEl.removeAttribute('src');
    videoEl.load();
    try {
      const data = await api(`/lessons/${encodeURIComponent(lessonId)}/video`);
      if (current && current.id !== lessonId) return; // trocou de aula no meio
      videoEl.src = data.url;
      videoEl.load();
    } catch (err) {
      videoEl.hidden = true;
      videoMsg.hidden = false;
      videoMsg.textContent = err.status === 404
        ? 'O vídeo desta aula ainda não está disponível.'
        : 'Não foi possível carregar o vídeo. Recarregue a página e tente de novo.';
    }
  }

  // ─── Progresso (concluir) ───────────────────────────────────────────────
  function renderComplete() {
    completeBtn.hidden = false;
    const done = !!current.concluida;
    completeBtn.classList.toggle('is-done', done);
    completeLbl.textContent = done ? 'Concluída' : 'Marcar como concluída';
  }

  completeBtn.addEventListener('click', async () => {
    if (!current) return;
    const next = !current.concluida;
    completeBtn.disabled = true;
    try {
      await api(`/lessons/${encodeURIComponent(current.id)}/progress`, {
        method: 'POST',
        body: { concluida: next },
      });
      current.concluida = next;
      renderComplete();
      refreshPlaylistMarks();
      updateProgress();
    } catch (err) {
      console.info('[CURSO] progresso não salvo:', err.message);
    } finally {
      completeBtn.disabled = false;
    }
  });

  // ─── Materiais ──────────────────────────────────────────────────────────
  function renderMaterials(materials) {
    matCount.hidden = !materials.length;
    matCount.textContent = materials.length;
    materialsEmpty.hidden = materials.length > 0;
    materialsEl.innerHTML = materials.map((mat) => {
      const size = fmtBytes(mat.tamanho_bytes);
      return `<li class="material-item">
        <div>
          <span class="material-item__name">${escapeHtml(mat.nome)}</span>
          ${size ? `<span class="material-item__size"> · ${size}</span>` : ''}
        </div>
        <button class="material-item__dl" data-material="${escapeHtml(mat.id)}" type="button">Baixar</button>
      </li>`;
    }).join('');

    materialsEl.querySelectorAll('[data-material]').forEach((btn) => {
      btn.addEventListener('click', () => downloadMaterial(btn));
    });
  }

  async function downloadMaterial(btn) {
    const id = btn.dataset.material;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Gerando link...';
    try {
      const data = await api(`/materials/${encodeURIComponent(id)}/url`);
      window.open(data.url, '_blank', 'noopener');
    } catch (err) {
      btn.textContent = 'Falhou';
      console.info('[CURSO] material indisponível:', err.message);
      setTimeout(() => { btn.textContent = original; }, 1800);
      btn.disabled = false;
      return;
    }
    btn.textContent = original;
    btn.disabled = false;
  }

  // ─── Comentários ────────────────────────────────────────────────────────
  function commentHtml(c, isReply) {
    const badge = c.is_admin ? '<span class="comment__badge">Equipe</span>' : '';
    const del = c.is_owner
      ? `<button class="comment__action comment__action--danger" data-del="${escapeHtml(c.id)}" type="button">Excluir</button>`
      : '';
    const reply = !isReply
      ? `<button class="comment__action" data-reply="${escapeHtml(c.id)}" type="button">Responder</button>`
      : '';
    const replies = !isReply && c.replies && c.replies.length
      ? `<ul class="comment__replies">${c.replies.map((r) => `<li>${commentHtml(r, true)}</li>`).join('')}</ul>`
      : '';
    return `<div class="comment${isReply ? ' comment--reply' : ''}" data-comment="${escapeHtml(c.id)}">
      <div class="comment__head">
        <span class="comment__author">${escapeHtml(c.autor)}</span>
        ${badge}
        <span class="comment__time">${fmtDate(c.created_at)}</span>
      </div>
      <p class="comment__text">${escapeHtml(c.texto)}</p>
      <div class="comment__actions">${reply}${del}</div>
      ${replies}
    </div>`;
  }

  async function loadComments(lessonId) {
    commentsState.textContent = 'Carregando comentários...';
    commentsEl.innerHTML = '';
    try {
      const data = await api(`/lessons/${encodeURIComponent(lessonId)}/comments`);
      if (current && current.id !== lessonId) return;
      const list = data.comments || [];
      commentsState.textContent = list.length ? '' : 'Seja o primeiro a comentar nesta aula.';
      commentsEl.innerHTML = list.map((c) => `<li>${commentHtml(c, false)}</li>`).join('');
      wireCommentActions();
    } catch (err) {
      commentsState.textContent = 'Não foi possível carregar os comentários.';
      console.info('[CURSO] comentários:', err.message);
    }
  }

  function wireCommentActions() {
    commentsEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => deleteComment(btn.dataset.del));
    });
    commentsEl.querySelectorAll('[data-reply]').forEach((btn) => {
      btn.addEventListener('click', () => openReply(btn));
    });
  }

  function openReply(btn) {
    const wrap = btn.closest('[data-comment]');
    if (!wrap || wrap.querySelector('.comment-reply')) return;
    const parentId = btn.dataset.reply;
    const box = document.createElement('div');
    box.className = 'comment-reply';
    box.innerHTML = `
      <textarea rows="2" maxlength="4000" placeholder="Escreva uma resposta..."></textarea>
      <div class="comment-reply__actions">
        <button class="btn btn--primary btn--sm" data-send type="button">Responder</button>
        <button class="btn btn--sm" data-cancel type="button">Cancelar</button>
      </div>`;
    wrap.querySelector('.comment__actions').after(box);
    const ta = box.querySelector('textarea');
    ta.focus();
    box.querySelector('[data-cancel]').addEventListener('click', () => box.remove());
    box.querySelector('[data-send]').addEventListener('click', async () => {
      const texto = ta.value.trim();
      if (!texto) return;
      const send = box.querySelector('[data-send]');
      send.disabled = true;
      try {
        await api(`/lessons/${encodeURIComponent(current.id)}/comments`, {
          method: 'POST',
          body: { texto, parent_id: parentId },
        });
        loadComments(current.id);
      } catch (err) {
        send.disabled = false;
        console.info('[CURSO] resposta não enviada:', err.message);
      }
    });
  }

  async function deleteComment(id) {
    try {
      await api(`/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadComments(current.id);
    } catch (err) {
      console.info('[CURSO] exclusão falhou:', err.message);
    }
  }

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = commentInput.value.trim();
    commentFeedback.textContent = '';
    commentFeedback.classList.remove('is-error');
    if (!texto) {
      commentFeedback.textContent = 'Escreva algo antes de enviar.';
      commentFeedback.classList.add('is-error');
      return;
    }
    const submit = commentForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api(`/lessons/${encodeURIComponent(current.id)}/comments`, {
        method: 'POST',
        body: { texto },
      });
      commentInput.value = '';
      loadComments(current.id);
    } catch (err) {
      commentFeedback.textContent = err.message;
      commentFeedback.classList.add('is-error');
    } finally {
      submit.disabled = false;
    }
  });

  // ─── Abas ───────────────────────────────────────────────────────────────
  function setActiveTab(name) {
    document.querySelectorAll('.player-tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.tab === name);
    });
    document.querySelectorAll('.player-panel').forEach((p) => {
      p.classList.toggle('is-active', p.dataset.panel === name);
    });
  }
  document.querySelectorAll('.player-tab').forEach((t) => {
    t.addEventListener('click', () => setActiveTab(t.dataset.tab));
  });

  // ─── Logout ─────────────────────────────────────────────────────────────
  const logoutBtn = $('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await signOut(); } catch (_) { /* segue */ }
      window.location.assign('/cursos');
    });
  }

  // ─── Boot: exige sessão, depois carrega ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const session = await window.RiverFlowGuard.requireSession();
    if (!session) return; // já redirecionado para /login?next=...
    load();
  });
})();
