'use strict';

/**
 * RiverFlow — Área do cliente (/area) — S7
 *
 * Exige login (session-guard). Lê GET /api/me/billing (Bearer do Supabase) e
 * mostra licenças (SaaS) + assinatura mensal, refletindo o status real.
 *
 * O botão "Acessar SaaS" respeita o status: ativo só quando a licença está
 * vigente; expirada/cancelada vira "Renovar". Nenhuma senha em texto puro —
 * o acesso é a própria sessão autenticada.
 */

(function () {
  if (!window.RiverFlowAuth || !window.RiverFlowGuard) {
    console.error('[AREA] auth.js e session-guard.js precisam carregar antes de area.js.');
    return;
  }

  const { getSession, signOut } = window.RiverFlowAuth;
  const $ = (s) => document.querySelector(s);

  const stateEl = $('[data-state]');
  const areaEl = $('[data-area]');

  function setState(msg, isError) {
    stateEl.textContent = msg || '';
    stateEl.hidden = !msg;
    stateEl.classList.toggle('checkout-state--error', !!isError);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const esc = escapeHtml;

  function brl(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Data legível (dd/mm/aaaa) a partir de um ISO; vazio se inválido.
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  async function api(path) {
    const session = await getSession();
    const res = await fetch(path, {
      headers: Object.assign(
        { Accept: 'application/json' },
        session ? { Authorization: `Bearer ${session.access_token}` } : {}
      ),
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

  function licenseCardHtml(lic) {
    const nome = escapeHtml(lic.flowNome || lic.flow);
    const validade = fmtDate(lic.expiresAt);
    let statusLabel, statusClass, action;
    if (lic.ativa) {
      statusLabel = 'Ativa';
      statusClass = 'is-active';
      action = `<button class="btn btn--primary" data-access="${escapeHtml(lic.flow)}" type="button">Acessar ${nome}</button>`;
    } else {
      statusLabel = lic.status === 'expirada' ? 'Expirada' : (lic.status === 'cancelada' ? 'Cancelada' : 'Inativa');
      statusClass = 'is-inactive';
      action = `<a class="btn" href="saas/checkout?produto=${encodeURIComponent(lic.flow)}">Renovar licença</a>`;
    }
    const validadeLine = validade
      ? `<p class="account-card__meta">${lic.ativa ? 'Válida até' : 'Expirou em'} <strong>${validade}</strong></p>`
      : '';
    return `
      <article class="account-card">
        <div class="account-card__head">
          <span class="account-card__name">${nome}</span>
          <span class="account-badge ${statusClass}">${statusLabel}</span>
        </div>
        <p class="account-card__meta">Licença anual de uso</p>
        ${validadeLine}
        ${action}
      </article>`;
  }

  function wireAccessButtons(scope) {
    // "Acessar SaaS": ainda não há app externo conectado — leva ao contato.
    // Mantemos o gesto explícito para quando a URL do SaaS existir (go-live).
    scope.querySelectorAll('[data-access]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.assign('mailto:contato@riverflowdev.com?subject=Acesso%20ao%20sistema');
      });
    });
  }

  function renderLicenses(licenses) {
    const list = licenses || [];
    const ativos = list.filter((l) => l.ativa);
    const vencidos = list.filter((l) => !l.ativa);

    const gridA = $('[data-licenses-active]');
    const emptyA = $('[data-licenses-active-empty]');
    gridA.innerHTML = ativos.map(licenseCardHtml).join('');
    emptyA.hidden = ativos.length > 0;
    wireAccessButtons(gridA);

    const section = $('[data-expired-section]');
    const gridE = $('[data-licenses-expired]');
    if (vencidos.length) {
      gridE.innerHTML = vencidos.map(licenseCardHtml).join('');
      section.hidden = false;
    } else {
      gridE.innerHTML = '';
      section.hidden = true;
    }
  }

  function courseCardHtml(c) {
    const nome = esc(c.titulo);
    const cover = c.capa_url
      ? `<img class="account-course__cover" src="${esc(c.capa_url)}" alt="" loading="lazy">`
      : `<div class="account-course__cover account-course__cover--ph" aria-hidden="true"></div>`;
    const badge = c.saas_id ? `<span class="account-course__badge">${esc(c.saas_id)}</span>` : '';
    return `
      <a class="account-course" href="${esc(c.url || '#')}">
        <div class="account-course__thumb">${cover}${badge}</div>
        <div class="account-course__body">
          <span class="account-course__title">${nome}</span>
          <span class="account-course__cta">Continuar assistindo &rarr;</span>
        </div>
      </a>`;
  }

  function renderCourses(courses) {
    const grid = $('[data-courses]');
    const empty = $('[data-courses-empty]');
    if (!courses || !courses.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = courses.map(courseCardHtml).join('');
  }

  function fmtBytes(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function libraryGroupHtml(group) {
    const titulo = esc(group.titulo);
    const items = group.materials.map((m) => {
      const meta = [esc(m.aula), fmtBytes(m.tamanho_bytes)].filter(Boolean).join(' · ');
      return `
        <li class="library-item">
          <div class="library-item__info">
            <span class="library-item__name">${esc(m.nome)}</span>
            ${meta ? `<span class="library-item__meta">${meta}</span>` : ''}
          </div>
          <button class="btn btn--sm" type="button" data-material="${esc(m.id)}">Baixar</button>
        </li>`;
    }).join('');
    return `
      <div class="library-group">
        <h3 class="library-group__title">${titulo}</h3>
        <ul class="library-list">${items}</ul>
      </div>`;
  }

  function renderLibrary(library) {
    const wrap = $('[data-library]');
    const empty = $('[data-library-empty]');
    if (!library || !library.length) {
      wrap.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    wrap.innerHTML = library.map(libraryGroupHtml).join('');
    wrap.querySelectorAll('[data-material]').forEach((btn) => {
      btn.addEventListener('click', () => downloadMaterial(btn));
    });
  }

  // Baixa via signed URL (1h), reusando a rota do player (checa matrícula).
  async function downloadMaterial(btn) {
    const id = btn.dataset.material;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Gerando...';
    try {
      const { url } = await api(`/api/courses/materials/${encodeURIComponent(id)}/url`);
      window.open(url, '_blank', 'noopener');
    } catch (_) {
      btn.textContent = 'Falhou';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
      return;
    }
    btn.textContent = original;
    btn.disabled = false;
  }

  function renderSubscription(sub) {
    const wrap = $('[data-subscription]');
    const empty = $('[data-subscription-empty]');
    if (!sub || !sub.ativa) {
      wrap.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const trialLine = sub.emTrial && sub.trialEndsAt
      ? `<p class="account-card__trial">Período de teste até <strong>${fmtDate(sub.trialEndsAt)}</strong></p>`
      : '';
    wrap.innerHTML = `
      <article class="account-card account-card--wide">
        <div class="account-card__head">
          <span class="account-card__name">Plano ${escapeHtml(sub.planNome)}</span>
          <span class="account-badge is-active">${sub.emTrial ? 'Em teste' : 'Ativa'}</span>
        </div>
        <p class="account-card__price">${brl(sub.currentAmount)} <small>/ mês</small></p>
        ${trialLine}
      </article>`;
  }

  function greet(session) {
    const el = $('[data-greeting]');
    const meta = (session && session.user && session.user.user_metadata) || {};
    const nome = (meta.nome || '').split(' ')[0];
    if (nome) el.textContent = `Olá, ${nome}`;
  }

  async function init(session) {
    greet(session);
    setState('Carregando...');
    let billing, coursesData, libraryData;
    try {
      // Cobrança, cursos e biblioteca em paralelo; se cursos/biblioteca falharem,
      // a área ainda abre (só billing é crítico para a sessão).
      [billing, coursesData, libraryData] = await Promise.all([
        api('/api/me/billing'),
        api('/api/me/courses').catch(() => ({ courses: [] })),
        api('/api/me/library').catch(() => ({ library: [] })),
      ]);
    } catch (err) {
      setState(
        err.status === 401
          ? 'Sua sessão expirou. Entre novamente.'
          : 'Não foi possível carregar sua área agora. Tente novamente em instantes.',
        true
      );
      return;
    }
    renderCourses(coursesData.courses);
    renderLibrary(libraryData.library);
    renderLicenses(billing.licenses);
    renderSubscription(billing.subscription);
    setState('');
    areaEl.hidden = false;
  }

  const logoutBtn = $('[data-logout]');
  if (logoutBtn) {
    logoutBtn.hidden = false;
    logoutBtn.addEventListener('click', async () => {
      try { await signOut(); } catch (_) {}
      window.location.assign('/index.html');
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const session = await window.RiverFlowGuard.requireSession();
    if (!session) return; // já redirecionou para /login?next=...
    init(session);
  });
})();
