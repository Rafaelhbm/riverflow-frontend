'use strict';

(function() {
  const phoneMask = {
    init() {
      // Suporta o campo legado do formulário de contato (#inputTel) e qualquer
      // outro campo de telefone marcado com [data-phone-mask] (ex.: cadastro).
      const inputs = document.querySelectorAll('#inputTel, [data-phone-mask]');
      inputs.forEach((input) => {
        input.addEventListener('input', () => this.handleInput(input));
      });
    },

    handleInput(input) {
      // Remove all non-digit characters
      let digits = input.value.replace(/\D/g, '');

      // Limit to 11 digits
      digits = digits.slice(0, 11);

      // Apply mask based on digit count
      input.value = this.applyMask(digits);
    },

    applyMask(digits) {
      if (digits.length === 0) return '';

      // 11 digits: (XX) XXXXX-XXXX (cell phone)
      if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }

      // 10 digits: (XX) XXXX-XXXX (landline)
      if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
      }

      // Progressive mask for partial input
      if (digits.length <= 2) {
        return `(${digits}`;
      }

      if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      }

      // 8-9 digits
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    phoneMask.init();
  });
})();
