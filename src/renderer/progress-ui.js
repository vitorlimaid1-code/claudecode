/* global App */
// Painel de progresso: enquanto o livro é carregado ou exportado, mostra cada etapa (registro com tempo),
// e no fim um resumo com os próximos passos.
(function () {
  const { el, $ } = App;
  let box = null, list = null, bar = null, t0 = 0, expect = null, onPaged = null;
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s';

  function open(title, sub) {
    close();
    t0 = Date.now();
    list = el('ol', { class: 'pg-log' });
    bar = el('div', { class: 'pg-bar' }, [el('span')]);
    box = el('div', { class: 'pg-back' }, [el('div', { class: 'pg-card' }, [
      el('div', { class: 'pg-head' }, [
        el('div', { class: 'pg-mark' }, [el('span', { class: 'pg-spin' })]),
        el('div', {}, [el('h2', { class: 'pg-title', text: title }), el('p', { class: 'pg-sub muted', text: sub || '' })])
      ]),
      bar, list, el('div', { class: 'pg-foot' })
    ])]);
    document.body.appendChild(box);
    P.active = true;
  }
  function log(msg, kind) {
    if (!box) {
      if (!expect) return;
      open(expect.title, expect.sub);
    }
    const li = el('li', { class: kind || '' }, [el('span', { class: 'pg-t', text: secs() }), el('span', { class: 'pg-m', text: msg })]);
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  }
  function done(title, lines, buttons) {
    if (!box) open(title);
    P.active = false;
    expect = null;
    onPaged = null;
    box.classList.add('done');
    box.querySelector('.pg-title').textContent = title;
    box.querySelector('.pg-sub').textContent = `Concluído em ${secs()}`;
    (lines || []).forEach(l => log(l, 'ok'));
    const foot = box.querySelector('.pg-foot');
    foot.innerHTML = '';
    (buttons || [{ label: 'Fechar', primary: true }]).forEach(b => foot.appendChild(el('button', { class: b.primary ? 'primary' : '', text: b.label, onclick: () => { close(); if (b.onClick) b.onClick(); } })));
  }
  function fail(msg) {
    log(msg, 'bad');
    P.active = false;
    expect = null;
    onPaged = null;
    if (!box) return;
    box.classList.add('done', 'failed');
    box.querySelector('.pg-sub').textContent = 'Não foi possível concluir';
    const foot = box.querySelector('.pg-foot');
    foot.innerHTML = '';
    foot.appendChild(el('button', { class: 'primary', text: 'Fechar', onclick: close }));
  }
  function close() { if (box) box.remove(); box = null; P.active = false; expect = null; }

  // a paginação da tela avisa cada trecho pronto; o painel acompanha e conclui quando todas as páginas existem
  function paged(info, doneN, total) {
    if (!box || !onPaged) return;
    if (P._lastDone !== doneN) { P._lastDone = doneN; log(`Paginando: ${doneN}/${total} partes · ${info.pages} páginas`); }
    if (!info.pending) { const fn = onPaged; onPaged = null; fn(info); }
  }

  const P = App.progress = { open, log, done, fail, close, paged, active: false,
    expect: (title, sub) => { expect = { title, sub }; },
    whenPaged: fn => { onPaged = fn; P._lastDone = -1; } };
  const init = () => { if (App.api && App.api.onProgress) App.api.onProgress(msg => log(msg)); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
