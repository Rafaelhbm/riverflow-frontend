'use strict';

/**
 * RiverFlow — Autenticação (Supabase Auth)
 *
 * Inicializa o client do Supabase (URL + ANON KEY, ambas PÚBLICAS por design)
 * e expõe helpers em window.RiverFlowAuth, consumidos por cadastro.html,
 * login.html e session-guard.js.
 *
 * IMPORTANTE: a anon key é pública e pode ficar no frontend. A service_role
 * NUNCA entra aqui — ela vive só no backend (.env).
 *
 * Requer o supabase-js carregado via CDN ANTES deste arquivo:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

(function () {
  // ─── Configuração pública ────────────────────────────────────────────────
  const SUPABASE_URL = 'https://rgyoahefdsukuiltqwvu.supabase.co';
  // TODO(S0): cole a anon key pública do projeto
  // (Supabase → Settings → API → Project API keys → "anon" "public").
  // É pública por design — pode ficar versionada no frontend.
  const SUPABASE_ANON_KEY = 'COLE_AQUI_A_ANON_KEY_PUBLICA';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[AUTH] supabase-js não carregado. Inclua o <script> do CDN antes de auth.js.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // ─── Tradução de erros do Supabase para PT amigável ──────────────────────
  function translateError(message) {
    if (!message) return 'Algo deu errado. Tente novamente.';
    const m = String(message).toLowerCase();

    if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (m.includes('email not confirmed'))       return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
    if (m.includes('user already registered') ||
        m.includes('already been registered'))   return 'Este e-mail já está cadastrado. Tente entrar.';
    if (m.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
    if (m.includes('unable to validate email') ||
        m.includes('invalid email'))              return 'E-mail inválido.';
    if (m.includes('rate limit') || m.includes('too many'))
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    if (m.includes('network') || m.includes('fetch'))
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    return 'Não foi possível concluir. Tente novamente em instantes.';
  }

  // ─── Helpers de autenticação ─────────────────────────────────────────────

  // Cadastro: nome/telefone vão em options.data → o trigger handle_new_user
  // preenche public.profiles automaticamente.
  async function signUp({ nome, telefone, email, senha }) {
    const { data, error } = await client.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, telefone } },
    });
    if (error) throw new Error(translateError(error.message));
    return data;
  }

  async function signIn({ email, senha }) {
    const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(translateError(error.message));
    return data;
  }

  async function signOut() {
    await client.auth.signOut();
  }

  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session || null;
  }

  // Lê o papel do usuário logado em public.profiles (RLS garante a própria linha).
  async function getRole() {
    const session = await getSession();
    if (!session) return null;
    const { data, error } = await client
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (error) return null;
    return data ? data.role : null;
  }

  window.RiverFlowAuth = { client, signUp, signIn, signOut, getSession, getRole, translateError };

  // ─── Fiação dos formulários (cadastro.html / login.html) ─────────────────
  // A lógica fica aqui (e não inline) porque a CSP do site bloqueia scripts inline.

  function safeNext(fallback) {
    const raw = new URLSearchParams(window.location.search).get('next');
    // Só aceita caminho interno (começa com "/" e não "//") — evita open redirect.
    if (raw && /^\/(?!\/)/.test(raw)) return raw;
    return fallback;
  }

  function setFeedback(el, message, type) {
    if (!el) return;
    el.textContent = message || '';
    el.className = 'auth-feedback' + (type ? ' auth-feedback--' + type : '');
  }

  function digits(value) {
    return (value || '').replace(/\D/g, '');
  }

  function wireCadastro() {
    const form = document.getElementById('form-cadastro');
    if (!form) return;
    const feedback = document.getElementById('auth-feedback');
    const submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFeedback(feedback, '', null);

      const nome     = form.nome.value.trim();
      const telefone = form.telefone.value.trim();
      const email    = form.email.value.trim();
      const senha    = form.senha.value;

      // Validação client-side (espelha validators/contact.js: telefone 10-11 dígitos).
      if (nome.length < 2)                      return setFeedback(feedback, 'Informe seu nome completo.', 'error');
      const tel = digits(telefone);
      if (tel.length < 10 || tel.length > 11)   return setFeedback(feedback, 'Telefone deve ter 10 ou 11 dígitos com DDD.', 'error');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setFeedback(feedback, 'E-mail inválido.', 'error');
      if (senha.length < 6)                     return setFeedback(feedback, 'A senha deve ter pelo menos 6 caracteres.', 'error');

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Criando conta...';
      try {
        await signUp({ nome, telefone, email, senha });
        setFeedback(feedback, 'Conta criada! Redirecionando...', 'success');
        window.location.assign(safeNext('/area'));
      } catch (err) {
        setFeedback(feedback, err.message, 'error');
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  }

  function wireLogin() {
    const form = document.getElementById('form-login');
    if (!form) return;
    const feedback = document.getElementById('auth-feedback');
    const submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFeedback(feedback, '', null);

      const email = form.email.value.trim();
      const senha = form.senha.value;
      if (!email || !senha) return setFeedback(feedback, 'Preencha e-mail e senha.', 'error');

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Entrando...';
      try {
        await signIn({ email, senha });
        window.location.assign(safeNext('/area'));
      } catch (err) {
        setFeedback(feedback, err.message, 'error');
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireCadastro();
    wireLogin();
  });
})();
