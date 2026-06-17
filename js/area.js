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

  function renderLicenses(licenses) {
    const grid = $('[data-licenses]');
    const empty = $('[data-licenses-empty]');
    if (!licenses || !licenses.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = licenses.map(licenseCardHtml).join('');
    // "Acessar SaaS": ainda não há app externo conectado — leva à área/contato.
    // Mantemos o gesto explícito para quando a URL do SaaS existir (S0/go-live).
    grid.querySelectorAll('[data-access]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.assign('mailto:contato@riverflowdev.com?subject=Acesso%20ao%20sistema');
      });
    });
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
    let data;
    try {
      data = await api('/api/me/billing');
    } catch (err) {
      setState(
        err.status === 401
          ? 'Sua sessão expirou. Entre novamente.'
          : 'Não foi possível carregar sua área agora. Tente novamente em instantes.',
        true
      );
      return;
    }
    renderLicenses(data.licenses);
    renderSubscription(data.subscription);
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
