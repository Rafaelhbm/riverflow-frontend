'use strict';

/**
 * RiverFlow — Painel admin: guarda + helpers de API.
 *
 * • Garante sessão + role admin no carregamento (RiverFlowGuard.requireAdmin).
 *   O backend SEMPRE revalida o role pelo JWT — este guard é só UX (CSP do site
 *   bloqueia scripts inline, por isso a chamada vive aqui e não no HTML).
 * • Admin.api(path, opts) → fetch para /api/admin/* com Bearer do Supabase.
 * • Admin.uploadSigned(bucket, path, token, file) → envia o arquivo DIRETO ao
 *   Supabase Storage usando a signed upload URL gerada pelo backend.
 *
 * Expõe window.Admin (preenchido após confirmar a sessão admin).
 */

(function () {
  if (!window.RiverFlowAuth || !window.RiverFlowGuard) {
    console.error('[ADMIN] auth.js e session-guard.js precisam carregar antes de admin-api.js.');
    return;
  }

  const { client, getSession } = window.RiverFlowAuth;
  let _session = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // fetch autenticado para o backend. Lança Error(msg PT) em status != ok.
  async function api(path, opts) {
    opts = opts || {};
    if (!_session) _session = await getSession();
    const headers = Object.assign(
      { Accept: 'application/json' },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      _session ? { Authorization: `Bearer ${_session.access_token}` } : {},
      opts.headers || {}
    );
    const res = await fetch(`/api/admin${path}`, {
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

  // Envia o arquivo direto ao Storage usando a signed upload URL.
  async function uploadSigned(bucket, path, token, file, onProgress) {
    // supabase-js >=2 expõe uploadToSignedUrl(path, token, file).
    const { error } = await client.storage.from(bucket).uploadToSignedUrl(path, token, file);
    if (error) throw new Error(error.message || 'Falha no envio do arquivo.');
    if (typeof onProgress === 'function') onProgress(100);
    return true;
  }

  window.Admin = { api, uploadSigned, escapeHtml, ready: false };

  // Confirma a sessão admin ANTES de liberar as páginas. requireAdmin redireciona
  // quem não for admin (deslogado → /login; logado não-admin → /).
  document.addEventListener('DOMContentLoaded', async () => {
    const session = await window.RiverFlowGuard.requireAdmin();
    if (!session) return;            // já redirecionado
    _session = session;
    window.Admin.ready = true;
    document.dispatchEvent(new CustomEvent('admin:ready', { detail: { session } }));
  });
})();
