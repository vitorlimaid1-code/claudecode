/* global App */
// Ícones de traço (24 × 24) da interface: menu lateral, barra superior e boas-vindas.
(function () {
  const P = {
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M7 3v5h8V3"/><path d="M7 21v-7h10v7"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
    cover: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m5 16 4-4 3 3 2-2 5 5"/><circle cx="14.5" cy="8.5" r="1.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    credits: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/>',
    heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 21 9.7C21 6 17 3 12 3Z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    pilcrow: '<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
    font: '<path d="m4 20 6-16h1l6 16"/><path d="M6.5 14h8"/>',
    images: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M21 8v11a2 2 0 0 1-2 2H8"/><path d="m3 15 4-4 4 4 2-2 4 4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
    note: '<path d="M5 4h14v12l-4 4H5Z"/><path d="M15 20v-4h4"/><path d="M8 9h8M8 13h5"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    export: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    kdp: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    feather: '<path d="M20 4c-6 0-12 4-13 13l-3 3"/><path d="M8 16h6l4-4"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4M7 16h4M14 12h3v4h-3Z"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18Z" fill="currentColor"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    library: '<path d="M4 4h4v16H4ZM10 4h4v16h-4Z"/><path d="m16 5 3.5-1 3 15.5-3.5 1Z"/>',
    blocks: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"/>',
    mountain: '<path d="m3 19 6-9 4 6 3-4 5 7Z"/><circle cx="16.5" cy="6.5" r="2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'
  };
  const svg = name => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.book}</svg>`;
  const NAV = { titles: 'heading', blocks: 'blocks', frontimages: 'cover', immersion: 'mountain', book: 'info', catalog: 'credits', back: 'pen', layout: 'layout', typo: 'sparkles', stylelib: 'palette', styles: 'pilcrow', fonts: 'font', assets: 'images', layers: 'layers', notes: 'note', tools: 'check', cover: 'book', export: 'export', poetry: 'feather', periodical: 'news', kdp: 'kdp', appearance: 'contrast', reset: 'reset' };
  const CMD = { enhance: 'sparkles', translate: 'globe', new: 'file', open: 'folder', save: 'save', import: 'upload', projectUndo: 'undo', projectRedo: 'redo', history: 'clock', library: 'library', export: 'export' };
  function apply() {
    document.querySelectorAll('.nav-item').forEach(b => {
      const k = b.dataset.view ? NAV[b.dataset.view] : b.id === 'navTitles' ? 'heading' : null;
      const ic = b.querySelector('.ic');
      if (k && ic) ic.innerHTML = svg(k);
    });
    document.querySelectorAll('.topbar [data-cmd]').forEach(b => {
      const k = CMD[b.dataset.cmd];
      if (!k || b.querySelector('svg')) return;
      const label = b.textContent.replace(/^[↶↷]\s*/, '').trim();
      b.innerHTML = svg(k) + (label ? `<span>${label}</span>` : '');
    });
    const el = document.getElementById('btnElements');
    if (el && !el.querySelector('svg')) el.innerHTML = svg('blocks') + '<span>Elementos</span>';
  }
  App.icons = { svg, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
