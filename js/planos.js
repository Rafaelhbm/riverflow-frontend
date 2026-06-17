'use strict';

/**
 * RiverFlow — Escolha do plano mensal (/saas/planos)
 *
 * Tela mostrada logo após o pagamento da licença. Exige login. Lê as faixas de
 * /api/pricing e, ao escolher um plano, dispara POST /api/checkout/plan →
 * redireciona para a assinatura no Stripe (3 meses no piso da faixa = trial).
 *
 * O cliente só informa o plano; o backend define o valor (piso da faixa).
 */

(function () {
  if (!window.RiverFlowAuth || !window.RiverFlowGuard) {
    console.error('[PLANOS] auth.js e session-guard.js precisam carregar antes de planos.js.');
    return;
  }

  const { getSession, signOut } = window.RiverFlowAuth;
  const $ = (s) => document.querySelector(s);

  const stateEl  = $('[data-state]');
  const wrapEl   = $('[data-plans-wrap]');
  const plansEl  = $('[data-plans]');
  const feedback = $('[data-feedback]');

  function setState(msg, isError) {
    stateEl.textContent = msg || '';
    stateEl.hidden = !msg;
    stateEl.classList.toggle('checkout-state--error', !!isError);
  }

  function brl(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function api(path, opts) {
    opts = opts || {};
    const session = await getSession();
    const headers = Object.assign(
      { Accept: 'application/json' },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      session ? { Authorization: `Bearer ${session.access_token}` } : {}
    );
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data.error || `Falha (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function cardHtml(plan, trialMeses) {
    return `<article class="plan-card">
      <h3 class="plan-card__name">${escapeHtml(plan.nome)}</h3>
      <p class="plan-card__resumo">${escapeHtml(plan.resumo || '')}</p>
      <div class="plan-card__price">${brl(plan.min)} <small>/ mês</small></div>
      <p class="plan-card__range">Faixa: ${brl(plan.min)} – ${brl(plan.max)} conforme o uso</p>
      <p class="plan-card__trial">${trialMeses} meses no valor de teste</p>
      <button class="btn btn--primary" data-plan="${escapeHtml(plan.id)}" type="button">Assinar ${escapeHtml(plan.nome)}</button>
    </article>`;
  }

  async function choose(planId, btn) {
    feedback.textContent = '';
    document.querySelectorAll('[data-plan]').forEach((b) => { b.disabled = true; });
    const original = btn.textContent;
    btn.textContent = 'Redirecionando...';
    try {
      const { url } = await api('/api/checkout/plan', { method: 'POST', body: { plan: planId } });
      window.location.assign(url);
    } catch (err) {
      feedback.textContent = err.status === 503
        ? 'A assinatura está temporariamente indisponível. Tente novamente em instantes.'
        : err.message;
      document.querySelectorAll('[data-plan]').forEach((b) => { b.disabled = false; });
      btn.textContent = original;
    }
  }

  async function init() {
    setState('Carregando planos...');
    let pricing;
    try {
      pricing = await api('/api/pricing');
    } catch (_) {
      setState('Não foi possível carregar os planos agora. Tente novamente em instantes.', true);
      return;
    }
    const planos = pricing.planos || [];
    if (!planos.length) { setState('Nenhum plano disponível no momento.', true); return; }

    plansEl.innerHTML = planos.map((p) => cardHtml(p, pricing.trialMeses)).join('');
    plansEl.querySelectorAll('[data-plan]').forEach((btn) => {
      btn.addEventListener('click', () => choose(btn.dataset.plan, btn));
    });

    setState('');
    wrapEl.hidden = false;

    if (new URLSearchParams(window.location.search).get('cancelado')) {
      feedback.textContent = 'Você cancelou a escolha do plano. Pode assinar quando quiser.';
    }
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
    if (!session) return;
    init();
  });
})();
