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
- O texto importado é **padronizado** com os estilos do livro (fontes, tamanhos, espaçamentos, títulos e subtítulos do manuscrito são trocados pela configuração escolhida). Na importação dá para escolher o **gênero do livro** e remover o sumário que já vinha no manuscrito (o livro gera o seu, com as páginas certas).
- Todo o texto é **justificado** (exceto poesia, alinhada à esquerda); o botão **Gênero do livro**, na barra superior, aplica fontes, títulos e alinhamento de uma vez.
- **Sem páginas em branco**: cada capítulo começa na página seguinte (nunca em uma página vazia), e rosto, ficha, sumário, dedicatória, epígrafe e páginas finais não recebem número de página.
- **Paginação automática** (Paged.js 0.5, com correção própria para parágrafos longos com frases repetidas; verificada palavra a palavra — nenhum trecho é duplicado ou ocultado): o texto que não cabe é empurrado para a página seguinte sem mudar o tamanho da fonte; controle de viúvas/órfãs e de títulos isolados.
- No editor: **notas de rodapé** no cursor (¹ Nota), **ligações** (🔗, Ctrl+K) para outro capítulo ou título — com o número da página de destino (“p. 41”) preenchido após a paginação — ou para sites/e-mails, **＋ Seção** (nova página com título logo depois do capítulo atual, também pelo ＋ na lista) e **✂ Dividir** (o texto a partir do cursor vira um novo capítulo, sem alterar o resto).

### Texto e estilos
- Estilos nomeados e totalmente configuráveis: texto principal, título de capítulo, rótulo, **T1, T2, T3**, citação longa, frase em destaque, **poesia**, epígrafe, **referências**, legenda, nota de rodapé, caixa de destaque, tabela, cabeçalho, número de página e sumário (fonte, tamanho, cor, entrelinha, espaço entre letras/palavras, recuos, espaços antes/depois, alinhamento, itálico, negrito, maiúsculas, versalete).
- **Conjuntos tipográficos** salvos para reutilizar em outros livros; **“Salvar como meu padrão”**: novos livros e o próximo uso do app começam com a sua configuração (só muda quando você salva de novo).
- **Biblioteca de estilos** com amostra visual e aplicação em todo o livro com um clique: romance, poesia, terror, suspense/policial, fantasia, ficção científica, contos, infantojuvenil, autoajuda, biografia, religioso, acadêmico, não-ficção, ciências humanas, história, filosofia, jornalismo e culinária.
- Editor com tabelas, **gráficos** (colunas, linhas, pizza — editáveis), listas, caixas de destaque, quebras de cena e de página, versalete, caracteres invisíveis.

### Capítulos e páginas
- Seleção múltipla para **editar vários capítulos de uma vez** (cor da página, cor/fonte/tamanho do texto e dos títulos, separador, numeração, bloqueio) ou um capítulo isolado (botão **Aparência**).
- **Bloqueio** de capítulos contra edição, movimentação e exclusão acidentais.
- **Excluir capítulos** direto no navegador lateral (tecla Delete ou 🗑), ou apagando o título e pressionando Backspace; apagar trechos/páginas de texto funciona como em qualquer editor (selecionar e apagar). Botão **¹✕ Notas** remove todas as notas de rodapé de uma vez.
- **Desfazer/refazer** e **Histórico** de todas as operações do projeto, com recuperação de estados anteriores; operações em massa mostram a lista do que vai mudar antes de aplicar.

### Imagens
- **Biblioteca do aplicativo** com ilustrações em PNG para o corpo do texto e, em local separado, **separadores exclusivos para os títulos** (o padrão continua sendo o filete liso).
- **Biblioteca pessoal** (corpo e separadores) com busca, palavras-chave, coleções, favoritos, filtros (orientação, transparência, resolução), detecção de duplicatas e indicação de uso.
- **Arrastar e soltar** do Windows Explorer ou da biblioteca para qualquer ponto do livro — no editor ou direto sobre o texto de uma página da prévia: em cima, embaixo, à esquerda e à direita (texto ao redor, imagem limitada a 50% da largura para não criar linhas desproporcionais) ou no centro; o texto se reorganiza e a paginação é refeita. Soltar na margem/área vazia de uma página cria um elemento fixo.
- Área **“Enviar imagens do computador”** sempre visível na biblioteca (clique ou solte arquivos).
- Painel da imagem: largura (+/−), alinhamento, **texto ao redor** (acima e abaixo, quadrado, contorno da área transparente, só à esquerda, só à direita, atrás do texto), distância do texto, proporção e ajuste (preencher/caber/esticar), **recorte não destrutivo com prévia**, girar, espelhar, opacidade, legenda, substituir (esta ou todas as ocorrências mantendo tamanho/posição/recorte), mover para outro capítulo. As imagens nunca ultrapassam a mancha nem se dividem entre páginas; legenda fica junto da imagem.
- **Imagem de página inteira (sangrada)** em qualquer ponto do texto e como abertura de capítulo.
- **Imagens do projeto**: resolução efetiva (dpi), transparência, perfil ICC, imagens CMYK, onde cada uma é usada, referências quebradas (com “localizar arquivo”), unificar duplicatas e remover não usadas.

### Camadas da página (composição livre)
- Elementos fixos em posição exata (mm, cm, pol. ou pt): imagens, retângulos, elipses, filetes, molduras, **fundos de página** (cor/imagem de uma página isolada), caixas e textos decorativos.
- Arraste na prévia com **encaixe** em bordas, margens, centro, sangria e outros elementos; redimensionar; setas para ajuste fino.
- Painel de camadas: renomear, ocultar, bloquear, agrupar/desagrupar, duplicar, ordem (frente/trás), **alinhar e distribuir**, mesmo tamanho; **composições em grade/mosaico** com legendas alinhadas.

### Páginas iniciais e finais
- Ordem padrão: **página de rosto › ficha catalográfica › sumário › capítulos › páginas finais** (falsa folha de rosto, dedicatória e epígrafe opcionais).
- **Sumário automático** a partir dos títulos (só capítulos, + T1, + T2) ou **manual**: “Gerar a partir dos títulos” cria uma lista editável (rótulo, título, nível, ordem, destino); os números de página são preenchidos sozinhos.
- **Ficha pronta colada** (módulo à parte na tela da ficha): o texto colado é reorganizado com a mesma aparência do modelo selecionado (cabeçalho, número de chamada, entrada, recuos, assuntos, CDD e bibliotecário), com opção de manter exatamente como colado.
- **Créditos e ficha catalográfica (CIP)**: todos os campos (entrada, título, subtítulo, autor, tradução, ilustração, edição, cidade, editora, ano, páginas automáticas, dimensões, série, ISBN, assuntos, CDD, CDU, Cutter, notas, bibliotecário/CRB), créditos de toda a equipe, direitos, contato, **imagens e QR codes** — ou ficha manual.
- **Galeria de modelos de ficha** (romance, poesia, contos, crônicas, terror, fantasia, infantojuvenil, ficção traduzida, autoajuda, biografia, religioso, acadêmico, compacta…) com aparências diferentes (caixa, sem borda, borda dupla, cantos arredondados, padrão CBL), e os seus próprios modelos.
- **Ficha fixa**: salve a ficha (créditos, editora, direitos, bibliotecário, logotipo) e todo livro novo já começa com ela preenchida.
- **Biografia do autor** (com foto) e **conteúdo extra** no fim do livro (opcionais).

### Modelo CEDET (padrão do sistema)
Todo livro novo nasce no padrão do **Manual de Preparação de Arquivos do Cedet** (Editoras Parceiras, v. outubro/2026):
- **Formatos**: 15,5 × 23 (padrão), 13,7 × 21 e 11,5 × 17,5 cm.
- **Miolo**: margem de segurança de 20 mm nos quatro lados (margens 28/28 mm, interna 23 mm, externa 20 mm; número da página logo abaixo do texto, dentro dos 20 mm), sangria de 5 mm, **marcas de corte de 0,25 pt a 5 mm do corte em todas as páginas**, numeração no canto inferior externo ou no centro (nunca no topo nem no lado interno; ímpares sempre à direita), páginas individuais.
- **Perfil de exportação “CEDET — miolo”**: preto e branco só com tinta preta, **sGray sem perfis incorporados**, conferência automática das separações (“desligando o preto, nada aparece”) e nome `ISBN_MIOLO_NOME DO LIVRO.pdf`.
- **Ficha**: crédito de distribuição do Cedet incluído automaticamente logo abaixo da ficha catalográfica (editável).
- **Pré-impressão CEDET**: formato, margens de segurança, cabeçalho/número dentro da área segura, ISBN válido, crédito na ficha, páginas coloridas.
- **Capa CEDET**: **sempre sem orelhas** (capa e contracapa no mesmo formato do miolo); sangria de 5 mm; **marcas de corte e de dobra** (0,25 pt, 5 mm) em capa, contracapa e lombada, opcionais e ligadas por padrão; imagens de capa, lombada e contracapa enviadas separadas, na ordem da capa aberta, preenchendo tudo sem faixas brancas; linhas de sangria e corte na prévia (opcionais); critério de **página chapada** detectado no miolo (gráfica externa/Pólen Bold 70 g × gráfica interna/Avena 80 g); lombada **digitada da calculadora do Cedet** (a estimativa é só referência); perfil **U.S. Web Coated (SWOP) v2** carregável (arquivo .icc); nome `ISBN_CAPA_NOME DO LIVRO.pdf`.
- **Código de barras do ISBN (EAN-13)** na contracapa (opcional — basta digitar o número do ISBN): validação do ISBN (o ISBN-10 é convertido), **vetorial, preto 100% K**, mínimo 31 × 19 mm, quadro branco com 2,5 mm livres ao redor, posição (inferior direito/centro/esquerdo) e distâncias ajustáveis; download em **EPS** (preferido pelo manual), PDF ou SVG.
- “Usar layout livre” desliga as regras do Cedet num livro; KDP, revista e jornal usam layout livre.

### Padrões por modelo e restauração
- **Sangria sempre no arquivo de impressão**: miolo e capa saem com a sangria do modelo mesmo sem as linhas de corte; as linhas (marcas) são opcionais, e as guias da prévia são só para a tela.
- **Padrão de cada modelo**: CEDET → manual Cedet (5 mm, segurança de 20 mm, marcas 0,25 pt); Amazon KDP → especificação da Amazon (0,125 pol. e margens mínimas pelo número de páginas); demais formatos → padrão do sistema (3 mm; 5 mm em formatos grandes).
- **Medidas editáveis em qualquer modelo de formato**: altere largura e altura, salve no modelo e volte às medidas originais do sistema com um clique.
- **Restaurar padrões** (menu Sistema): devolve ao original do sistema o livro aberto (formato, estilos, opções, cores, capa — com desfazer) e as personalizações do sistema (meu padrão, formatos editados, perfis de exportação, ficha fixa, modelos de ficha, conjuntos tipográficos, favoritos, preferências da tela), além de remover imagens e fontes adicionadas, se desejado. Perfis de exportação alterados têm “Restaurar as opções originais do perfil”.

### Elementos: tabelas, planilhas, gráficos e extras
- **Gaveta Elementos** (botão no topo): tabela, planilha (importar **XLSX, ODS, CSV**), colar planilha do Excel/LibreOffice/Google, gráfico, caixa de destaque, citação, frase, poema, epígrafe, quebras, **QR code** e página de imagem. **Arraste** para o texto do editor ou para uma página da prévia (o elemento entra no fluxo naquele ponto e o texto se reorganiza) ou clique para inserir no cursor.
- **Tabelas**: grade editável (colar várias células expande a grade), título, fonte (“Fonte: …”), linhas alternadas, números à direita; movem-se no editor pela alça “⠿ mover”.
- **Gráficos** com várias séries: colunas, colunas empilhadas, barras horizontais, linhas, área, pizza e rosca; tons de cinza com tracejado para P&B (padrão no CEDET); números no padrão brasileiro.
- **Numeração automática** (Tabela 1, Gráfico 1, Figura 1) e **listas de tabelas, gráficos e figuras** com número de página, logo depois do sumário; a mesma numeração no EPUB.

### Notas de rodapé
- A nota fica **inteira na página da chamada**: se não couber, o texto desce para a página seguinte (padrão editorial). Só notas maiores que a página inteira continuam na seguinte. A paginação é conferida palavra por palavra (nada some).

### Livro digital (EPUB e MOBI)
- Ao exportar, o app **pede a imagem da capa** (ou usa a frente do módulo Capa): ela abre o livro em página inteira e é a capa na Amazon, na biblioteca do Kindle e nos aplicativos de leitura.
- **EPUB 3** validado pelo epubcheck, com todos os metadados (ISBN, título e subtítulo, autor, colaboradores com seus papéis, editora, data, idioma, descrição, assuntos, direitos, série, edição, acessibilidade), sumário, guia e NCX. É o formato que a Amazon KDP recebe.
- **MOBI** para Kindle gerado pelo próprio app (capa, metadados, sumário com links e imagens).

### Formato
- Modelo CEDET por padrão e todos os formatos pedidos: pequenos (miniatura a 13 × 20), médios (13,8 × 21 a 17 × 24), grandes (18 × 24 a A3), quadrados, paisagem, lista do **Amazon KDP**, e qualquer medida personalizada (com decimais e conversão de unidades).
- **Prévia**: sempre abre em 1 página por vez (rolando o livro na vertical) — outros modos só quando você escolhe: páginas duplas, ou 2, 3, 4 e 5 páginas lado a lado, com ajuste automático do zoom. No modo 1 página, ao lado de cada página: **cor da página** e **cor do texto** (grade de cores, código hexadecimal ou seletor; o app pergunta se vale só para a página ou para o capítulo), **cadeado** contra alterações acidentais e **inserir página de imagem sangrada** antes/depois de um capítulo (com guias de sangria opcionais para conferência).
- **Margens espelhadas** automáticas, **sangria automática pelo formato** (3 mm; 5 mm em formatos grandes; 0,125 pol. no KDP) ou digitada, área de segurança, marcas de corte; guias de corte, sangria, área segura e margens na prévia; prévia em tons de cinza; visualização individual, dupla ou geral.

### Amazon KDP
- **Brochura** (16 tamanhos: 5 × 8 a A4, incluindo 8,25 × 6 horizontal e quadrados) e **capa dura** (5,5 × 8,5, 6 × 9, 6,14 × 9,21, 7 × 10 e 8,25 × 11; de 75 a 550 páginas).
- Confere o número de páginas pelo papel/tinta, calcula a **margem interna mínima pelo número de páginas**, margens externas, sangria de 0,125 pol. (no miolo, só nas bordas externas, como o KDP exige), lombada e se é permitido texto na lombada; **aplica ao livro** e **envia as medidas para a capa**.

### Módulos opcionais
O layout padrão é o de **livro**. Em **Outros módulos** (barra lateral) ficam Poesia, Revista e jornal e Amazon KDP; todas as ferramentas do livro funcionam também neles.

### Poesia
- Estilo de poesia (versos à esquerda, sem hifenização, estrofes que não se partem) e conversão de capítulos em poemas, preservando os versos.

### Revista e jornal
- Em **Novo**, escolha Livro, **Revista** ou **Jornal**. Colunas fixas (**2 ou 3**), espaço e fio entre colunas, nome da publicação com logotipo, edição e data (também no cabeçalho), e por matéria: **chapéu**, **linha fina**, **assinatura**, colunas próprias e “começa em página nova” ou continua na mesma página.

### Capa e lombada
- **Prévia 3D**: o livro montado (capa, lombada, contracapa e folhas), girando para todos os lados — frente, verso, lombada, lateral das folhas, cima e baixo — e **salvando em PNG com fundo transparente** em alta resolução.
- As imagens sempre **preenchem o espaço sem bordas brancas** (recorte centralizado ou esticar), são redimensionadas com a melhor qualidade para a resolução exata de saída, recebem **correção automática de cor** (níveis, sem mudar o matiz) e **nitidez**, e os painéis são encaixados em pixels inteiros (sem frestas entre capa, lombada e contracapa).
- Para **montar capas prontas** (já editadas em outro programa): imagem envolvente ou capa, lombada, contracapa e orelhas separadas; cor de fundo; **área do código de barras opcional**; prévia em tempo real com guias de corte, dobra e área segura.
- Medidas: **largura total, altura total e lombada (mm)** editáveis, com o **tamanho total exibido** (com e sem sangria). Preenchidas automaticamente pelo livro em diagramação (em tempo real) ou por um **manuscrito carregado** (PDF, DOC, DOCX, ODT, HTML, EPUB ou MOBI) — ou digitadas, sem precisar de livro. Botão **Confirmar as dimensões**.
- **Lombada calculada** pelo papel (offset, pólen, couchê, KDP ou espessura personalizada), capa dura, orelhas; **sangria automática** (3 mm; 0,125 pol. no KDP) ou manual.
- Saída sempre para gráfica: **PDF CMYK no padrão PDF/X-1a** — conversão de cor com LittleCMS e perfil ICC real (**ISO Coated v2 / FOGRA39** ou **GRACoL 2013**), intenção colorimétrica relativa com compensação de ponto preto (ou perceptual), imagens CMYK preservadas, OutputIntent, TrimBox/BleedBox, 300 a 600 dpi, cálculo de tinta máxima e **prova de cor** na tela.

### Exportação
- Perfis prontos e editáveis: **gráfica (offset)**, **Amazon KDP**, **impressão sob demanda**, **PDF digital** (com marcadores), **prova editorial em páginas duplas**, **EPUB**, imagens e DOCX; salve os seus perfis.
- PDF de impressão pronto para gráfica: **todas as fontes incorporadas**, **TrimBox/BleedBox exatas** (formato final e sangria), e **cor do miolo** em RGB, **CMYK com perfil ICC** (texto e cinzas em 100% K, cores pelo perfil, imagens convertidas, OutputIntent) ou **escala de cinza** (miolo preto e branco).
- Formatos: **PDF** (impressão ou leitura digital, livro inteiro, intervalo de páginas ou capítulos), **PNG, JPEG, TIFF** (resolução configurável), **EPUB 3** (sumário navegável, metadados, imagens, notas), **DOCX, ODT, TXT** e **pacote de produção** (ZIP com miolo, capa, EPUB, relatório e especificações).
- **Verificação de pré-impressão** antes de exportar: páginas, formato, fontes ausentes ou não incorporáveis, imagens com baixa resolução, imagens divididas ou legendas separadas, elementos fora da mancha ou da área imprimível, elementos que terminam na linha de corte, falta de sangria, regras do perfil (tamanhos aceitos, mínimo/máximo de páginas). Classificada em erros, avisos e informativos, com **“Ir para a página”** e correções seguras com confirmação. Relatório técnico em texto.
- **Comparação com a última exportação**: páginas, início de cada capítulo, fontes, imagens e dimensões.

### Fontes
- Gerenciador com galeria e prévia (alfabeto, números, acentos, símbolos, outros idiomas), busca e classificação.
- Usa as fontes instaladas no Windows ou as copia para a **biblioteca do aplicativo** (“instalação virtual”, sem instalar no sistema) — TTF, OTF, TTC, WOFF e WOFF2.
- Reconhece os pesos e estilos reais (não simula negrito/itálico ausentes), lê a **licença de incorporação** (fsType) e avisa quando a fonte não pode ir para o PDF.
- Fontes ausentes ao abrir um livro geram aviso e escolha explícita de substituição, registrada no projeto.

## Limitações conhecidas (honestas)

- **Capa**: PDF/X-1a CMYK de verdade (imagem CMYK única em alta resolução, que é como capas prontas são entregues). **Miolo**: o texto continua vetorial e as cores são convertidas para CMYK/cinza com perfil ICC, mas o arquivo não é declarado PDF/X (pode conter transparência de imagens PNG e anotações de link); se a gráfica exigir certificação PDF/X para o miolo, valide no software dela. A prévia “Cinza” não é prova de cor.
- Capa dura do KDP: a lombada e a dobradiça seguem o gabarito do KDP; confira na calculadora de capa da Amazon.
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
| `src/main/cmyk.js` | Capa CMYK: composição, conversão ICC (LittleCMS), PDF/X-1a e prova de cor |
| `src/main/pdfcolor.js` | Conversão de cor do miolo (CMYK com perfil ICC ou escala de cinza 100% K) |
| `src/main/manuscript.js` | Leitura de páginas/formato de manuscritos para calcular a capa |
| `src/shared/cover.js` | Geometria da capa (lombada, sangria, orelhas, capa dura) |
| `assets/icc/` | Perfis ICC (FOGRA39, GRACoL 2013, sRGB) e as licenças deles |
| `src/book.js` | Projeto → HTML/CSS paginado (estilos, figuras, notas, ficha, páginas especiais) |
| `src/shared/defaults.js` | Formatos, estilos, configurações padrão e por gênero, migração de projetos |
| `src/renderer/` | Interface (editor, painéis, bibliotecas, camadas, capa, exportação, prévia) |
| `assets/library/` | Biblioteca embutida (ilustrações e separadores em PNG) |

## Licenças de terceiros

Electron (MIT), Paged.js (MIT), pdf.js (Apache-2.0), Mammoth (BSD-2), word-extractor (MIT), JSZip (MIT/GPLv3), docx (MIT), qrcode (MIT), Hyphen (ISC), pdf-lib (MIT), lcms-wasm / Little CMS (MIT); fontes embutidas sob SIL Open Font License. Algarismos do código de barras: contornos da IBM Plex Sans (SIL OFL 1.1). Perfis ICC redistribuídos sem alteração, com as licenças em `assets/icc/ICC-PROFILE-LICENSES.md` (ISO Coated v2: licença Heidelberg; GRACoL 2013: IDEAlliance; sRGB: HP). As ilustrações da biblioteca embutida foram desenhadas para este projeto.
