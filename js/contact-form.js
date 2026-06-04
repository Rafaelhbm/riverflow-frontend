'use strict';

(function () {
  const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

  // ─── Estado de validação ─────────────────────────────────────
  const valid = { nome: false, empresa: false, receita: false, email: false, phone: false, mensagem: false };

  // ─── Elementos ───────────────────────────────────────────────
  const form          = document.querySelector('form[data-contact-form]');
  if (!form) return;

  const nomeInput     = document.getElementById('inputNome');
  const empresaInput  = document.getElementById('inputEmpresa');
  const receitaInput  = document.getElementById('inputReceita');
  const emailInput    = document.getElementById('inputEmail');
  const phoneInput    = document.getElementById('inputTel');
  const msgInput      = document.getElementById('inputMsg');
  const submitBtn     = form.querySelector('button[type="submit"]');
  const emailInd      = document.getElementById('emailIndicator');
  const phoneInd      = document.getElementById('phoneIndicator');
  const emailHint     = document.getElementById('emailHint');
  const phoneHint     = document.getElementById('phoneHint');
  const charCountEl   = document.getElementById('charCount');
  const charCounter   = charCountEl?.closest('.char-counter');
  const successEl     = document.querySelector('[data-form-success]');

  // ─── Helpers ─────────────────────────────────────────────────
  function setIndicator(ind, hint, state, message) {
    ind.className = 'field-indicator' + (state ? ` ${state}` : '');
    hint.textContent = message || '';
    hint.className   = 'field-hint' + (state === 'valid' ? ' hint--valid' : state === 'invalid' ? ' hint--invalid' : '');
  }

  function setFieldState(input, isValid) {
    input.classList.toggle('input--valid',  isValid);
    input.classList.toggle('input--error', !isValid);
  }

  function updateSubmit() {
    const allValid = valid.nome && valid.empresa && valid.receita && valid.email && valid.phone && valid.mensagem;
    submitBtn.disabled = !allValid;
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Enviando...' : 'Enviar mensagem';
    submitBtn.style.opacity = loading ? '0.7' : '1';
  }

  // ─── Validação: Nome ─────────────────────────────────────────
  nomeInput.addEventListener('input', () => {
    valid.nome = nomeInput.value.trim().length >= 2;
    nomeInput.classList.toggle('input--valid', valid.nome);
    nomeInput.classList.remove('input--error');
    updateSubmit();
  });

  // ─── Validação: Empresa ───────────────────────────────────────
  empresaInput.addEventListener('input', () => {
    valid.empresa = empresaInput.value.trim().length >= 2;
    empresaInput.classList.toggle('input--valid', valid.empresa);
    empresaInput.classList.remove('input--error');
    updateSubmit();
  });

  // ─── Validação: Receita mensal ────────────────────────────────
  receitaInput.addEventListener('change', () => {
    valid.receita = receitaInput.value !== '';
    receitaInput.classList.toggle('input--valid', valid.receita);
    receitaInput.classList.remove('input--error');
    updateSubmit();
  });

  // ─── Validação: Email (MX record via backend) ─────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let emailTimer;
  // Ao sair do campo: validação definitiva (pode mostrar ✗)
  emailInput.addEventListener('blur', () => validateEmail(true));
  emailInput.addEventListener('input', () => {
    clearTimeout(emailTimer);
    setIndicator(emailInd, emailHint, '', '');
    emailInput.classList.remove('input--valid', 'input--error');
    valid.email = false;
    updateSubmit();
    const val = emailInput.value.trim();
    // Enquanto digita, só checa quando o e-mail JÁ está completo — e nunca mostra "inválido"
    if (EMAIL_RE.test(val)) {
      emailTimer = setTimeout(() => validateEmail(false), 700);
    }
  });

  // showInvalid=false enquanto digita (não mostra ✗); true ao sair do campo
  async function validateEmail(showInvalid = true) {
    const val = emailInput.value.trim();
    if (!val) return;

    setIndicator(emailInd, emailHint, 'checking', 'Verificando...');

    try {
      const res  = await fetch(`${API_BASE_URL}/api/validate/email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: val })
      });
      const data = await res.json();

      if (data.valid) {
        setIndicator(emailInd, emailHint, 'valid', 'Email válido');
        setFieldState(emailInput, true);
        valid.email = true;
      } else {
        valid.email = false;
        if (showInvalid) {
          setIndicator(emailInd, emailHint, 'invalid', data.reason || 'Email inválido');
          setFieldState(emailInput, false);
        } else {
          setIndicator(emailInd, emailHint, '', ''); // neutro enquanto digita
        }
      }
    } catch {
      // Servidor indisponível (ex: cold start) — valida o formato localmente
      if (EMAIL_RE.test(val)) {
        setIndicator(emailInd, emailHint, 'valid', 'Email válido');
        setFieldState(emailInput, true);
        valid.email = true;
      } else {
        valid.email = false;
        if (showInvalid) {
          setIndicator(emailInd, emailHint, 'invalid', 'Email inválido');
          setFieldState(emailInput, false);
        } else {
          setIndicator(emailInd, emailHint, '', '');
        }
      }
    }

    updateSubmit();
  }

  // ─── Validação: Telefone (DDD brasileiro via backend) ─────────
  let phoneTimer;
  // Ao sair do campo: validação definitiva (pode mostrar ✗)
  phoneInput.addEventListener('blur', () => validatePhone(true));
  phoneInput.addEventListener('input', () => {
    clearTimeout(phoneTimer);
    setIndicator(phoneInd, phoneHint, '', '');
    phoneInput.classList.remove('input--valid', 'input--error');
    valid.phone = false;
    updateSubmit();
    const digits = phoneInput.value.replace(/\D/g, '');
    // Enquanto digita, só checa quando o número JÁ está completo — e nunca mostra "inválido"
    if (digits.length === 10 || digits.length === 11) {
      phoneTimer = setTimeout(() => validatePhone(false), 500);
    }
  });

  // showInvalid=false enquanto digita (não mostra ✗); true ao sair do campo
  async function validatePhone(showInvalid = true) {
    const val = phoneInput.value.trim();
    if (!val) return;

    setIndicator(phoneInd, phoneHint, 'checking', 'Verificando...');

    const markInvalid = (msg) => {
      valid.phone = false;
      if (showInvalid) {
        setIndicator(phoneInd, phoneHint, 'invalid', msg);
        setFieldState(phoneInput, false);
      } else {
        setIndicator(phoneInd, phoneHint, '', ''); // neutro enquanto digita
      }
    };

    try {
      const res  = await fetch(`${API_BASE_URL}/api/validate/phone`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ telefone: val })
      });
      const data = await res.json();

      if (data.valid) {
        setIndicator(phoneInd, phoneHint, 'valid', 'Número válido');
        setFieldState(phoneInput, true);
        valid.phone = true;
      } else {
        markInvalid(data.reason || 'Telefone inválido');
      }
    } catch {
      // Servidor indisponível (ex: cold start) — valida o formato localmente
      const digits = val.replace(/\D/g, '');
      const okFormat = (digits.length === 10 || digits.length === 11) &&
                       (digits.length === 10 || digits[2] === '9');
      if (okFormat) {
        setIndicator(phoneInd, phoneHint, 'valid', 'Número válido');
        setFieldState(phoneInput, true);
        valid.phone = true;
      } else {
        markInvalid('Telefone inválido');
      }
    }

    updateSubmit();
  }

  // ─── Botão X (indicador inválido) limpa o campo de uma vez ───
  function clearField(input, indicator, hint, key) {
    input.value = '';
    input.classList.remove('input--valid', 'input--error');
    setIndicator(indicator, hint, '', '');
    valid[key] = false;
    updateSubmit();
    input.focus();
  }

  emailInd.addEventListener('click', () => {
    if (emailInd.classList.contains('invalid')) clearField(emailInput, emailInd, emailHint, 'email');
  });
  phoneInd.addEventListener('click', () => {
    if (phoneInd.classList.contains('invalid')) clearField(phoneInput, phoneInd, phoneHint, 'phone');
  });

  // ─── Validação: Mensagem (mínimo 50 chars) ───────────────────
  msgInput.addEventListener('input', () => {
    const len = msgInput.value.trim().length;
    if (charCountEl) charCountEl.textContent = len;

    if (len >= 50) {
      valid.mensagem = true;
      charCounter?.classList.add('reached');
      charCounter?.classList.remove('short');
      msgInput.classList.add('input--valid');
      msgInput.classList.remove('input--error');
    } else {
      valid.mensagem = false;
      charCounter?.classList.remove('reached');
      charCounter?.classList.toggle('short', len > 0);
      msgInput.classList.remove('input--valid', 'input--error');
    }

    updateSubmit();
  });

  // ─── Envio ───────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!valid.nome || !valid.empresa || !valid.receita || !valid.email || !valid.phone || !valid.mensagem) return;

    // Token do Cloudflare Turnstile (injetado pelo widget no form)
    const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value || '';
    if (!turnstileToken) {
      showError('Complete a verificação anti-robô antes de enviar.');
      return;
    }

    setLoading(true);

    const data = {
      nome:          nomeInput.value.trim(),
      email:         emailInput.value.trim(),
      telefone:      phoneInput.value.replace(/\D/g, ''),
      empresa:       empresaInput.value.trim(),
      receitaMensal: receitaInput.value,
      mensagem:      msgInput.value.trim(),
      turnstileToken
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });

      if (res.status === 429 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        showError(body.error || 'Não foi possível enviar sua mensagem. Tente novamente.');
        window.turnstile?.reset();
        setLoading(false);
        submitBtn.disabled = false;
        return;
      }

      if (!res.ok) throw new Error('Erro no servidor');

      form.style.display = 'none';
      if (successEl) successEl.style.display = 'block';
    } catch {
      showError('Não foi possível enviar sua mensagem. Tente novamente.');
      window.turnstile?.reset();
      setLoading(false);
      submitBtn.disabled = false;
    }
  });

  function showError(msg) {
    const el = document.createElement('div');
    el.className = 'form-alert form-alert--error';
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', top: '20px', left: '50%',
      transform: 'translateX(-50%)',
      background: '#ef4444', color: '#fff',
      padding: '14px 24px', borderRadius: '8px',
      zIndex: '9999', maxWidth: '90%',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: '14px'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

})();