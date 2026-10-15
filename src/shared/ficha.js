/*
 * Ficha catalográfica da Casa Vertigem: créditos automáticos (revisão em rodízio e tradução sorteada a
 * cada exportação), dados da empresa, texto de direitos autorais, selos editoriais e as listas de CDD e de
 * assuntos usadas nas janelas de escolha. Carregado via require() no main e via <script> no renderer.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Ficha = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const YEAR = 2026;
  const REVIEWERS = ['Juliana Hasegawa', 'Camila Loreto', 'Isadora S. Vieira', 'Juliana Costa Monteiro', 'Ricardo N. Bragança'];
  const TRANSLATORS = ['Isabela Vieira Machado', 'Isaias Pedroso Santana', 'Camila Borges Vieira', 'Santana Rosa Silveira', 'Matheus da Silva Cunha'];
  const FIXED_CREDITS = [['Diagramação', 'Vitor Zindacta (via Casa Vertigem Hub)'], ['Capa', 'Vitor Zindacta (via Casa Vertigem Hub)']];
  const COMPANY = ['CASA VERTIGEM EDITORA DE LIVROS LTDA', 'CNPJ 13.539.864/0001-28', 'Rua Santa Clara 205/404 – Copacabana, RJ/RJ, CEP: 22041-011'];

  // selos editoriais: o nome entra em “Esta edição é publicada por …” e o logotipo vai para a página de rosto
  const B = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/';
  const SEALS = [
    { id: 'alianca-do-reino', name: 'Aliança do Reino', url: B + 'AVvXsEgFkLeHmb5XR_6NEOck_L5YNsco_fNdN9jDlw3nq3UXCP2P1BP1bG1WIxu7L1qEbZcucrSr0GvmeRZZUy7ZY8RDXRvnr6aK36rUrmA5nHalfVOywXIcvs19X7hXkcwiafxMbti9JCaZiQ9n-TO-DLyl37iGI7qsjhbG04HM02G3I16RQVYQ3U4awAjZkkjH/s320/alianca_do_reino_preto_transparente.png' },
    { id: 'ossario', name: 'Ôssário', url: B + 'AVvXsEgr1euxpOXsPyyW9JYku4dE9c7UvDBhZP7HL5eVLOJzRYxp95c3-xutgjuFUrDMhfUdNQuhPVT764izvUTvb1ieHpI_cLcdJ_CuZQlD7pMSqcqVgk8o0az56wy3e9cwwVIUaO8S5Zco-s8sxLRzLNn-oyOQrSogfLKkOnU_si5SDtkyOMbtGFbJs0E-JzM4/s320/Cr%C3%A2nio%20e%20logotipo%20%C3%94SS%C3%81RIO.png' },
    { id: 'cultura-das-letras', name: 'Cultura das Letras', url: B + 'AVvXsEi8mWV77RBnI57stKmQW8ycJlVrksGWIb-LNmqBUgYlCgBFAxk8vIF1Psb-1tQ2C1JShwm5GaF3Wuw8ZCcj3jk1KnVDCae7b7ZdMBxVI_h5ViWy-eEei3FbWsbO4YdKMv0Tn7CyYyU00xOnXaejWPJsXoGaVZjbJbomVCcofSHYK4w9LID0V2x0yoGrv749/s320/cultura_das_letras_preto_transparente.png' },
    { id: 'obsessiva', name: 'Obsessiva', url: B + 'AVvXsEj35R_BGq4x7eszvYML4X9RuGv8WY6YMegF1RJ2JEssG5aCkJmf67U65B21zHsrZBuTEKz5dDRrdmm8tACAusZFk7UFuayYOsmFzlb8raFVBOe7k8b9vvgXtTMjiMlFZK-fMfdjhyPp-jZnrYSWIDRXnBjLRdGDay5i74lOlEvJd_jojSGr6tlPmDwcGAMq/s320/Emblema%20G%C3%B3tico%20Obsessiva%20Editora.png' },
    { id: 'espaco-capital', name: 'Espaço Capital Editora', url: B + 'AVvXsEghUmGrZtr52roE06s8mJhHI8uLsWESIdNYays3tovhV8r0eISzSgi6ev8SsqmZpI_m_tRpi_oFzvOwE6bKuCzmkCO8FweOcC43G4aycHXRm_WJ9p1W_SV2HCVStmws7T98pAlq1a74_4OpTMyPd3I6GuJodtuMjm4nIryY5Bb4AHGVcY_tM0Xy2RusC3VI/s320/Logo%20arquitet%C3%B4nico%20Espa%C3%A7o%20Capital.png' },
    { id: 'casa-vertigem', name: 'Casa Vertigem', url: B + 'AVvXsEg7yCFyqmYULmyNwcvf5i-nkE5z9XflWIvWlG_yHJOl7GM_N5k-qMDHsAyIjMs-VA6L6G5R1zR1hmi9acCTMMoysbrElR4bPraRfYorN05xrtAteDBrSuz8Sow_ZeLc_dVllWkUGagXYbWfytME3XmTDrEh-8A8gZgL_GFUkN8w61ZSBxUCSCSyB-_KTddM/s320/Logo%20Casa%20Vertigem%20Editora.png' },
    { id: 'saber-central', name: 'Saber Central', url: B + 'AVvXsEhD-s4rRiQK2RoKhKayz8PSORsvMz-Xup_dmUXa0BdhorI68AORf2XWEWzNGC4Qnd8veWinSbyBvP9chMA_LRUk91k2DFygqh3S-fSF34xW8syy6EUlZQsB2waUFM13MsPEQJZUz-72jRbHNgCXmvsTrRSnYJhkyh8beVZKdqOsjrqG7KgH4rEmK7gOo4BK/s320/Logo%20minimalista%20Saber%20Central.png' },
    { id: 'papel-de-brincar', name: 'Papel de Brincar', url: B + 'AVvXsEh2CxHDPL_xAT8Gh1sNp0suVvKjsmP-nctvY1XmW-_pViUWR1YDVcqIbqnLccfN-o2ncmMClrZ3yBHA0iFFGZ_qlpDJbfFaykAWmmwLNL08HYDAtb6B1BsYFwqpTh2bk5uznHyPXYsgPph8GG4W5trOW1snDsE9IX1d_jVbcOCCQccnwzaa_trRFsB2_qQB/s320/Logo%20Papel%20de%20Brincar.png' },
    { id: 'casa-azul', name: 'Casa Azul', url: B + 'AVvXsEj4hAI4UzAzTmDux5BVbw1YSVaUdL14r8DfXx1oQ-I9mICaoUc4VLp1JVKtOwixbaq6h3qegvKY5xQL0ShFhpdXOwoZMSTHwe7rHgD4QHYMtAXcnbNmn62_y9Np9ZuBnH4UOC11qTjjlcfAmsOMPYM5OqnVYaDeRJert5ixEQVPy1jXGjcQDPJn8l7mTYcA/s320/Logotipo%20Casa%20Azul%20Editora.png' },
    { id: 'nebula', name: 'Nébula', url: B + 'AVvXsEjWgE4JHVvQ3VlUc0UqU9R01UDlpgR1PI3avBk7CJwIotQa1MBemFU3pF6NiFEvCPvlnLvwkWMyIou9onJF7Z8n883tpxcYyLQDr9jYjkq5w3V5GBXvqmoc5Vwxv-xpkqX5-eKi1HxH7jCJyLCzj9AdkvPPnN89mNSmQfKyxgPDC0LLmWPQPAoGGfI4fNZl/s320/nebula_logo_preto_transparente.png' },
    { id: 'nova-academia', name: 'Nova Academia', url: B + 'AVvXsEgVoHeNSFRSCCKdxYPq5Fn8_LseoNopNqNLYuNiZf9_6JGBw8gupFPJIbutwJe6UaH75ljDgibIaRnHkU9IfApDQT5wgks8HauvOzg5F-Jf8HB6IsY1pooVL0K-vfDp5ztWmMDd-X2LCQlC5nTJqP4QOjfSyFhe-Pp7-9z3qSngFgaUESYeEf8KMSRl1-NR/s1600/nova_academia_preto_transparente.png' },
    { id: 'cultura-das-letras-edicoes', name: 'Cultura das Letras Edições', url: B + 'AVvXsEhsaQk5eLJ1kAQ9vHB87uHhL06n-6GSChM2ssE5AJc_hmTGz11Ofg5ulSZfzmBszAKMY8zJcxbAFVIJ-PLkd2MNVhzl39st1kQZobBs1RhqmHiBcHIEAST1GZtqqz29jKIPqOGK9XteObVU_Oo2lkuVtwiHtgfYNteK0XUOlipXEQQ0KKOmZ2i5_Jx8KC_G/s320/Selo%20Cultura%20em%20Letras.png' },
    { id: 'prime-classics', name: 'Prime Classics', url: B + 'AVvXsEiRV4DJtKlKq5eIZCSXZ2BZbwHiJCQWw7hB9b3j6-VUjexu_3R2b_rHKXvl5LRl4lFjW2AXHunHoECYq7PKdMqGltG84Bwul9_7FZ99YmC1Mlbu3hnSAEBGkfYh2EhbMSYD7tosz5IdrP_JqdI_OSL4L2yjUdYkgVjZU2oyc2HDefcZP6FJhmlejesvgOpM/s320/Urso%20Cl%C3%A1ssico%20Prime%20Classics.png' }
  ];

  // filetes ornamentais (separadores sob o título do capítulo)
  const RULES = [
    'AVvXsEjpQc40ayMOUnvJMTdLRxsNeYXB0NpHRCSSOZ3P3JTXfzFPLRtT8kRaP8l_mr7afvedyuf0t4fxo_tiMZbgl4gZWoaGBhidN3pvoYTWBa4gj4z8QRQOojtnD3qDv6o5pBrP-6wouk_gHl68lDKQE6YTdtUJzoq9aLLq0kn1ZoQ718DCVd0TfcOmSbZU4nl_/s1600/Screenshot_10-Photoroom.png',
    'AVvXsEjMjBMHgXUOm-_pggjQeuSQB8o9x-r4YsU4wngvnFOrgsAnvUx0EoARs3P-8t3elIbX46KOpTbnSBYPh1vAjN97z0i3MJTZ7tD3Mdj9EvVdVbtKb7UqmMm6N93fXI9hrQywgHiLVe-jTULKiFNeI7Is9-8C99MH5JgOcoJ9NikpuQezvnLAGvQE6GHtU1AA/s1600/Screenshot_9-Photoroom.png',
    'AVvXsEhCYBJXYHtxpdEwwTGYJqOOewyaTfDwxpcE9Ld9Dt4Wq0QE7BtGqwmqXNlZ51glk6K-pTfghlvjXgR89bIbsyP18smY0yP-ZpcmNCpyW-gMOnVAigMtLlWRwkyNflqQzVv-vSwdvJmWgJMg_U64seGdq_MhNKS8vstI6-0-hqZCw35XK0Bx64k-hqj06aVg/s1600/Screenshot_8-Photoroom.png',
    'AVvXsEhIZBq8bnvnCXlkUv7E8_tBGkjpK6Iapu_3YWFhgqNjcQPrVYwjUwhVYopGiDu-ssVQ8rzMncy2aV0WWXvZY1JKk54GOTl7zMfGowN9UEF3Cyhw4z9pDRTuY9OT4XkuNnlAPg5-voi_nxA6z3el7PzTr2FXxc_tXmrFGuGl0OtK6CIcXdKvhiGJotYS1Lim/s1600/Screenshot_7-Photoroom.png',
    'AVvXsEgNPwBaGMdSAnFPsnPpCsl-Zu3UUHaDhdVeAHOTaZkxGQqrA9W8daVCVdZDJIOfoofkgfSgQ2_bPp4Af2oydD4CWgh-v_2oSiAoEydeQGiEEluupLHEhC-9Euihkoep-ZGLQtdgEpcy__YlsJ9VShUiamIKiuXCBorTUJ_s0OSE4VtmpYMb3QwcQrPvwGHx/s1600/Screenshot_6-Photoroom.png',
    'AVvXsEjfoxNUFejKP6r_L8UkfHBv35m8VmI0vSd4yXSCaZ3sHlI2vy5bZo-PgfkDEIfzB2Cp9Z6gZFAPMa8YQeU9Ujv6QNdGZlUadoF8pNv7QVlrIbyZNHT4lSXFyU47bcYEo8vaHiQCynSUZV3tvcjSDVTSFvZk0RKEMsUQUWHoIljZD4PcbKCgGuLJn-pjlKJk/s1600/Screenshot_5-Photoroom.png',
    'AVvXsEj9AlBWT3s02Xm6SRGTEpLK15ne4nd04R3OEttxAfro3GuDmU3tfiWrgXfFmoIoOT_piDGS8Indkis5z6QWTiQ7EGpjRRot_7PAmAqrxy0ltvhQ37wbGfxOLN8AC4uRUqBcrYHACp8RUiKVqav0fO2QC11TI6Kultn6VHqjG4ZA1f6dwpRux5TivNT9MlnA/s1600/Screenshot_4-Photoroom.png',
    'AVvXsEiG6d-SYMtt5nydgpCOb-saLs-ZIk2kvacm3F8tmYo4CVt9VefpXCrUqPmf3CyrE00AzeNTDdYNdtGRZsQxqKNboc27qpx9FEl-0RdbQnCGtj_w2bAkIs_2Fj_9I4pOeCrw6TmqwlfNYKvwyWtm7waNN7N1kkzs9a6ySRhEw2ZUhHm_1isw5Gbxbt31XASN/s1600/Screenshot_3-Photoroom.png',
    'AVvXsEgENzVMgopsHE8zkGa2CRMtgVOoWG4bSKMTct1dLAFQJV2ayW5IgQq-F_WAlF0A0bn_hP7dg_66jor_FULJCTNADIFuetKi6kgte887lSTQtOh8HW1bcNcFQfi680oYe-r-x87MenbGhEqk6C_MN8zumXHf9VC17o-6e_NRBTL2h8SJAH6NcP4du2hbKmdv/s1600/Screenshot_2-Photoroom.png',
    'AVvXsEifU8X9Lm_D-9qbxaSuGizEWptxpSHevIb9MGbw5fh0tQvEjq6SIo4ElOZLitvmV84E55za5dEGMVjSZ2IidkcRlYnqwWKH2mJV21jRen0Xo6jf5SywWwtUaTCEL-J_RErIbtuLx3Xz8IY9NVBktKbOvcCYQa9kRB9RNYzT1ByGWe7dTxQuj0xu7gdgMSZG/s1600/Screenshot_1-Photoroom.png',
    'AVvXsEg5cQ6r2f2DKaJWwP5f6nvaH79qFt8gi2QGuEhmJLhd48EUPaPt7_rUoHLGH5ap3AHytQR8Mf7-G6s7W0SVDKAtbFlz1IVDQWz86JRIqvRcjKnQFs_KA_b84kFF3QkGgvj8l0vt1RY_J6REpsVVEYBAwYe7qP8AzAyAiJuV6812Utfq7Mslfqcxn1FPbiXh/s1600/fhgf-Photoroom.png',
    'AVvXsEgkAG1_C4OKUg-ey_Ex10560c4MTrUkyj6u_zHOX8QCy7bBST7TI_Ve-tRrMAlevwmNLD5FXdxliaSyiOcFvq4BuGYbuct5j9TaAsrAeVo8yOISCbDKZkauBackmCjjwTp1TfJDP1qrYhgBIVszZfp-seyRP_wDmgF8OpZG63KFj710InMdlLQd3fa6jF2Z/s1600/Screenshot_11-Photoroom.png'
  ].map((p, i) => ({ id: `cv-filete-${String(i + 1).padStart(2, '0')}`, name: `Filete Casa Vertigem ${i + 1}`, url: B + p }));

  // CDD: classificação decimal de Dewey (código sugerido; a ficha oficial deve ser conferida por bibliotecário)
  const CDD = [
    { code: '800', label: 'Literatura geral' },
    { code: '808.83', label: 'Literatura contemporânea (ficção, coletâneas)' },
    { code: 'B869.3', label: 'Literatura brasileira — ficção' },
    { code: '813', label: 'Literatura americana — ficção' },
    { code: '823', label: 'Literatura britânica — ficção' },
    { code: '823', label: 'Literatura inglesa — ficção' },
    { code: '843', label: 'Literatura francesa — ficção' },
    { code: '833', label: 'Literatura alemã — ficção' },
    { code: '891.73', label: 'Literatura russa — ficção' },
    { code: '895.63', label: 'Literatura japonesa — ficção' },
    { code: '853', label: 'Literatura italiana — ficção' },
    { code: '863', label: 'Literatura espanhola — ficção' },
    { code: '869.3', label: 'Literatura portuguesa — ficção' },
    { code: 'B869.1', label: 'Poesia brasileira' },
    { code: '080', label: 'Não ficção (obras gerais)' },
    { code: '001.4', label: 'Acadêmicos (pesquisa e metodologia)' },
    { code: '158.1', label: 'Autoajuda e desenvolvimento pessoal' },
    { code: '900', label: 'História' },
    { code: '100', label: 'Filosofia' },
    { code: '641.5', label: 'Receitas (culinária)' },
    { code: '920', label: 'Biografias' },
    { code: '028.5', label: 'Literatura infantojuvenil' },
    { code: '200', label: 'Religião' },
    { code: '150', label: 'Psicologia' }
  ];
  const SUBJECTS = [
    'Terror', 'Suspense', 'Romance', 'Literatura brasileira', 'Literatura contemporânea', 'Literatura universal',
    'Ficção', 'Ficção brasileira', 'Ficção estrangeira', 'Literatura clássica', 'Romance histórico', 'Romance gótico',
    'Fantasia', 'Ficção científica', 'Policial', 'Mistério', 'Thriller', 'Drama', 'Aventura', 'Contos', 'Crônicas',
    'Poesia', 'Literatura infantojuvenil', 'Literatura americana', 'Literatura inglesa', 'Literatura francesa',
    'Literatura russa', 'Literatura japonesa', 'Literatura alemã', 'Biografia', 'Memórias', 'Ensaios',
    'Não ficção', 'Autoajuda', 'Desenvolvimento pessoal', 'Espiritualidade', 'Religião', 'Filosofia', 'História',
    'Psicologia', 'Educação', 'Culinária', 'Receitas'
  ];

  // nomes do rodízio: n = número da exportação (revisão alterna em ordem), t = sorteio da tradução
  function names(state) {
    const s = state || {};
    const r = ((Number(s.n) || 0) % REVIEWERS.length + REVIEWERS.length) % REVIEWERS.length;
    const t = ((Number(s.t) || 0) % TRANSLATORS.length + TRANSLATORS.length) % TRANSLATORS.length;
    return { review: REVIEWERS[r], translation: TRANSLATORS[t] };
  }
  // créditos da ficha: os nomes digitados pelo usuário valem; o resto vem do padrão da Casa Vertigem
  function credits(catalog, auto) {
    const c = catalog || {};
    const typed = (c.credits || []).filter(x => x && x.role && x.name && x.name.trim()).map(x => ({ role: x.role, name: x.name.trim() }));
    if (c.autoCredits === false) return typed;
    const has = role => typed.some(x => x.role.toLowerCase() === role.toLowerCase());
    const out = typed.slice();
    const a = auto || names();
    const add = (role, name) => { if (!has(role) && name) out.push({ role, name }); };
    add('Revisão', a.review);
    if (c.autoTranslation !== false) add('Tradução', c.translator || a.translation);
    FIXED_CREDITS.forEach(([role, name]) => add(role, name));
    const order = ['Edição', 'Tradução', 'Revisão', 'Diagramação', 'Capa'];
    const rank = x => { const i = order.indexOf(x.role); return i < 0 ? 99 : i; };
    return out.sort((x, y) => rank(x) - rank(y));
  }
  function sealName(meta) {
    const m = meta || {};
    const s = SEALS.find(x => x.id === m.seal);
    return s ? s.name : (m.publisher || 'Casa Vertigem');
  }
  function rights(meta) {
    const m = meta || {};
    return [
      `© ${YEAR} ${m.author || ''}.`.replace(' .', '.'),
      'Todos os direitos reservados. É proibida a reprodução, distribuição ou utilização desta obra, no todo ou em parte, por quaisquer meios ou processos, sem autorização prévia e expressa dos respectivos titulares dos direitos autorais, ressalvadas as hipóteses permitidas pela legislação vigente.',
      'Os direitos relativos à tradução, adaptação, organização, revisão, projeto gráfico, diagramação, ilustrações e demais elementos editoriais originais pertencem aos seus respectivos titulares, conforme os créditos indicados nesta edição.',
      `Esta edição é publicada por ${sealName(m)}.`
    ].join('\n\n');
  }
  // texto de direitos antigo (padrão até a versão 4.15): é trocado pelo novo
  const OLD_RIGHTS = /Nenhuma parte desta obra pode ser reproduzida sem autoriza[çc][ãa]o pr[ée]via, exceto em cita[çc][õo]es breves/i;
  function rightsFor(catalog, meta) {
    const r = String((catalog && catalog.rights) || '').trim();
    return r && !OLD_RIGHTS.test(r) ? r : rights(meta);
  }

  return { YEAR, REVIEWERS, TRANSLATORS, FIXED_CREDITS, COMPANY, SEALS, RULES, CDD, SUBJECTS, names, credits, sealName, rights, rightsFor };
});
