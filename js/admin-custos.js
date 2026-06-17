'use strict';

/**
 * RiverFlow — Painel admin: dashboard de cobrança por uso (P9/S8)
 *
 * Exige admin (admin-api.js já roda RiverFlowGuard.requireAdmin e dispara
 * 'admin:ready'). Lê GET /api/admin/billing?period= e mostra, por cliente,
 * uso/custo/valor atual/recomendado/margem + totais. "Recalcular" roda o motor;
 * "Aplicar" ajusta o Stripe e o valor vigente (com confirmação).
 *
 * Valores em centavos vindos do backend; aqui só formatamos para BRL.
 */

(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => (window.Admin ? window.Admin.escapeHtml(v) : String(v == null ? '' : v));

  const stateEl = $('[data-state]');
  const feedback = $('[data-feedback]');
  const periodInput = $('[data-period]');

  function setState(msg) { stateEl.textContent = msg || ''; stateEl.hidden = !msg; }
  function setFeedback(msg, type) {
    feedback.textContent = msg || '';
    feedback.className = 'admin-feedback' + (type ? ` admin-feedback--${type}` : '');
  }

  function brl(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // <input type="month"> usa 'YYYY-MM'; a API usa 'YYYY-MM-01'.
  function periodValue() {
    const v = periodInput.value;
    return v ? `${v}-01` : '';
  }
  function defaultMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function usageSummary(usage) {
    const entries = Object.entries(usage || {});
    if (!entries.length) return '<span class="billing-dim">sem uso</span>';
    return entries
      .map(([k, v]) => `<span class="billing-metric">${esc(k)}: <strong>${esc(v)}</strong></span>`)
      .join(' ');
  }

  function rowHtml(r) {
    const marginClass = r.margin < 0 ? 'is-negative' : 'is-positive';
    const cliente = esc(r.nome || r.email || r.userId);
    const trial = r.inTrial ? ' <span class="billing-tag">trial</span>' : '';
    const applied = r.status === 'aplicado';
    const canApply = !!r.recommendationId && !applied && r.recommendedAmount !== r.currentAmount;

    let action;
    if (applied) {
      action = '<span class="billing-tag billing-tag--ok">aplicado</span>';
    } else if (!r.recommendationId) {
      action = '<span class="billing-dim">recalcule</span>';
    } else if (!canApply) {
      action = '<span class="billing-dim">sem ajuste</span>';
    } else {
      action = `<button class="btn btn--sm btn--primary" data-apply="${esc(r.recommendationId)}"
                  data-amount="${esc(r.recommendedAmount)}" data-cliente="${esc(cliente)}">Aplicar</button>`;
    }

    return `
      <tr>
        <td>${cliente}${trial}</td>
        <td>${esc(r.planNome)}</td>
        <td class="billing-usage">${usageSummary(r.usage)}</td>
        <td class="num">${brl(r.computedCost)}</td>
        <td class="num">${brl(r.currentAmount)}</td>
        <td class="num">${brl(r.recommendedAmount)}</td>
        <td class="num ${marginClass}">${brl(r.margin)}</td>
        <td>${action}</td>
      </tr>`;
  }

  function renderTotals(t) {
    $('[data-total-cost]').textContent = brl(t.totalCost);
    $('[data-total-revenue]').textContent = brl(t.totalRevenue);
    $('[data-total-margin]').textContent = brl(t.totalMargin);
    $('[data-below-count]').textContent = String(t.belowCostCount || 0);
    $('[data-total-margin]').classList.toggle('is-negative', (t.totalMargin || 0) < 0);
    $('[data-cards]').hidden = false;
  }

  async function load() {
    setState('Carregando...');
    setFeedback('');
    $('[data-table-wrap]').hidden = true;
    try {
      const data = await window.Admin.api(`/billing?period=${encodeURIComponent(periodValue())}`);
      renderTotals(data.totals || {});
      const tbody = $('[data-rows]');
      if (!data.rows || !data.rows.length) {
        tbody.innerHTML = '';
        setState('Nenhuma assinatura ativa neste período.');
        return;
      }
      tbody.innerHTML = data.rows.map(rowHtml).join('');
      tbody.querySelectorAll('[data-apply]').forEach((btn) => {
        btn.addEventListener('click', () => apply(btn));
      });
      setState('');
      $('[data-table-wrap]').hidden = false;
    } catch (err) {
      setState('');
      setFeedback(err.message || 'Falha ao carregar.', 'error');
    }
  }

  async function recalc() {
    const btn = $('[data-recalc]');
    btn.disabled = true;
    setFeedback('Recalculando...');
    try {
      const r = await window.Admin.api('/billing/recalculate', { method: 'POST', body: { period: periodValue() } });
      setFeedback(`Recalculado: ${r.recalculated} assinatura(s).`, 'success');
      await load();
    } catch (err) {
      setFeedback(err.message || 'Falha ao recalcular.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function apply(btn) {
    const id = btn.dataset.apply;
    const valor = brl(btn.dataset.amount);
    const cliente = btn.dataset.cliente;
    if (!window.confirm(`Aplicar ${valor}/mês para ${cliente}? O Stripe será atualizado para o próximo ciclo.`)) return;
    btn.disabled = true;
    setFeedback('Aplicando ajuste...');
    try {
      await window.Admin.api(`/billing/${encodeURIComponent(id)}/apply`, { method: 'POST' });
      setFeedback(`Ajuste de ${valor} aplicado para ${cliente}.`, 'success');
      await load();
    } catch (err) {
      setFeedback(err.message || 'Falha ao aplicar.', 'error');
      btn.disabled = false;
    }
  }

  function init() {
    periodInput.value = defaultMonth();
    periodInput.addEventListener('change', load);
    $('[data-recalc]').addEventListener('click', recalc);
    load();
  }

  // admin-api.js confirma o admin e dispara 'admin:ready'. Cobre o caso de já
  // estar pronto (race) checando a flag.
  if (window.Admin && window.Admin.ready) init();
  else document.addEventListener('admin:ready', init, { once: true });
})();
