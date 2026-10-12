/* global App */
// Prévia 3D da capa: o livro montado (capa, lombada, contracapa e o miolo com as folhas),
// girando em qualquer direção — frente, verso, lombada, lateral das folhas, cima e baixo — e
// salvando a imagem em PNG com fundo transparente. Renderizador próprio em canvas 2D (não
// depende de WebGL/placa de vídeo): cada face é dividida em pequenos triângulos com textura,
// o que dá perspectiva correta em qualquer computador. As texturas vêm da prova de cor CMYK.
(function () {
  // ---------- quatérnios ----------
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
  const qAxis = (x, y, z, ang) => { const s = Math.sin(ang / 2); return [x * s, y * s, z * s, Math.cos(ang / 2)]; };
  const qNorm = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
  function qSlerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map(v => -v); d = -d; }
    if (d > 0.9995) return qNorm(a.map((v, i) => v + (b[i] - v) * t));
    const th = Math.acos(d), s = Math.sin(th);
    return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
  }
  function qMat(q) {
    const [x, y, z, w] = q;
    return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  }
  const rot = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];

  function paper(vertical) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f3eee2';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 2) {
      g.fillStyle = `rgba(120,105,80,${(0.05 + Math.random() * 0.09).toFixed(3)})`;
      if (vertical) g.fillRect(i, 0, 1, 256); else g.fillRect(0, i, 256, 1);
    }
    return c;
  }

  // desenha o triângulo de origem (s) no de destino (d) com transformação afim e recorte
  function tri(ctx, img, s, d) {
    const [s0, s1, s2] = s, [d0, d1, d2] = d;
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(den) < 1e-9) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
    const dd = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    const e = d0[0] - a * s0[0] - c * s0[1];
    const f = d0[1] - b * s0[0] - dd * s0[1];
    // recorte levemente ampliado: sem frestas entre triângulos vizinhos
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const grow = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 1.1, p[1] + dy / l * 1.1]; };
    const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, dd, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  class Viewer {
    constructor(host, proof) {
      this.host = host;
      this.g = proof.geometry;
      const g = this.g;
      const W = g.W, H = g.H, D = Math.max(g.spine, 1.5);
      const a = W / 2, b = H / 2, c = D / 2;
      const img = proof.image;
      const k = img.width / g.totalW; // px por mm na textura
      const top = g.outer * k;
      const rect = (x, w) => [x * k, top, Math.max(1, w * k), H * k];
      const pv = paper(true), ph = paper(false);
      const full = cv => [0, 0, cv.width, cv.height];
      // face: canto superior esquerdo, direção u (→) e v (↓) no espaço do livro, normal, textura e retângulo
      this.faces = [
        { p: [-a, b, c], u: [a, b, c], v: [-a, -b, c], n: [0, 0, 1], img, r: rect(g.frontTrim[0], W) },
        { p: [a, b, -c], u: [-a, b, -c], v: [a, -b, -c], n: [0, 0, -1], img, r: rect(g.backTrim[0], W) },
        { p: [-a, b, -c], u: [-a, b, c], v: [-a, -b, -c], n: [-1, 0, 0], img, r: rect(g.panels.spine[0], Math.max(g.spine, 0.01)) },
        { p: [a, b, c], u: [a, b, -c], v: [a, -b, c], n: [1, 0, 0], img: pv, r: full(pv) },
        { p: [-a, b, -c], u: [a, b, -c], v: [-a, b, c], n: [0, 1, 0], img: ph, r: full(ph) },
        { p: [-a, -b, c], u: [a, -b, c], v: [-a, -b, -c], n: [0, -1, 0], img: ph, r: full(ph) }
      ];
      this.size = Math.max(W, H, D);
      this.dist = this.size * 3.2;
      this.zoom = 1;
      this.q = [0, 0, 0, 1];
      this.canvas = document.createElement('canvas');
      host.appendChild(this.canvas);
      this.setView('3/4', true);
      this.bind();
      this.resize();
      this.loop();
    }

    setView(name, now) {
      const e = { front: [0, 0], back: [0, Math.PI], spine: [0, Math.PI / 2], edge: [0, -Math.PI / 2], top: [Math.PI / 2, 0], bottom: [-Math.PI / 2, 0], '3/4': [0.2, 0.6] }[name] || [0, 0];
      const q = qMul(qAxis(1, 0, 0, e[0]), qAxis(0, 1, 0, e[1]));
      if (now) this.q = q; else this.target = q;
      this.auto = false;
      this.dirty = true;
    }

    bind() {
      const el = this.canvas;
      let drag = null;
      el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } this.target = null; this.auto = false; });
      el.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        // arrastar para os lados gira para a esquerda/direita; para cima/baixo mostra o topo/a base
        this.q = qNorm(qMul(qAxis(1, 0, 0, dy * 0.01), qMul(qAxis(0, 1, 0, dx * 0.01), this.q)));
        this.dirty = true;
      });
      el.addEventListener('pointerup', () => { drag = null; });
      el.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(0.4, Math.min(3, this.zoom * (e.deltaY > 0 ? 0.92 : 1.08))); this.dirty = true; }, { passive: false });
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.host);
    }

    resize() {
      const w = this.host.clientWidth || 700, h = this.host.clientHeight || 450;
      const r = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(w * r); this.canvas.height = Math.round(h * r);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.dirty = true;
    }

    draw(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      const m = qMat(this.q);
      const dist = this.dist;
      const f = Math.min(w, h) * 0.78 * dist / this.size * this.zoom;
      const proj = p => { const z = dist - p[2]; return [w / 2 + f * p[0] / z, h / 2 - f * p[1] / z]; };
      const light = qNorm([-0.45, 0.55, 0.9, 0]).slice(0, 3);
      const faces = this.faces.map(fc => {
        const n = rot(m, fc.n);
        const center = rot(m, [(fc.u[0] + fc.v[0]) / 2, (fc.u[1] + fc.v[1]) / 2, (fc.u[2] + fc.v[2]) / 2]);
        const toCam = [-center[0], -center[1], dist - center[2]];
        return { fc, n, vis: n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] > 0, depth: center[2] };
      }).filter(x => x.vis).sort((x, y) => x.depth - y.depth);
      const N = 12;
      for (const { fc, n } of faces) {
        const P = rot(m, fc.p), U = rot(m, fc.u), V = rot(m, fc.v);
        const du = [U[0] - P[0], U[1] - P[1], U[2] - P[2]], dv = [V[0] - P[0], V[1] - P[1], V[2] - P[2]];
        const [rx, ry, rw, rh] = fc.r;
        const pt = (i, j) => proj([P[0] + du[0] * i / N + dv[0] * j / N, P[1] + du[1] * i / N + dv[1] * j / N, P[2] + du[2] * i / N + dv[2] * j / N]);
        const sp = (i, j) => [rx + rw * i / N, ry + rh * j / N];
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const a = pt(i, j), b = pt(i + 1, j), c = pt(i, j + 1), d = pt(i + 1, j + 1);
          tri(ctx, fc.img, [sp(i, j), sp(i + 1, j), sp(i, j + 1)], [a, b, c]);
          tri(ctx, fc.img, [sp(i + 1, j), sp(i + 1, j + 1), sp(i, j + 1)], [b, d, c]);
        }
        // iluminação: escurece as faces que não recebem luz de frente
        const lam = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
        const shade = 0.42 * (1 - lam);
        if (shade > 0.01) {
          const c0 = pt(0, 0), c1 = pt(N, 0), c2 = pt(N, N), c3 = pt(0, N);
          ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.closePath();
          ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
          ctx.fill();
        }
      }
    }

    loop() {
      if (this.dead) return;
      requestAnimationFrame(() => this.loop());
      if (this.target) {
        this.q = qSlerp(this.q, this.target, 0.18);
        const d = Math.abs(this.q[0] * this.target[0] + this.q[1] * this.target[1] + this.q[2] * this.target[2] + this.q[3] * this.target[3]);
        if (d > 0.99999) { this.q = this.target; this.target = null; }
        this.dirty = true;
      }
      if (this.auto) { this.q = qNorm(qMul(qAxis(0, 1, 0, 0.012), this.q)); this.dirty = true; }
      if (!this.dirty) return;
      this.dirty = false;
      this.draw(this.canvas.getContext('2d'), this.canvas.width, this.canvas.height);
    }

    // PNG com fundo transparente em alta resolução (lado maior até 4000 px)
    snapshot() {
      const w = this.host.clientWidth || 700, h = this.host.clientHeight || 450;
      const s = Math.min(4, 4000 / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      this.draw(cv.getContext('2d'), cv.width, cv.height);
      return cv.toDataURL('image/png');
    }

    dispose() { this.dead = true; if (this.ro) this.ro.disconnect(); }
  }

  async function open() {
    const cover = App.cover.ensure();
    App.toast('Montando o livro em 3D…', 20000);
    App.flush();
    const assets = {};
    Object.values(cover.images || {}).forEach(it => { if (it && App.project.assets[it.asset]) assets[it.asset] = App.project.assets[it.asset]; });
    const proof = await window.api.coverProof(JSON.parse(JSON.stringify(cover)), assets, 120);
    document.getElementById('toast').classList.remove('show');
    if (!proof || proof.error) return App.toast('Não foi possível montar a prévia 3D: ' + ((proof && proof.error) || ''), 6000);
    const image = new Image();
    image.src = proof.dataUrl;
    await image.decode();
    proof.image = image;
    const { el } = App;
    const stage = el('div', { class: 'c3d-stage checker' });
    let viewer = null;
    const views = [['3/4', '◩ 3/4'], ['front', 'Frente'], ['back', 'Verso (contracapa)'], ['spine', 'Lombada'], ['edge', 'Lateral (folhas)'], ['top', 'Cima'], ['bottom', 'Baixo']];
    const bar = el('div', { class: 'c3d-bar' }, views.map(([k, l]) => el('button', { class: 'small-btn', text: l, onclick: () => viewer.setView(k) })).concat([
      el('button', { class: 'small-btn', text: '⟳ Girar', onclick: () => { viewer.target = null; viewer.auto = !viewer.auto; } }),
      el('label', { class: 'chk small' }, [el('input', { type: 'checkbox', checked: true, onchange: e => stage.classList.toggle('checker', e.target.checked) }), ' Xadrez (transparência)']),
      el('button', { class: 'primary', text: '⇩ Salvar PNG transparente', onclick: async () => { const f = await window.api.savePng(`${(App.project.meta.title || 'capa').replace(/[\\/:*?"<>|]+/g, '-')}-3d.png`, viewer.snapshot()); if (f) App.toast('Imagem salva: ' + f, 5000); } })
    ]));
    App.modal({
      title: 'Prévia 3D da capa', wide: true,
      body: el('div', { class: 'c3d' }, [bar, stage, el('p', { class: 'muted small', text: 'Arraste para girar em qualquer direção (esquerda, direita, cima, baixo, verso e laterais); use a roda do mouse para aproximar. As cores são a simulação da impressão em CMYK.' })]),
      buttons: [{ label: 'Fechar' }],
      onClose: () => { if (viewer) viewer.dispose(); }
    });
    await new Promise(r => requestAnimationFrame(r));
    viewer = new Viewer(stage, proof);
    window.__cover3d = viewer;
  }

  window.Cover3D = { open };
})();
