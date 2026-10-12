# Diagramador de Livros

Aplicativo para **diagramar livros no computador** e gerar o miolo e a capa prontos para gráfica, impressão sob demanda (Amazon KDP, Clube de Autores, UICLAP…) ou leitura digital (EPUB/PDF).

- **100% local e offline**: o app bloqueia qualquer acesso à rede. Textos, imagens, fontes e configurações ficam só no seu computador.
- Projetos são arquivos **`.livro`** (com imagens embutidas), com salvamento automático de recuperação e cópia de segurança `.bak` a cada salvamento.

## Instalação (Windows 64 bits)

Três opções, todas geradas automaticamente pelo GitHub Actions (aba **Actions → Instalador Windows → última execução → Artifacts**, ou na aba **Releases** quando houver uma tag `v*`):

| Arquivo | Uso |
| --- | --- |
| `Diagramador-de-Livros-Setup-<versão>.exe` | Instalador (atalhos na Área de Trabalho e no Menu Iniciar, associação de arquivos `.livro`). |
| `Diagramador-de-Livros-Portatil-<versão>.exe` | **Portátil, sem instalação**: um único arquivo — basta clicar no ícone. Guarda as configurações e bibliotecas na pasta `DiagramadorDeLivros-dados`, ao lado do `.exe` (funciona em pen drive). |
| `Diagramador-de-Livros-<versão>-x64.zip` | Pasta portátil: descompacte e abra `DiagramadorDeLivros.exe`. Para guardar os dados dentro da pasta, crie nela um arquivo vazio chamado `portable.txt`. |

Como os executáveis não têm assinatura digital, o Windows SmartScreen pode avisar: **Mais informações → Executar assim mesmo**.

## Recursos

### Manuscrito
- Importação de **DOCX, DOC, EPUB, PDF, ODT, TXT, Markdown, HTML e RTF**, inclusive arrastando o arquivo para a janela. Títulos viram capítulos (“Capítulo 3 — Nome” vira “Nome”, numerado automaticamente).
- **Notas de rodapé preservadas** (Word, EPUB, ODT, DOC, Markdown e, por reconstrução, PDF). Painel **Notas de rodapé**: ocultar todas sem apagar, remover todas ou só as escolhidas; no editor, clique numa nota para removê-la ou transformá-la em texto.
- O texto importado é **padronizado** com os estilos do livro (fontes, tamanhos e espaçamentos do manuscrito são trocados pela configuração escolhida).
- **Paginação automática** (Paged.js): o texto que não cabe é empurrado para a página seguinte sem mudar o tamanho da fonte; controle de viúvas/órfãs e de títulos isolados.

### Texto e estilos
- Estilos nomeados e totalmente configuráveis: texto principal, título de capítulo, rótulo, **T1, T2, T3**, citação longa, frase em destaque, **poesia**, epígrafe, **referências**, legenda, nota de rodapé, caixa de destaque, tabela, cabeçalho, número de página e sumário (fonte, tamanho, cor, entrelinha, espaço entre letras/palavras, recuos, espaços antes/depois, alinhamento, itálico, negrito, maiúsculas, versalete).
- **Conjuntos tipográficos** salvos para reutilizar em outros livros; **“Salvar como meu padrão”**: novos livros e o próximo uso do app começam com a sua configuração (só muda quando você salva de novo).
- **Configurações prontas por gênero**: romance, poesia, terror, suspense/policial, fantasia, ficção científica, contos, infantojuvenil, autoajuda, biografia, religioso e acadêmico.
- Editor com tabelas, **gráficos** (colunas, linhas, pizza — editáveis), listas, caixas de destaque, quebras de cena e de página, versalete, caracteres invisíveis.

### Capítulos e páginas
- Seleção múltipla para **editar vários capítulos de uma vez** (cor da página, cor/fonte/tamanho do texto e dos títulos, separador, numeração, bloqueio) ou um capítulo isolado (botão **Aparência**).
- **Bloqueio** de capítulos contra edição, movimentação e exclusão acidentais.
- **Desfazer/refazer** e **Histórico** de todas as operações do projeto, com recuperação de estados anteriores; operações em massa mostram a lista do que vai mudar antes de aplicar.

### Imagens
- **Biblioteca do aplicativo** com ilustrações em PNG para o corpo do texto e, em local separado, **separadores exclusivos para os títulos** (o padrão continua sendo o filete liso).
- **Biblioteca pessoal** (corpo e separadores) com busca, palavras-chave, coleções, favoritos, filtros (orientação, transparência, resolução), detecção de duplicatas e indicação de uso.
- **Arrastar e soltar** do Windows Explorer ou da biblioteca para o texto (com indicador de posição e de operação inválida), para um capítulo da lista ou para uma página da prévia.
- Painel da imagem: largura (+/−), alinhamento, **texto ao redor** (acima e abaixo, quadrado, contorno da área transparente, só à esquerda, só à direita, atrás do texto), distância do texto, proporção e ajuste (preencher/caber/esticar), **recorte não destrutivo com prévia**, girar, espelhar, opacidade, legenda, substituir (esta ou todas as ocorrências mantendo tamanho/posição/recorte), mover para outro capítulo. As imagens nunca ultrapassam a mancha nem se dividem entre páginas; legenda fica junto da imagem.
- **Imagem de página inteira (sangrada)** em qualquer ponto do texto e como abertura de capítulo.
- **Imagens do projeto**: resolução efetiva (dpi), transparência, perfil ICC, imagens CMYK, onde cada uma é usada, referências quebradas (com “localizar arquivo”), unificar duplicatas e remover não usadas.

### Camadas da página (composição livre)
- Elementos fixos em posição exata (mm, cm, pol. ou pt): imagens, retângulos, elipses, filetes, molduras, **fundos de página** (cor/imagem de uma página isolada), caixas e textos decorativos.
- Arraste na prévia com **encaixe** em bordas, margens, centro, sangria e outros elementos; redimensionar; setas para ajuste fino.
- Painel de camadas: renomear, ocultar, bloquear, agrupar/desagrupar, duplicar, ordem (frente/trás), **alinhar e distribuir**, mesmo tamanho; **composições em grade/mosaico** com legendas alinhadas.

### Páginas iniciais e finais
- Falsa folha de rosto, **página de rosto** (título, autor e **logotipo da editora**), dedicatória, epígrafe e **sumário automático** com números de página.
- **Créditos e ficha catalográfica (CIP)**: todos os campos (entrada, título, subtítulo, autor, tradução, ilustração, edição, cidade, editora, ano, páginas automáticas, dimensões, série, ISBN, assuntos, CDD, CDU, Cutter, notas, bibliotecário/CRB), créditos de toda a equipe, direitos, contato, **imagens e QR codes** — ou ficha manual.
- **Biografia do autor** (com foto) e **conteúdo extra** no fim do livro (opcionais).

### Formato
- 14 × 21 cm por padrão e todos os formatos pedidos: pequenos (miniatura a 13 × 20), médios (13,8 × 21 a 17 × 24), grandes (18 × 24 a A3), quadrados, paisagem, lista do **Amazon KDP**, e qualquer medida personalizada (com decimais e conversão de unidades).
- **Margens espelhadas** automáticas, sangria por borda, área de segurança, marcas de corte; guias de corte, sangria, área segura e margens na prévia; prévia em tons de cinza; visualização individual, dupla ou geral.

### Capa e lombada
- Recebe automaticamente as dimensões e o número de páginas do miolo; botão **Confirmar as dimensões** (avisa se o miolo mudar depois).
- **Lombada calculada** pelo papel (offset, pólen, couchê, KDP ou espessura personalizada), capa dura, orelhas, sangria própria da capa.
- Imagens de capa, contracapa, lombada, orelhas ou envolvente; textos (título, autor, lombada, sinopse, orelhas); área do código de barras; prévia em tempo real com guias de dobra.
- Exportação em **PDF, PNG, JPG ou TIFF, com ou sem sangria**.

### Exportação
- Perfis prontos e editáveis: **gráfica (offset)**, **Amazon KDP**, **impressão sob demanda**, **PDF digital** (com marcadores), **prova editorial em páginas duplas**, **EPUB**, imagens e DOCX; salve os seus perfis.
- Formatos: **PDF** (impressão ou leitura digital, livro inteiro, intervalo de páginas ou capítulos), **PNG, JPEG, TIFF** (resolução configurável), **EPUB 3** (sumário navegável, metadados, imagens, notas), **DOCX, ODT, TXT** e **pacote de produção** (ZIP com miolo, capa, EPUB, relatório e especificações).
- **Verificação de pré-impressão** antes de exportar: páginas, formato, fontes ausentes ou não incorporáveis, imagens com baixa resolução, imagens divididas ou legendas separadas, elementos fora da mancha ou da área imprimível, elementos que terminam na linha de corte, falta de sangria, regras do perfil (tamanhos aceitos, mínimo/máximo de páginas). Classificada em erros, avisos e informativos, com **“Ir para a página”** e correções seguras com confirmação. Relatório técnico em texto.
- **Comparação com a última exportação**: páginas, início de cada capítulo, fontes, imagens e dimensões.

### Fontes
- Gerenciador com galeria e prévia (alfabeto, números, acentos, símbolos, outros idiomas), busca e classificação.
- Usa as fontes instaladas no Windows ou as copia para a **biblioteca do aplicativo** (“instalação virtual”, sem instalar no sistema) — TTF, OTF, TTC, WOFF e WOFF2.
- Reconhece os pesos e estilos reais (não simula negrito/itálico ausentes), lê a **licença de incorporação** (fsType) e avisa quando a fonte não pode ir para o PDF.
- Fontes ausentes ao abrir um livro geram aviso e escolha explícita de substituição, registrada no projeto.

## Limitações conhecidas (honestas)

- O PDF é gerado pelo motor do Chromium: **RGB com fontes incorporadas**. **PDF/X-1a, PDF/X-4 e conversão para CMYK não são produzidos** pelo aplicativo — a verificação avisa e o relatório indica que a conversão deve ser feita pela gráfica ou por software de pré-impressão. A prévia “Cinza” ajuda a avaliar impressão em preto e branco, mas não é prova de cor.
- **PDF como entrada** não guarda a estrutura do texto: parágrafos, títulos e notas são reconstruídos por posição e tamanho das letras e devem ser conferidos; imagens de PDF não são importadas. Arquivos **.doc** antigos não trazem itálico/negrito (prefira `.docx`).
- O contorno de texto pela forma da imagem usa as áreas transparentes (PNG com transparência) e vale para imagens sem recorte/rotação.
- Os perfis de gráficas e plataformas são pontos de partida: confirme sempre as especificações atuais do fornecedor.
- Não há imposição de cadernos (as páginas duplas são só para prova).

## Desenvolvimento

Requisitos: Node.js 20+.

```bash
npm install          # dependências + copia Paged.js e fontes para src/renderer/vendor
npm start            # abre o aplicativo
npm test             # gera um PDF de exemplo pelo mesmo caminho da exportação
npm run dist:win     # instalador, versão portátil (.exe) e ZIP em dist/
npm run dist:portable
```

`npm run dist:win` funciona no Windows e também em Linux/macOS (sem Wine). A biblioteca embutida de imagens é gerada por `npx electron scripts/make-library.js` a partir de `scripts/library-art.js`.

| Caminho | Função |
| --- | --- |
| `src/main.js` | Janela, menus, protocolo local, IPC, renderização/exportação, capa, bloqueio de rede, modo portátil |
| `src/main/importers.js` | Leitura de DOCX, DOC, EPUB, ODT, PDF, TXT, MD, HTML, RTF |
| `src/main/exporters.js` | EPUB 3, DOCX, ODT, TXT, TIFF e pacote ZIP |
| `src/main/fonts.js` | Varredura e leitura de fontes (nome, peso, estilo, fsType) e biblioteca de fontes |
| `src/main/library.js` | Bibliotecas de imagens e análise técnica (dimensões, transparência, ICC, CMYK) |
| `src/book.js` | Projeto → HTML/CSS paginado (estilos, figuras, notas, ficha, páginas especiais) |
| `src/shared/defaults.js` | Formatos, estilos, configurações padrão e por gênero, migração de projetos |
| `src/renderer/` | Interface (editor, painéis, bibliotecas, camadas, capa, exportação, prévia) |
| `assets/library/` | Biblioteca embutida (ilustrações e separadores em PNG) |

## Licenças de terceiros

Electron (MIT), Paged.js (MIT), pdf.js (Apache-2.0), Mammoth (BSD-2), word-extractor (MIT), JSZip (MIT/GPLv3), docx (MIT), qrcode (MIT), Hyphen (ISC); fontes embutidas sob SIL Open Font License. As ilustrações da biblioteca embutida foram desenhadas para este projeto.
