/* global App, Overlays */
// Tela “Caixas”: caixas de texto e legendas prontas para pôr sobre as imagens.
// Um clique num modelo aplica na imagem escolhida; dois cliques removem. Depois de aplicar, dois
// controles posicionam o elemento (altura, de cima para baixo, e rotação) e “Salvar preferências”
// guarda essa posição para as próximas vezes que o modelo for usado.
(function () {
  const { el, $ } = App;
  const PREF_KEY = 'cvh.overlayPrefs';
  const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const savePrefs = p => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } };
  let target = null; // { chId, idx }
  let active = null; // chave do modelo em edição
  let styleEl = null;

  const chapterById = id => App.project.chapters.find(c => c.id === id);
  // figuras do capítulo (lidas do texto do capítulo), com as caixas de cada uma
  function figuresOf(c) {
    if (!c) return [];
    if (App.editorChapterId === c.id && App.flush) App.flush();
    const tpl = document.createElement('template');
    tpl.innerHTML = c.html || '';
    return Array.from(tpl.content.querySelectorAll('figure.img')).map((f, idx) => ({
      idx, asset: f.getAttribute('data-asset'),
      ratio: f.getAttribute('data-ratio') || '',
      ovs: Array.from(f.querySelectorAll(':scope > .fig-ov')).map(o => ({ key: o.getAttribute('data-ov'), y: Number(o.getAttribute('data-y')), rot: Number(o.getAttribute('data-rot')) || 0, text: o.innerText || o.textContent || '' }))
    })).filter(f => App.project.assets[f.asset]);
  }
  // muda a figura no texto do capítulo (no editor, se estiver aberto, ou direto no modelo)
  function onFigure(fn, label) {
    const c = target && chapterById(target.chId);
    if (!c) return;
    if (c.locked) return App.toast('Capítulo bloqueado.');
    App.images.withChapterDom(c, root => { const f = root.querySelectorAll('figure.img')[target.idx]; if (f) fn(f); });
    if (label) App.changed(label);
  }
  const ovOf = (f, key) => f.querySelector(`:scope > .fig-ov[data-ov="${key}"]`);
  function setText(o, text) { o.textContent = ''; String(text).split('\n').forEach((ln, i) => { if (i) o.appendChild(document.createElement('br')); o.appendChild(document.createTextNode(ln)); }); }

  function apply(key) {
    const p = Overlays.byKey(key);
    const pref = loadPrefs()[key] || {};
    let created = false;
    onFigure(f => {
      if (ovOf(f, key)) return;
      const o = document.createElement('div');
      o.className = 'fig-ov';
      o.setAttribute('data-ov', key);
      o.setAttribute('data-y', String(pref.y !== undefined ? pref.y : p.y));
      o.setAttribute('data-rot', String(pref.rot !== undefined ? pref.rot : p.rot));
      o.setAttribute('contenteditable', 'false');
      o.style.top = (pref.y !== undefined ? pref.y : p.y) + '%';
      setText(o, p.text);
      f.insertBefore(o, f.querySelector('figcaption'));
      created = true;
    });
    active = key;
    if (created) App.changed(`${p.kind === 'legenda' ? 'Legenda' : 'Caixa'} “${p.label}” na imagem`);
    render();
  }
  function remove(key) {
    onFigure(f => { const o = ovOf(f, key); if (o) o.remove(); }, 'Caixa removida da imagem');
    if (active === key) active = null;
    render();
  }
  function update(key, patch, label) {
    onFigure(f => {
      const o = ovOf(f, key);
      if (!o) return;
      if (patch.y !== undefined) { o.setAttribute('data-y', String(patch.y)); o.style.top = patch.y + '%'; }
      if (patch.rot !== undefined) o.setAttribute('data-rot', String(patch.rot));
      if (patch.text !== undefined) setText(o, patch.text);
    }, label);
  }

  // imagem com as caixas, do jeito que sai no livro
  function frameView(fig, cls) {
    const a = App.project.assets[fig.asset];
    const ratio = a && a.width && a.height ? a.width / a.height : 1.5;
    return el('div', { class: 'bx-frame ' + (cls || '') }, [el('div', { class: 'fig-frame', style: `aspect-ratio:${ratio.toFixed(4)}` }, [
      el('img', { src: App.assetUrl(fig.asset), alt: '' })
    ].concat(fig.ovs.map(o => {
      const p = Overlays.byKey(o.key);
      if (!p) return null;
      const d = el('div', { class: `fig-ov ov-${p.key}${o.key === active ? ' bx-active' : ''}`, style: Overlays.placeStyle(p, o.y, o.rot) });
      setText(d, o.text);
      return d;
    })))]);
  }

  function render() {
    const v = $('#view-boxes');
    if (!v) return;
    v.innerHTML = '';
    const outer = v;
    const wrap = el('div', { class: 'form-wrap' });
    outer.appendChild(wrap);
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.textContent = Overlays.css('.bx-frame '); document.head.appendChild(styleEl); }
    App.ensureFonts && App.ensureFonts([...new Set(Overlays.PRESETS.map(p => p.font))]);
    // capítulo e imagem
    const withImgs = App.project.chapters.filter(c => /<figure[^>]*class="img"/.test(c.html || ''));
    const cur = App.chapter();
    let ch = (target && chapterById(target.chId)) || (cur && withImgs.includes(cur) ? cur : withImgs[0]);
    const figs = figuresOf(ch);
    if (!target || !ch || target.chId !== ch.id || !figs.find(f => f.idx === target.idx)) target = ch && figs.length ? { chId: ch.id, idx: figs[0].idx } : null;
    const fig = target && figs.find(f => f.idx === target.idx);
    if (fig && active && !fig.ovs.find(o => o.key === active)) active = null;
    if (fig && !active && fig.ovs.length) active = fig.ovs[fig.ovs.length - 1].key;

    wrap.appendChild(el('h2', { text: 'Caixas e legendas sobre as imagens' }));
    if (!withImgs.length) {
      wrap.appendChild(App.card('Nenhuma imagem ainda', [el('p', { class: 'muted', text: 'Insira uma imagem num capítulo (arraste para a página ou use Imagens) e volte aqui para pôr caixas de texto e legendas sobre ela.' })], '', 'span-all'));
      return;
    }
    const pick = el('div', { class: 'bx-pick' }, [
      el('label', { class: 'field' }, [el('span', { class: 'flabel', text: 'Capítulo' }), (() => {
        const s = el('select', { onchange: e => { target = { chId: e.target.value, idx: -1 }; active = null; render(); } }, withImgs.map(c => el('option', { value: c.id, text: c.title || 'Sem título' })));
        s.value = ch.id; return s;
      })()]),
      el('div', { class: 'bx-thumbs' }, figs.map(f => el('button', { class: 'bx-thumb' + (fig && f.idx === fig.idx ? ' on' : ''), title: f.ovs.length ? `${f.ovs.length} caixa(s)` : 'Sem caixas', onclick: () => { target = { chId: ch.id, idx: f.idx }; active = null; render(); } }, [
        el('img', { src: App.assetUrl(f.asset), alt: '' }), f.ovs.length ? el('span', { class: 'bx-count', text: String(f.ovs.length) }) : null
      ])))
    ]);
    // modelos: 1 clique aplica, 2 cliques removem
    const sample = fig || figs[0];
    const tiles = Overlays.PRESETS.map(p => {
      const has = fig && fig.ovs.find(o => o.key === p.key);
      const pref = loadPrefs()[p.key] || {};
      const demo = { asset: sample.asset, ovs: [{ key: p.key, y: has ? has.y : (pref.y !== undefined ? pref.y : p.y), rot: has ? has.rot : (pref.rot !== undefined ? pref.rot : p.rot), text: has ? has.text : p.text }] };
      let timer = null;
      return el('button', {
        class: 'bx-tile' + (has ? ' used' : '') + (active === p.key ? ' on' : ''),
        title: has ? 'Clique para ajustar · dois cliques removem' : 'Clique para aplicar · dois cliques removem',
        onclick: () => { clearTimeout(timer); timer = setTimeout(() => apply(p.key), 230); },
        ondblclick: () => { clearTimeout(timer); if (fig && fig.ovs.find(o => o.key === p.key)) remove(p.key); else App.toast('Este modelo não está nesta imagem.'); }
      }, [frameView(demo, 'mini'), el('strong', { text: p.label }), el('span', { class: 'small muted', text: (p.kind === 'legenda' ? 'Legenda' : 'Caixa de texto') + ' · ' + p.font })]);
    });
    // ajustes do elemento ativo
    const cur0 = fig && active && fig.ovs.find(o => o.key === active);
    const pv = fig ? frameView(fig, 'big') : null;
    let ctrl = null;
    if (cur0) {
      const p = Overlays.byKey(active);
      const live = (patch) => { const o = pv.querySelector(`.ov-${active}`); if (!o) return; const y = patch.y !== undefined ? patch.y : cur0.y, r = patch.rot !== undefined ? patch.rot : cur0.rot; Object.assign(cur0, patch); o.setAttribute('style', Overlays.placeStyle(p, y, r)); if (patch.text !== undefined) setText(o, patch.text); };
      const slider = (label, k, min, max, step, unit) => {
        const out = el('b', { text: cur0[k] + unit });
        const i = el('input', { type: 'range', min, max, step, value: cur0[k] });
        i.addEventListener('input', () => { out.textContent = i.value + unit; live({ [k]: Number(i.value) }); });
        i.addEventListener('change', () => update(active, { [k]: Number(i.value) }, label));
        return el('label', { class: 'bx-slider' }, [el('span', {}, [label + ' ', out]), i]);
      };
      const ta = el('textarea', { rows: 3, value: cur0.text });
      ta.value = cur0.text;
      ta.addEventListener('input', () => live({ text: ta.value }));
      ta.addEventListener('change', () => update(active, { text: ta.value }, 'Texto da caixa'));
      ctrl = App.card(`Ajustar: ${p.label}`, [
        el('label', { class: 'field wide' }, [el('span', { class: 'flabel', text: 'Texto' }), ta]),
        slider('Altura (de cima para baixo)', 'y', 0, 100, 1, '%'),
        slider('Rotação', 'rot', -90, 90, 1, '°'),
        el('div', { class: 'inline wrap' }, [
          el('button', { class: 'primary', text: '★ Salvar preferências', title: 'Guarda esta altura e esta rotação para as próximas vezes que este modelo for usado', onclick: () => { const pr = loadPrefs(); pr[active] = { y: cur0.y, rot: cur0.rot }; savePrefs(pr); App.toast(`Preferências salvas: “${p.label}” virá sempre em ${cur0.y}% de altura e ${cur0.rot}° de rotação.`, 3500); } }),
          loadPrefs()[active] ? el('button', { class: 'ghost', text: 'Esquecer preferências', onclick: () => { const pr = loadPrefs(); delete pr[active]; savePrefs(pr); App.toast('Preferências deste modelo apagadas.'); render(); } }) : null,
          el('button', { class: 'danger', text: 'Remover da imagem', onclick: () => remove(active) })
        ]),
        fig.ovs.length > 1 ? el('div', { class: 'inline wrap' }, [el('span', { class: 'small muted', text: 'Nesta imagem: ' })].concat(fig.ovs.map(o => el('button', { class: 'ghost small-btn' + (o.key === active ? ' on' : ''), text: (Overlays.byKey(o.key) || {}).label || o.key, onclick: () => { active = o.key; render(); } })))) : null
      ], '', 'span-all');
    }
    wrap.appendChild(el('div', { class: 'grid2' }, [
      App.card('Imagem', [pick, pv, el('p', { class: 'small muted', text: 'Assim fica no livro. A caixa acompanha o tamanho da imagem na página.' })]),
      ctrl || App.card('Como usar', [el('p', { class: 'muted', text: 'Escolha a imagem e clique num modelo abaixo para aplicá-lo. Dois cliques num modelo o removem da imagem. Depois de aplicar, ajuste o texto, a altura (de cima para baixo) e a rotação, e use “Salvar preferências” para que o modelo venha sempre nessa posição.' })])
    ]));
    wrap.appendChild(App.card('Modelos de caixas e legendas', [el('div', { class: 'bx-grid' }, tiles)], 'Um clique aplica · dois cliques removem.', 'span-all'));
  }

  App.hooks.viewRender.boxes = render;
  App.boxes = { render, apply, remove, update, figuresOf, prefs: loadPrefs };
})();
