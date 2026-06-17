'use strict';

/**
 * RiverFlow — Checkout da licença anual (/saas/checkout?produto=<flow>)
 *
 * Exige login (session-guard). Lê os valores de /api/pricing (calculados no
 * backend), deixa o cliente escolher à vista ou parcelado e dispara
 * POST /api/checkout/license → redireciona para a sessão do Stripe.
 *
 * O cliente NUNCA envia valor: só o flow e o modo. O backend recalcula tudo.
 */

(function () {
  if (!window.RiverFlowAuth || !window.RiverFlowGuard) {
    console.error('[CHECKOUT] auth.js e session-guard.js precisam carregar antes de checkout.js.');
    return;
  }

  const { getSession, signOut } = window.RiverFlowAuth;
  const $ = (s) => document.querySelector(s);

  const stateEl   = $('[data-state]');
  const wrapEl    = $('[data-checkout]');
  const feedback  = $('[data-feedback]');

  function setState(msg, isError) {
    stateEl.textContent = msg || '';
    stateEl.hidden = !msg;
    stateEl.classList.toggle('checkout-state--error', !!isError);
  }

  function brl(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function flowFromQuery() {
    return new URLSearchParams(window.location.search).get('produto') || '';
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
    try { data = await res.json(); } catch (_) { /* sem corpo */ }
    if (!res.ok) {
      const err = new Error(data.error || `Falha (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  let selectedMode = 'avista';
  let flowId = '';

  function render(flow, pricing) {
    $('[data-flow-title]').textContent = `Adquirir ${flow.nome}`;
    $('[data-flow-name]').textContent = flow.nome;
    document.title = `Adquirir ${flow.nome} · RiverFlow`;
    $('[data-promo]').textContent = `-${pricing.promoPct}%`;

    $('[data-price-old]').textContent = brl(flow.licencaCheia);
    $('[data-price-now]').textContent = brl(flow.avista);
    $('[data-price-note]').textContent = `Promo de lançamento. À vista com ${pricing.avistaDescontoPct}% de desconto adicional.`;

    $('[data-avista-val]').textContent = `— ${brl(flow.avista)}`;
    $('[data-parcelado-val]').textContent = `— ${brl(flow.parcelado)}`;
    $('[data-parcelado-desc]').textContent =
      `Em até ${pricing.parceladoMax}x de ${brl(flow.parceladoParcela)} no cartão.`;

    const benefits = (flow.beneficios || []).map((b) =>
      `<li>${b.replace(/</g, '&lt;')}</li>`).join('');
    $('[data-benefits]').innerHTML = benefits;

    // alterna preço em destaque conforme o modo
    document.querySelectorAll('[data-mode-option]').forEach((opt) => {
      opt.addEventListener('click', () => {
        selectedMode = opt.dataset.modeOption;
        document.querySelectorAll('[data-mode-option]').forEach((o) =>
          o.classList.toggle('is-selected', o === opt));
        opt.querySelector('input').checked = true;
        const now = selectedMode === 'avista' ? flow.avista : flow.parcelado;
        $('[data-price-now]').textContent = brl(now);
      });
    });
  }

  async function pay() {
    const btn = $('[data-pay]');
    feedback.textContent = '';
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Redirecionando...';
    try {
      const { url } = await api('/api/checkout/license', {
        method: 'POST',
        body: { flow: flowId, mode: selectedMode },
      });
      window.location.assign(url);
    } catch (err) {
      feedback.textContent = err.status === 503
        ? 'O pagamento está temporariamente indisponível. Tente novamente em instantes.'
        : err.message;
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function init() {
    flowId = flowFromQuery();
    if (!flowId) { setState('Produto não informado.', true); return; }

    setState('Carregando...');
    let pricing;
    try {
      pricing = await api('/api/pricing');
    } catch (_) {
      setState('Não foi possível carregar os preços agora. Tente novamente em instantes.', true);
      return;
    }
    const flow = (pricing.flows || []).find((f) => f.id === flowId);
    if (!flow) { setState('Este produto ainda não está disponível para compra.', true); return; }

    render(flow, pricing);
    setState('');
    wrapEl.hidden = false;

    $('[data-pay]').addEventListener('click', pay);

    if (new URLSearchParams(window.location.search).get('cancelado')) {
      feedback.textContent = 'Pagamento cancelado. Você pode tentar novamente quando quiser.';
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
    if (!session) return; // já redirecionou para /login?next=...
    init();
  });
})();
