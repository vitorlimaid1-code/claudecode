// Aparência do sistema (modo claro/escuro/automático e cor de destaque). Carregado no <head> para
// aplicar antes da primeira pintura da janela. Preferência guardada neste computador.
(function () {
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function apply() {
    const mode = get('themeMode', 'light');
    const dark = mode === 'dark' || (mode === 'auto' && mq && mq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.accent = get('themeAccent', 'vertigem');
    // a prévia (iframes) acompanha o modo
    document.querySelectorAll && document.querySelectorAll('iframe.preview-frame').forEach(f => { try { f.contentDocument.documentElement.dataset.theme = document.documentElement.dataset.theme; } catch (e) { /* ok */ } });
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  window.SystemTheme = {
    apply,
    get mode() { return get('themeMode', 'light'); },
    get accent() { return get('themeAccent', 'vertigem'); },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } apply(); },
    reset() { try { localStorage.removeItem('themeMode'); localStorage.removeItem('themeAccent'); } catch (e) { /* ok */ } apply(); }
  };
})();
