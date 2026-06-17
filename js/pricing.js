'use strict';

/**
 * RiverFlow — Preços dos planos na home (seção #planos).
 *
 * Busca GET /api/pricing e preenche as FAIXAS de cada plano em [data-plan-range].
 * Regra do projeto: NENHUM valor monetário é cravado no HTML — o front só exibe
 * o que o backend devolve. Enquanto o endpoint (P7) não existir, o placeholder "—"
 * permanece e um aviso discreto é logado.
 *
 * Formato esperado de /api/pricing (apenas exibição):
 *   { plans: [ { id:'stream', min:12990, max:16990 },
 *              { id:'flow',   min:29990, max:59990 },
 *              { id:'tita',   min:99990, max:null } ] }
 * Valores em centavos (R$129,90 = 12990).
 */

(function () {
  const grid = document.querySelector('[data-pricing]');
  if (!grid) return;

  // Formata centavos → "R$ 129,90"
  function brl(cents) {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  }

  // Monta o texto da faixa: "R$129,90 a R$169,90" ou "a partir de R$999,90" (sem teto).
  function rangeLabel(plan) {
    if (plan.min == null) return null;
    if (plan.max == null) return `a partir de ${brl(plan.min)}`;
    return `${brl(plan.min)} a ${brl(plan.max)}`;
  }

  function fill(plans) {
    plans.forEach((plan) => {
      const el = grid.querySelector(`[data-plan-range="${plan.id}"]`);
      const label = rangeLabel(plan);
      if (el && label) el.textContent = label;
    });
  }

  fetch('/api/pricing', { headers: { Accept: 'application/json' } })
    .then((res) => {
      if (!res.ok) throw new Error('pricing indisponível (' + res.status + ')');
      return res.json();
    })
    .then((data) => {
      if (data && Array.isArray(data.plans)) fill(data.plans);
    })
    .catch((err) => {
      // P7 ainda não existe ou backend fora do ar: mantém o placeholder "—".
      console.info('[PRICING] faixas não carregadas, mantendo placeholder:', err.message);
    });
})();
