'use strict';

/**
 * RiverFlow — Session Guard
 *
 * Protege páginas que exigem login. Sem sessão → redireciona para /login,
 * preservando o destino em ?next= para voltar após autenticar.
 *
 * Uso numa página protegida (depois de auth.js):
 *   <script src="js/session-guard.js"></script>
 *   <script>RiverFlowGuard.requireSession();</script>
 *
 * Página só de admin:
 *   <script>RiverFlowGuard.requireAdmin();</script>
 *
 * O backend SEMPRE revalida o role pelo JWT — este guard é só UX.
 */

(function () {
  if (!window.RiverFlowAuth) {
    console.error('[GUARD] auth.js precisa ser carregado antes de session-guard.js.');
    return;
  }

  const { getSession, getRole } = window.RiverFlowAuth;

  function gotoLogin() {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('/login?next=' + next);
  }

  // Garante sessão válida; sem sessão → /login. Resolve com a sessão.
  async function requireSession() {
    const session = await getSession();
    if (!session) {
      gotoLogin();
      return null;
    }
    return session;
  }

  // Garante sessão + role admin; não-admin é mandado para a home.
  async function requireAdmin() {
    const session = await requireSession();
    if (!session) return null;
    const role = await getRole();
    if (role !== 'admin') {
      window.location.replace('/');
      return null;
    }
    return session;
  }

  window.RiverFlowGuard = { requireSession, requireAdmin };
})();
