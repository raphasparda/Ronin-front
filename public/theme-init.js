// Aplica o tema salvo antes do primeiro paint (script externo por causa da CSP). Padrão: claro.
(function () {
  var theme = 'light';
  try {
    if (window.localStorage.getItem('ronin.theme') === 'dark') theme = 'dark';
  } catch {
    // Armazenamento bloqueado: fica no tema claro.
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
