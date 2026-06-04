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

  // ─── Validação: Email (no navegador — instantânea e confiável) ─
  // Regex prático (RFC-friendly): aceita e-mails reais, barra malformados.
  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  emailInput.addEventListener('input', () => validateEmail(false)); // ao vivo: só confirma ✓
  emailInput.addEventListener('blur',  () => validateEmail(true));  // ao sair: pode mostrar ✗

  // showInvalid=false enquanto digita (não mostra ✗); true ao sair do campo
  function validateEmail(showInvalid = true) {
    const val = emailInput.value.trim();

    if (!val) {
      setIndicator(emailInd, emailHint, '', '');
      emailInput.classList.remove('input--valid', 'input--error');
      valid.email = false;
      updateSubmit();
      return;
    }

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
        setIndicator(emailInd, emailHint, '', ''); // neutro enquanto digita
        emailInput.classList.remove('input--valid', 'input--error');
      }
    }

    updateSubmit();
  }

  // ─── Validação: Telefone (DDD + celular, no navegador) ────────
  const VALID_DDDS = new Set([
    11,12,13,14,15,16,17,18,19, 21,22,24,27,28, 31,32,33,34,35,37,38,
    41,42,43,44,45,46,47,48,49, 51,53,54,55, 61,62,63,64,65,66,67,68,69,
    71,73,74,75,77,79, 81,82,83,84,85,86,87,88,89, 91,92,93,94,95,96,97,98,99
  ]);

  // Retorna null se o número é válido; senão, o motivo
  function phoneReason(digits) {
    if (digits.length < 10 || digits.length > 11) return 'Telefone deve ter 10 ou 11 dígitos';
    if (!VALID_DDDS.has(parseInt(digits.slice(0, 2), 10))) return 'DDD inválido';
    if (digits.length === 11 && digits[2] !== '9') return 'Celular deve começar com 9 após o DDD';
    return null;
  }

  phoneInput.addEventListener('input', () => validatePhone(false)); // ao vivo: só confirma ✓
  phoneInput.addEventListener('blur',  () => validatePhone(true));  // ao sair: pode mostrar ✗

  // showInvalid=false enquanto digita (não mostra ✗); true ao sair do campo
  function validatePhone(showInvalid = true) {
    const digits = phoneInput.value.replace(/\D/g, '');

    if (!digits) {
      setIndicator(phoneInd, phoneHint, '', '');
      phoneInput.classList.remove('input--valid', 'input--error');
      valid.phone = false;
      updateSubmit();
      return;
    }

    const reason = phoneReason(digits);
    if (!reason) {
      setIndicator(phoneInd, phoneHint, 'valid', 'Número válido');
      setFieldState(phoneInput, true);
      valid.phone = true;
    } else {
      valid.phone = false;
      if (showInvalid) {
        setIndicator(phoneInd, phoneHint, 'invalid', reason);
        setFieldState(phoneInput, false);
      } else {
        setIndicator(phoneInd, phoneHint, '', ''); // neutro enquanto digita
        phoneInput.classList.remove('input--valid', 'input--error');
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