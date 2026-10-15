# Casa Vertigem Hub

Aplicativo para **diagramar livros no computador** (antes chamado Diagramador de Livros) e gerar o miolo e a capa prontos para gráfica, impressão sob demanda (Amazon KDP, Clube de Autores, UICLAP…) ou leitura digital (EPUB/PDF).

- **100% local e offline**: o app bloqueia qualquer acesso à rede. Textos, imagens, fontes e configurações ficam só no seu computador.
- Projetos são arquivos **`.livro`** (com imagens embutidas), com salvamento automático de recuperação e cópia de segurança `.bak` a cada salvamento.

## Instalação (Windows 64 bits)

Três opções, todas geradas automaticamente pelo GitHub Actions (aba **Actions → Instalador Windows → última execução → Artifacts**, ou na aba **Releases** quando houver uma tag `v*`):

| Arquivo | Uso |
| --- | --- |
| `Casa-Vertigem-Hub-Setup-<versão>.exe` | Instalador (atalhos na Área de Trabalho e no Menu Iniciar, associação de arquivos `.livro`). |
| `Casa-Vertigem-Hub-Portatil-<versão>.exe` | **Portátil, sem instalação**: um único arquivo — basta clicar no ícone. Guarda as configurações e bibliotecas na pasta `CasaVertigemHub-dados`, ao lado do `.exe` (funciona em pen drive; uma pasta `DiagramadorDeLivros-dados` de versões anteriores continua sendo usada). |
| `Casa-Vertigem-Hub-<versão>-x64.zip` | Pasta portátil: descompacte e abra `CasaVertigemHub.exe`. Para guardar os dados dentro da pasta, crie nela um arquivo vazio chamado `portable.txt`. |

Ao instalar por cima de uma versão anterior (Diagramador de Livros), configurações, bibliotecas e padrões são copiados automaticamente na primeira abertura; os arquivos `.livro` continuam compatíveis.

Como os executáveis não têm assinatura digital, o Windows SmartScreen pode avisar: **Mais informações → Executar assim mesmo**.

## Recursos

### Fluxo rápido: enviar, ajustar e baixar
- Ao abrir, a tela de **boas-vindas** oferece **Enviar um livro**, abrir um projeto ou começar do zero.
- **Envie qualquer livro**, mesmo sem formatação: o sistema reconhece os títulos (marcadores como “CAPÍTULO 1”/“IV”, títulos do Word ou, sem nada marcado, linhas curtas isoladas entre parágrafos), divide os capítulos, aplica o tema padrão, pagina, numera as páginas e gera o sumário — **sem perguntas**. Título e autor vêm do arquivo (ou das primeiras linhas do texto).
- Um painel mostra o **registro de cada etapa** do carregamento e da exportação, com o tempo; no fim, atalhos para revisar títulos, pôr a capa e exportar.
- **Capa e imagens iniciais** (opcional): a capa abre o livro em página inteira (sem margens) e é a capa do EPUB; imagens extras vêm antes da página de rosto. Ao escolher a capa, o sistema pede a **sinopse**.
- **EPUB pronto para uso**: capa reconhecida pelos aplicativos e lojas, sumário navegável, título, autor, idioma, sinopse, editora, ISBN, **data de publicação = dia em que foi gerado** e crédito à **Casa Vertigem** (produção do livro digital).

### Edição direta nas páginas
- O texto é **editado na própria página**: clique em qualquer parágrafo do livro e digite. Não há caixa de texto separada — o que aparece na tela é o livro paginado, com fontes, margens, notas e números de página reais.
- Digitação, Enter, apagar, colar, negrito/itálico (Ctrl+B/I/U), desfazer (Ctrl+Z) e todos os botões da barra (títulos, citações, notas, imagens, tabelas, ligações) funcionam direto na página. O capítulo é **repaginado em segundo plano** logo depois de parar de digitar, e o cursor continua no mesmo ponto.
- O título do capítulo também pode ser editado clicando nele na página.
- **“Não é um título”**: clique num título (ou no título de um capítulo) na página e use o botão que aparece — o título volta a ser texto corrido (um capítulo errado se junta ao anterior). Tudo o que foi marcado fica na lista **↺** (acima da lista de capítulos e em Revisar títulos), com **Reverter** para desfazer.
- **Imagens direto na página**: arraste uma imagem para qualquer ponto de uma página de capítulo (sobre o texto, nas margens, acima, abaixo ou em cima de outra imagem). Uma linha mostra onde ela vai entrar; à esquerda ou à direita o texto corre ao lado; **no centro, o texto contorna a imagem dos dois lados** (lê-se a linha da esquerda e depois a da direita), acompanhando a forma do desenho nas imagens com fundo transparente ou liso, sempre com folga e sem quebrar palavras, e sem faixas em branco: não há espaço extra acima nem abaixo da imagem (a folga fica dentro das linhas ao redor), o texto ao lado continua no parágrafo seguinte quando um acaba, e, se a imagem não couber no pé da página, as linhas seguintes sobem para encher esse espaço e a imagem abre a página seguinte — inclusive soltando no meio de um parágrafo, que continua ao redor da imagem e depois dela. No painel da imagem, “Texto ao redor › No centro — texto contornando dos dois lados” faz o mesmo para imagens já no livro. Imagens já no livro também podem ser movidas **segurando e arrastando com o mouse** para outro ponto (até outro capítulo); o fantasma da imagem acompanha o cursor e a página rola sozinha perto das bordas.
- **Texto no contorno da figura**: soltando a imagem à esquerda ou à direita, o texto corre acompanhando a forma do desenho, sempre com um respiro mínimo (≈3,5 mm) entre a figura e as letras (como nas gravuras de livros clássicos). Imagens com fundo liso (branco, papel) têm o fundo removido automaticamente para isso; a original continua no projeto. Opção **Avançar sobre a margem** para a figura sair da mancha pelo lado.
- **Imersão** (menu Design): galeria com 20 imagens próprias (5 geométricas para não ficção, 5 de romance com florais e silhuetas, 5 de terror e 5 de suspense) e envio das suas. A imagem fica no alto da página de abertura de cada capítulo, acima do título, até além do corte (sangria), com transição suave para a página. **Mesma imagem** em todos os capítulos ou **Aleatório**: escolha várias e use **🎲 Randomizar** — uma por capítulo, todas diferentes quando há imagens suficientes (o painel mostra quantas faltam); com menos imagens, elas se alternam sem repetir uma logo após a outra. Também vai para o EPUB.
  - **Enviar do computador**: ao enviar, um diálogo pede a categoria de cada imagem (Geométricas, Romance, Terror, Suspense ou sem categoria, com “Todas de uma vez”); a imagem passa a aparecer na aba da categoria. Também dá para arrastar arquivos direto para uma aba (já entram catalogados) e trocar a categoria depois no seletor abaixo de cada imagem. As abas mostram quantas imagens têm.
  - **Molduras** (na mesma tela): 21 modelos em preto puro sobre branco, em três abas — **Clássicas** (filete duplo, cantos clássicos, art déco, vinhetas, pontilhado com rosetas, grossa e fina, linhas cruzadas, ornamental), **Vitorianas** imersivas, ocupando quase toda a margem (arabescos, filigrana, medalhões, gótico, luto, cordão) e **Terror** (galhos secos, arame farpado, adagas, teias de aranha com aranha, espinhos, correntes, caveiras). Ficam na margem, em volta da mancha com folga, e o texto continua no centro. **Aplicar à página** vale para as páginas do capítulo aberto; **Em todos os capítulos**; **Todas as páginas** vale para o livro inteiro, inclusive as aberturas de capítulo — menos as que têm imagem de imersão (nessas a moldura sai; nas outras páginas continua).
  - **Minhas molduras**: envie as suas (PNG com fundo transparente ou JPG com o centro em branco). O sistema mostra o tamanho certo — o da página do livro (ex.: 155 × 230 mm = 1831 × 2717 px a 300 dpi). A moldura vai para o fundo da página, o texto fica por cima, e as margens dessas páginas se afastam sozinhas da faixa desenhada (medida na própria imagem) para o texto nunca encostar nas bordas.
- Ao clicar numa imagem: **alças** para aumentar e reduzir arrastando, e o painel com **legenda**, **caixa de texto**, **recorte**, giro, opacidade, texto ao redor e **remover o fundo** (feito no computador, sem internet; a original continua no projeto; o texto passa a contornar a figura).
- **Caixa de texto e caixa de citação**: selecione o texto na página e escolha na barra flutuante **▢ Caixa** (contorno, fundo cinza, barra lateral, filetes, fundo escuro) ou **❝ Citação** (recuada, aspas grandes, barra lateral, destaque centralizado). “Sem caixa” desfaz.

### Melhoramento (EPUBs do Project Gutenberg → DOCX no padrão)
Tela própria, aberta pelo botão **Melhoramento** no topo (ou na tela de boas-vindas). Envie um ou vários EPUBs do Project Gutenberg (botão ou arrastando para a tela) e clique em **Iniciar**:
- remove as páginas pré e pós-textuais que não entram no livro: capa do arquivo, cabeçalho e licença do Project Gutenberg (e todos os avisos “START/END OF THE PROJECT GUTENBERG…”), página de rosto original, dedicatória, sumário original, listas de ilustrações, notas do transcritor, números de página da edição impressa e o que vem depois de “THE END”;
- mantém prólogo/introdução e os capítulos, com as ilustrações e notas de rodapé;
- monta o **sumário do sistema** (com a nossa estética) e aplica os estilos do app: títulos de capítulo, rótulo “Capítulo N”, alinhamento e tamanho do texto, recuo de parágrafo, citações e legendas;
- preserva o layout do original: alinhamentos (centralizados, à direita), parágrafos sem recuo, ilustrações com a largura e a posição (centro, esquerda, direita) do EPUB e na proporção certa;
- texto e títulos em **Garamond**, com tamanhos, alinhamentos, recuos e espaços do sistema; cada capítulo começa em página nova por uma quebra única dentro do próprio título (nunca sobra página em branco);
- gera um **DOCX** (Word) por livro. Com **“Substituir o EPUB original pelo DOCX”** (ligado por padrão, a escolha fica lembrada), o DOCX é gravado na pasta do EPUB, com o mesmo nome, e — só depois de conferido — o EPUB vai para a **Lixeira** (recuperável); se algo falhar, o EPUB é mantido. Com a opção desligada, salva uma cópia na pasta **Downloads** (sem sobrescrever arquivos com o mesmo nome). Ao abrir, o Word pergunta se deve atualizar os campos — responda “Sim” para preencher os números de página do sumário.
- **Modo em massa**: vários livros na fila são processados um após o outro, com log de cada etapa (capítulos encontrados, páginas removidas, imagens, arquivo salvo) e erros sem interromper os demais.

### Tradução (qualquer idioma → português do Brasil)
Tela própria, aberta pelo botão **Tradução** no topo (ou na tela de boas-vindas). Envie um ou vários livros (EPUB, DOCX, DOC, ODT) em qualquer idioma e clique em **Iniciar**; com vários, eles são traduzidos um após o outro, com o registro de cada etapa em tempo real.
- **Limpeza** igual à do Melhoramento: tira avisos e licença do Project Gutenberg, capa, rosto, dedicatória, sumário original e páginas pós-textuais; ficam os capítulos e o sumário do sistema.
- **Tradução literária** por trechos (~1.600 palavras), com as diretrizes editoriais do sistema — tradutor literário sênior, copidesque e preparador de textos: fiel ao tom e ao subtexto, ritmo e fluidez, preparação de texto, preservação da estrutura (ênfases, notas de rodapé, ilustrações) e concisão para a diagramação. Um glossário de nomes e termos e o fim do trecho anterior acompanham cada trecho, para manter coesão e coerência no livro todo. Títulos do livro e dos capítulos também são traduzidos.
- **Sem chave, funciona do mesmo jeito**: o **Google Tradutor** (gratuito, sem cadastro) faz a tradução bruta bloco a bloco, preservando títulos, ênfases e notas; se houver chave do OpenRouter ou do Gemini, a **IA revisa** cada trecho (sentido, coesão, coerência e estilo); depois o sistema aplica a pós-edição de sempre. Escolhendo um motor de IA sem informar a chave, o tradutor usa o Google Tradutor automaticamente.
- **Tradução offline (sem internet)**: em *Configurações da tradução → Tradução offline*, baixe um motor uma vez (o download continua de onde parou se cair): **M2M100** (padrão, ~560 MB, licença MIT — pode ser usado em livros comerciais) ou **NLLB-200** (~900 MB, traduz melhor, mas a licença CC-BY-NC 4.0 só permite uso não comercial). Os dois são modelos neurais da Meta que rodam no próprio computador, com vários núcleos, sem enviar nada para a internet. Escolha o motor **Offline** ou deixe no Google Tradutor: sem internet (ou com o Google bloqueado ou no limite), o trecho segue sozinho pelo motor offline. Nos motores de IA (OpenRouter, Gemini), quando o limite gratuito ou a conexão falham, o trecho é tentado de novo e depois segue pelo Google Tradutor/motor offline — a fila não para. Na tradução offline, ênfases no meio de uma frase (itálico de uma palavra) podem se perder; títulos, notas de rodapé e parágrafos inteiros em itálico ficam.
- **Livros de referência (memória de tradução)**: em *Configurações da tradução → Livros de referência*, envie pares **original + tradução publicada** (EPUB, DOCX, DOC ou ODT). O sistema alinha os dois livros parágrafo a parágrafo (e frase a frase) e passa a usar o que aprendeu em **todos os motores, inclusive offline**: frases idênticas ou quase idênticas usam a tradução aprovada, **nomes** seguem o glossário aprendido (Toto → Totó, London → Londres) e o **glossário da editora** (digitado na mesma tela, “termo = tradução”, com prioridade), e a revisão por IA recebe, a cada trecho, exemplos parecidos das referências para seguir o mesmo estilo, vocabulário, coesão e coerência.
- **Dicionários de tradução**: antes da tradução automática, ~170 **expressões idiomáticas do inglês** são reescritas em linguagem literal (“it's raining cats and dogs”, “spill the beans”, “out of the blue”), para não saírem traduzidas palavra por palavra; depois, o dicionário de pós-edição corrige **literalismos** (“em adição” → além disso, “mais e mais” → cada vez mais, “ao invés de” → em vez de, “estava a fazer” → estava fazendo).
- **Motores**: **OpenRouter** (o principal; modelos gratuitos — padrão: NVIDIA Nemotron 3 Ultra, `nvidia/nemotron-3-ultra-550b-a55b:free`; precisa de internet e de uma chave gratuita criada em openrouter.ai/keys; o modelo pode ser trocado por qualquer outro do catálogo; os modelos gratuitos têm limite diário de pedidos), **Google Gemini** (API do Google AI Studio — padrão: `gemini-2.5-flash`; chave criada em aistudio.google.com/apikey, com cota gratuita; o teste de conexão lista os modelos disponíveis para a chave) ou **Ollama** (modelo instalado no próprio computador, funciona sem internet; a qualidade depende do modelo). As chaves ficam guardadas criptografadas no computador; com OpenRouter e Google o texto do livro é enviado ao serviço escolhido. “Testar conexão” confere tudo antes de começar. (O motor Claude saiu da tela por enquanto; o código continua no app para voltar quando for preciso.)
- **Pós-edição local** (dicionário do próprio app, sem internet): diálogos com aspas viram travessão no padrão brasileiro (—Olá — disse ele. — Tudo bem?), Novo Acordo Ortográfico (acentos, trema, hífen com prefixos, compostos), formas do português europeu → brasileiro, dicionário de estilo (pleonasmos, falsos cognatos como “realizar” = perceber, possessivos desnecessários com partes do corpo), pontuação editorial (aspas curvas, reticências, travessões, espaços) e medidas de legibilidade (índice de Flesch para o português, frases longas, repetições próximas).
- **Saída**: DOCX traduzido e formatado no padrão do app (Garamond, títulos, parágrafos, sumário) na pasta Downloads, com “(pt-BR)” no nome.
- **Relatório** ao fim de cada livro: tudo o que foi feito e processado, números (palavras, capítulos, variação de extensão, legibilidade, diálogos, correções), parecer sobre a tradução, principais mudanças, principais correções, correções por regra, glossário e notas editoriais do tradutor. **Salvar (PDF)** gera um documento de conferência minimalista com o logotipo e o nome do sistema, nas cores do app.

### Editora e logotipo (Créditos e ficha)
- **Editoras…** abre a lista de editoras: adicione (Enter), edite nome e cidade, exclua e **Salvar** — a lista fica guardada para todos os livros. Escolhendo a editora no seletor, a ficha catalográfica e a página de rosto se atualizam na hora, e a prévia vai até a ficha.
- **Logotipos da editora**: envie um ou vários (ficam salvos para os próximos livros). Clique num logotipo para aplicá-lo na **página de rosto, abaixo do título**, com “Impresso no Brasil” e “Sorriso, MT” (texto editável), largura e posição ajustáveis.

### Ficha catalográfica da Casa Vertigem
- **Letra maior**: a página de créditos passou de 7,5 pt para **9 pt** (ajustável em “Tamanho do texto da página de créditos”).
- **Créditos automáticos** (podem ser desligados): **Revisão** em rodízio entre Juliana Hasegawa, Camila Loreto, Isadora S. Vieira, Juliana Costa Monteiro e Ricardo N. Bragança — muda a cada exportação, na ordem; **Tradução** sorteada a cada exportação entre Isabela Vieira Machado, Isaias Pedroso Santana, Camila Borges Vieira, Santana Rosa Silveira e Matheus da Silva Cunha (opcional); **Diagramação** e **Capa**: Vitor Zindacta (via Casa Vertigem Hub). Um nome digitado para a mesma função tem prioridade. A prévia mostra os nomes da exportação atual.
- **Dados da empresa**: CASA VERTIGEM EDITORA DE LIVROS LTDA, CNPJ 13.539.864/0001-28, Rua Santa Clara 205/404 – Copacabana, RJ/RJ, CEP 22041-011.
- **Direitos autorais**: texto completo com © 2026, o nome do autor (o de *Dados e páginas iniciais*) e “Esta edição é publicada por” + o **selo editorial** escolhido. O texto antigo é trocado automaticamente.
- **Selos editoriais** (*Editora e logotipo*): Aliança do Reino, Ôssário, Cultura das Letras, Obsessiva, Espaço Capital Editora, Casa Vertigem, Saber Central, Papel de Brincar, Casa Azul, Nébula, Nova Academia, Cultura das Letras Edições e Prime Classics. Escolher o selo preenche a editora da ficha e coloca o logotipo na página de rosto (e na capa). Os logotipos vêm no instalador; se faltar algum, o app baixa uma vez e guarda uma cópia.
- **CDD** e **Assuntos** (indispensáveis, destacados quando vazios): janelas de escolha com os códigos usuais (literatura geral, brasileira, americana, britânica, inglesa, francesa, alemã, russa, japonesa, contemporânea, não ficção, acadêmicos, autoajuda, história, filosofia, receitas…) e os assuntos mais usados (Terror, Suspense, Romance, Literatura brasileira, Literatura contemporânea, Literatura universal…), na ordem de importância.

### Capa: logotipo e QR code
- No pé da **quarta capa** (ou da capa), o **logotipo** da página de rosto à esquerda e um **QR code** para www.casavertigem.com.br à direita, ao lado do código de barras sem encostar nele. Tamanhos, endereço, margens e lado são ajustáveis; vale na prévia, na prova de cor e no PDF CMYK.

### Número da página, molduras e títulos no texto
- **Número da página**: no rodapé, **à esquerda** (padrão — nas páginas pares e ímpares, nada à direita), no canto externo ou no centro, dentro de uma **forma** escolhida numa galeria (*Formato e diagramação → Cabeçalho, numeração e notas*): bloco, bloco arredondado, cápsula, círculo, caixa, anel, os quatro naipes (espadas, copas, ouros e paus), estrela, hexágono, escudo, flor e gota. Padrão: **número branco num círculo preto**; cores e tamanho ajustáveis. O número aparece também na abertura dos capítulos. Com moldura, o número fica dentro dela, com folga, sem encostar no desenho.
- Corrigido: na exportação, capítulos que começavam numa página par saíam sem número e sem cabeçalho, e as aberturas de capítulo não recebiam as regras do capítulo (falha do Paged.js corrigida).
- **Molduras em todas as páginas**: não entram na página de rosto (abertura do livro), na falsa folha de rosto nem na ficha catalográfica; entram na abertura dos capítulos sem imagem de imersão; nas páginas com moldura somem o cabeçalho (nome da obra e do autor) e o filete.
- **Título e Subtítulo no texto**: “Título” usa a mesma letra do título do capítulo, começa em página nova e entra no sumário; “Subtítulo” usa a mesma letra, em negrito, centralizado, no fluxo do texto e com espaço moderado.

### Configurações e atualização
- Botão **Configurações** no topo: mostra a versão instalada e, em **Atualizar agora**, baixa do GitHub o instalador da versão mais recente (ou a versão portátil, quando o app roda portátil) e o abre; configurações, bibliotecas e livros são mantidos. Cada compilação publica a versão em *Releases*.

### Filetes ornamentais
- 12 filetes da Casa Vertigem na biblioteca de imagens (categoria **Separadores**), para usar sob o título dos capítulos.

### Paginação rápida
- Abertura mais rápida: o código da interface fica pré-compilado entre uma abertura e outra (cache do V8), e o Google Tradutor trabalha com três lotes ao mesmo tempo.
- O livro é paginado **por capítulos, em paralelo**, em processos separados: a janela nunca trava e as primeiras páginas aparecem em cerca de um segundo. Ao editar, só o capítulo alterado é paginado de novo. A exportação usa o mesmo caminho (mesmo resultado da tela).
- Páginas fora da tela não são redesenhadas: livros de centenas de páginas rolam sem travar.

### Manuscrito
- Importação de **DOCX, DOC, EPUB, PDF, ODT, TXT, Markdown, HTML e RTF**, inclusive arrastando o arquivo para a janela. **Capítulos identificados pelos marcadores do texto**: “CAPÍTULO 1”, “Capítulo IV — Nome”, “Cap. 2” ou só números/romanos em sequência (1, 2, 3 ou I, II, III), com o nome do capítulo na linha seguinte; Prefácio, Introdução, Epílogo etc. viram seções sem número. A numeração do livro pode seguir o estilo do manuscrito (romanos ou arábicos).
- **Revisar títulos** (menu Livro ou botão **Aa** na lista de capítulos): todos os capítulos e títulos internos numa lista; cada linha pode virar capítulo, título de seção, subtítulo, intertítulo ou texto normal, com sugestão automática pelo padrão “CAPÍTULO N”. O sumário automático segue o resultado.
- **Notas de rodapé preservadas** (Word, EPUB, ODT, DOC, Markdown e, por reconstrução, PDF). Painel **Notas de rodapé**: ocultar todas sem apagar, remover todas ou só as escolhidas; no editor, clique numa nota para removê-la ou transformá-la em texto.
- O texto importado é **padronizado** com os estilos do livro (fontes, tamanhos, espaçamentos, títulos e subtítulos do manuscrito são trocados pela configuração escolhida). Na importação dá para escolher o **gênero do livro** e remover o sumário que já vinha no manuscrito (o livro gera o seu, com as páginas certas).
- Todo o texto é **justificado** (exceto poesia, alinhada à esquerda); o botão **Gênero do livro**, na barra superior, aplica fontes, títulos e alinhamento de uma vez.
- **Sem páginas em branco**: cada capítulo começa na página seguinte (nunca em uma página vazia), e rosto, ficha, sumário, dedicatória, epígrafe e páginas finais não recebem número de página.
- **Paginação automática** (Paged.js 0.5, com correção própria para parágrafos longos com frases repetidas; verificada palavra a palavra — nenhum trecho é duplicado ou ocultado): o texto que não cabe é empurrado para a página seguinte sem mudar o tamanho da fonte; controle de viúvas/órfãs e de títulos isolados.
- No editor: **notas de rodapé** no cursor (¹ Nota), **ligações** (🔗, Ctrl+K) para outro capítulo ou título — com o número da página de destino (“p. 41”) preenchido após a paginação — ou para sites/e-mails, **＋ Seção** (nova página com título logo depois do capítulo atual, também pelo ＋ na lista) e **✂ Dividir** (o texto a partir do cursor vira um novo capítulo, sem alterar o resto).

### Texto e estilos
- Estilos nomeados e totalmente configuráveis: texto principal, título de capítulo, rótulo, **T1, T2, T3**, citação longa, frase em destaque, **poesia**, epígrafe, **referências**, legenda, nota de rodapé, caixa de destaque, tabela, cabeçalho, número de página e sumário (fonte, tamanho, cor, entrelinha, espaço entre letras/palavras, recuos, espaços antes/depois, alinhamento, itálico, negrito, maiúsculas, versalete).
- **Fonte do título e do texto** (painel do capítulo): mudar a fonte do título muda **todos os títulos** do livro (capítulos, rótulos, Título, Subtítulo e intertítulos); mudar a fonte do texto muda **todo o texto**.
- **Marcador de texto** (🖍 na barra do editor e **🖍 Marcador ▾** na barra que aparece ao selecionar): contorno colorido atrás da frase, em **cinza, preto, verde neon, amarelo neon, rosa neon** ou **branco com contorno fino** (texto numa caixa de linha fina). Com as cores fortes escuras (preto, rosa), a letra fica branca automaticamente. Sai igual no PDF, no EPUB e no DOCX (sombreamento/borda do Word); “Sem marcador” tira.
- **Estilos de caractere** (para trechos dentro do parágrafo): Ênfase, Destaque forte, Versalete, Termo estrangeiro, Título de obra e Sigla, além dos que você criar (fonte, tamanho, cor, itálico, negrito, versalete, maiúsculas, sublinhado, espaço entre letras). Selecione o trecho na página e use **Aa Estilo ▾** na barra que aparece; mudar o estilo em Estilos de texto muda todos os trechos marcados com ele no livro, no EPUB e no DOCX. Excluir um estilo devolve os trechos ao texto normal.
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

### Estilos rápidos e legendas
- **Barra rápida** ao selecionar um texto no editor: **Título**, **Subtítulo**, **Corpo**, **Legenda ▾**, Citação e Destaque (também fixos na barra do editor; atalhos Ctrl+1, Ctrl+2, Ctrl+0 e Ctrl+9).
- **Legendas**: o parágrafo selecionado vira a legenda da figura ou tabela vizinha (ou uma legenda solta). Seis estilos elegantes — Clássica, Editorial, Moderna, Discreta, Destaque e Lateral —, com um padrão para o livro (Estilos de texto) e estilo próprio por legenda. Legendas que já vêm numeradas são mantidas como estão.

### Importação completa
- **Word (.docx)**: imagens, **gráficos nativos do Word** (recriados como gráficos editáveis), notas de rodapé, **comentários de revisão** (ficam no editor como 💬 e na Revisão do texto, nunca no livro), listas, tabelas, legendas ligadas à figura/tabela/gráfico e “Fonte:” — tudo no estilo definido do livro e indexado nas listas.

### Aparência do sistema
- Visual vibrante e elegante: menu com botões grandes, ícones e bordas, resposta visual ao passar o mouse e ao clicar; páginas do livro no centro e os ajustes abrindo ao lado delas.
- **Modo noturno** (botão 🌙 no topo), claro ou automático (segue o Windows) e **onze cores** do sistema (Vertigem — padrão —, Carvão, Terracota, Azul-marinho, Verde-floresta, Vinho, Roxo, Petróleo, Âmbar, Rosa, Grafite). As páginas do livro continuam brancas na prévia; restaurável em Restaurar padrões.

### Tipografia e paginação (acabamento automático)
- **Grade de linha de base**: títulos, imagens, tabelas, citações e caixas ocupam um número inteiro de linhas e os espaços entre blocos são múltiplos da entrelinha — as linhas das páginas opostas ficam na mesma altura, mesmo com títulos e imagens.
- **Justificação fina**: cada parágrafo com linhas frouxas é testado com ajustes mínimos de entreletra (até ±2%) e de espaço entre palavras (até ±5%); fica o que deixa o texto mais uniforme, sem “rios”. **Dicionário de exceções de hifenização** (`a-na-cro-nis-mo` = pontos de quebra; sem hífen = nunca divide).
- **Índice remissivo**: marque termos no editor (📇 Índice, com subentradas e “marcar todas as ocorrências”); o índice sai nas páginas finais, em ordem alfabética, agrupado por letra, em 1 a 3 colunas, com as páginas (12, 15–17, 40) atualizadas a cada paginação.
- **Figuras, gráficos, tabelas e quadros** numerados, com listas próprias e **referências cruzadas** (↪ Referência): “ver Figura 3, p. 41”, que acompanha a numeração e a página.
- **Notas de fim e notas laterais**: as mesmas notas podem sair no rodapé, no fim de cada capítulo, no fim do livro (agrupadas por capítulo) ou na margem externa.
- **Algarismos romanos nas pré-textuais** (i, ii, iii…), com a contagem arábica recomeçando no 1º capítulo e a ficha catalográfica no formato “xii, 230 p.”.
- **Normas ABNT**: referências NBR 6023 (alinhadas à esquerda, linha em branco entre elas) e citação longa NBR 10520 (recuo de 4 cm, letra menor); no editor, “ABNT ▾” monta referências (livro, capítulo, artigo, site, tese), citações autor-data e ordena as referências.
- **Ajuste da última página**: se um capítulo termina com poucas linhas sozinhas na última página, ele é levemente encolhido (ou expandido); o ajuste fica salvo e só é refeito quando o capítulo muda.
- **Modelos de sumário**: pontilhado, sem pontilhado, número junto ao título, número à esquerda, duas colunas e com resumos dos capítulos.

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

### Revista e jornal (mesa de trabalho própria)
- **Livro** e **Revista e jornal** são mesas separadas (seletor no topo, ao lado do nome): cada uma tem o seu projeto, formato, colunas, margens, arquivo, histórico e exportação. Trocar de mesa guarda a atual; na primeira vez abre uma revista de exemplo. Cada mesa mostra só as telas que lhe pertencem.
- Colunas fixas (**2 ou 3**), espaço e fio entre colunas, nome da publicação com logotipo, edição e data (também no cabeçalho), e por matéria: **chapéu**, **linha fina**, **assinatura**, colunas próprias e “começa em página nova” ou continua na mesma página.
- **Blocos de imagem** (tela *Blocos e páginas sangradas*): áreas cinza, horizontais (largura toda) ou verticais (ao lado do texto), com legenda de teste. No preview, o **+** do bloco escolhe a imagem (ou arraste uma imagem para dentro dele); “Legenda ✓/✕” liga/desliga a legenda e ✕ remove o bloco. “Distribuir” coloca os blocos em pontos estratégicos das matérias. Na exportação, o verificador avisa se algum bloco ficou sem imagem.
- **Páginas sangradas (full bleed)**, opcionais, antes e/ou depois de cada matéria (ou capítulo, no livro): imagem cobrindo a página inteira; com “página dupla” a imagem fica na página par e a matéria abre na ímpar ao lado. Um **box** opcional com título e texto informativo (escuro, claro ou só contorno; nos cantos ou em faixa).

- **Composições de página** (tela própria, no menu da mesa de revista): 10 distribuições de texto e imagens prontas, mostradas em miniatura — Clássica (3 colunas, foto horizontal e olho em faixa), Foto principal, Retratos, Citação em destaque, Box lateral, Entrevista, Jornal (4 colunas), Ensaio (1 coluna larga), Galeria e Abertura. Escolha a matéria e clique na composição: toda composição segue a ordem **título em destaque › linha fina › imagem de abertura › texto**; o app ajusta colunas e título, coloca os blocos de imagem e as caixas (o olho usa uma frase da própria matéria) sem alterar o texto. Cada matéria pode ter a sua; “Voltar ao texto simples” desfaz.

### Letra capitular
- Em *Formato e diagramação › Capítulos*: **fonte da capitular** (embutidas, sua biblioteca ou fontes do computador), **quantas linhas** ela ocupa (2 a 8) e a **cor**, com amostra ao lado.

### Filete do cabeçalho
- Uma linha fina separa o cabeçalho (título do livro, autor ou capítulo) do texto. Com o livro aberto, as linhas das duas páginas **se encontram na lombada**.
- Galeria em *Formato e diagramação › Cabeçalho*: linha fina, marcada, dupla, grossa e fina, fina e grossa, pontilhada, tracejada, esvaecida (mais forte na lombada), com ornamento ◆, curta centralizada ou sem filete; cor, espessura e distância até o texto ajustáveis.

### Caixas e legendas sobre as imagens (menu **Caixas**)
- 13 modelos prontos (faixa escura, itálico sobre a foto, fio lateral, etiqueta, contorno, título grande, caixa branca, caixa preta, vidro claro, citação, nota adesiva, carimbo, faixa diagonal), cada um com fonte, cores e tamanho próprios, que acompanham o tamanho da imagem.
- Escolha o capítulo e a imagem; **um clique** num modelo aplica, **dois cliques** removem. Depois de aplicar: texto, **altura** (de cima para baixo) e **rotação**; **★ Salvar preferências** guarda a posição para as próximas vezes que o modelo for usado.

### Colunas num trecho (botão direito)
- Selecione o texto (no editor ou direto nas páginas), clique com o **botão direito** › **Dividir em 2 colunas** ou **3 colunas**. Só os parágrafos selecionados vão para as colunas (com fio fino entre elas, que pode ser tirado); o resto da página continua em uma coluna.
- Imagens, caixas de texto, tabelas, citações em caixa e títulos T1 nunca entram no bloco: a seleção é dividida em volta deles. Molduras, letra capitular, filete e imersão continuam funcionando.
- Um trecho longo em colunas enche cada página até o pé e continua, em colunas, na página seguinte; o último pedaço fica com as colunas equilibradas. Botão direito dentro do trecho: mudar para 2/3 colunas, tirar/pôr o fio ou **remover as colunas**.

### Subtítulos em caixa alta espaçada
- T1 e T2 saem por padrão em **caixa alta, sem serifa geométrica em negrito (Josefin Sans), letras espaçadas, à esquerda**. Fonte, tamanho, entrelinha, espaçamento das letras, alinhamento e espaços antes/depois são ajustáveis em *Estilos de texto*; em livros já existentes, use o botão **✦ Caixa alta espaçada** no cartão do T1/T2/T3. Novas fontes embutidas: Josefin Sans e Montserrat.

### Estilos de sumário (galeria)
- Botão **✦ Estilos de sumário…** (em Dados e páginas iniciais › Sumário e em Tipografia e paginação): janela com 18 estilos prontos, em miniaturas com o formato, as margens e os capítulos do seu livro.
- **Fontes e espaçamentos:** Clássico grande (Garamond, versalete), Moderno grosso (Playfair extra-grosso), Fino e arejado (Cormorant leve), Compacto, Editorial (fio grosso, número à esquerda), Centrado (Baskerville), Bem espaçado (Merriweather com fios).
- **Com moldura:** simples, dupla, grossa (na cor escolhida) e cantoneiras.
- **Imersivos** (chegam ao corte, com sangria): faixa à direita, à esquerda, no alto (título em branco) e na base; moldura grossa nos quatro lados; página inteira escura. Cor das faixas e molduras escolhida na própria janela.

### Colar tabelas, gráficos e imagens
- Cole (Ctrl+V) no editor ou direto nas páginas tabelas do **Excel, Word, LibreOffice, Google Planilhas** ou de páginas da web: cada célula mantém **fundo, cor, negrito, itálico, alinhamentos e bordas** e as colunas mantêm a **proporção**. No livro, a tabela é só encaixada na largura da mancha; se for mais larga que a página, a letra diminui o necessário para que **nenhuma palavra ou número seja partido**.
- **Gráficos** em SVG viram imagem em alta resolução; imagens coladas (inclusive as que o Word/Excel mandam como arquivo temporário) viram imagens do projeto, redimensionadas para caber na largura e na altura da página.

### Estilos de título
- Tela *Estilos de título*: título dentro de **caixa preta fina com letra branca**, **caixa branca fina com letra preta** ou **só contorno preto fino**, alinhado à esquerda, ao centro ou à direita. Vale para todos os capítulos/matérias ou só para um (estilo próprio).

### Caixas de texto (livro e revista)
- Caixa invisível que só delimita o espaço: aparece apenas o texto (no preview há um tracejado de guia que não sai na exportação). Clique na caixa para o menu: **lateral esquerda/direita** (o texto ao lado segue reto pela margem), **centro** (o texto contorna dos dois lados), **faixa** (acima/abaixo, com o texto ajustado ao fluxo); largura −/+; estilo destaque grande, citação ou texto normal; **Contorno: Manter** (a caixa sai como no preview, com o contorno tracejado, também no PDF) ou **Remover** (só a frase); remover a caixa. Na tela *Blocos e páginas sangradas*, “Contorno de todas as caixas” aplica Manter/Remover em todas de uma vez.

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

## Desempenho com livros grandes
- A paginação acontece em processos separados, vários capítulos ao mesmo tempo (um por núcleo livre do computador, até 6): a tela nunca espera a paginação.
- A prévia encaixa os capítulos prontos em lotes; os botões ao lado das páginas e a edição direta (com o corretor ortográfico) só são preparados nas páginas perto da área visível. As páginas fora da tela não são desenhadas.
- **Cache de páginas**: cada capítulo paginado fica guardado no disco (até 400 MB, os menos usados saem primeiro). Reabrir um livro, desfazer uma edição ou exportar logo depois da prévia não pagina de novo o que já foi paginado.
- A hifenização é reaproveitada entre edições, e as imagens vão para o processo de paginação uma vez só.
- Medido num livro de 738 páginas (computador de 4 núcleos): primeira página em ~2 s, livro inteiro em ~19 s sem travar a tela (maior pausa ~0,2 s), edição de volta à prévia em ~2,3 s, reabertura em ~0,7 s, digitação em ~2 ms por tecla; a exportação em PDF reaproveita as páginas da prévia.

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
npm run qa           # bateria de qualidade: 30 modelos de PDF + exportações DOCX/ODT/EPUB (requer Python 3 e poppler-utils)
npm run perf         # desempenho com um livro de ~700 páginas (primeira página, total, travadas, edição, reabertura)
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
| `src/main/layout-pool.js` | Paginação em janelas de trabalho paralelas (um processo por núcleo livre, até 6) |
| `src/main/offline-mt.js`, `src/mt/` | Tradutor offline: download do modelo (M2M100 ou NLLB-200) e janela oculta com transformers.js/ONNX (WebAssembly) |
| `src/main/tmstore.js`, `src/shared/mtkit.js` | Livros de referência (alinhamento, memória de tradução, glossário), idioma, frases e expressões idiomáticas |
| `src/main/layout-cache.js` | Cache em disco das páginas já paginadas (por capítulo; imagens fora do cache) |
| `test/qa/`, `test/perf/` | Bateria de qualidade e teste de desempenho |
| `src/shared/defaults.js` | Formatos, estilos, configurações padrão e por gênero, migração de projetos |
| `src/renderer/` | Interface (editor, painéis, bibliotecas, camadas, capa, exportação, prévia) |
| `assets/library/` | Biblioteca embutida (ilustrações e separadores em PNG) |

## Licenças de terceiros

Electron (MIT), Paged.js (MIT), pdf.js (Apache-2.0), Mammoth (BSD-2), word-extractor (MIT), JSZip (MIT/GPLv3), docx (MIT), qrcode (MIT), Hyphen (ISC), pdf-lib (MIT), lcms-wasm / Little CMS (MIT), transformers.js (Apache-2.0), ONNX Runtime Web (MIT); modelos M2M100 (Meta, MIT) e NLLB-200 (Meta, CC-BY-NC 4.0), baixados pelo usuário; fontes embutidas sob SIL Open Font License. Algarismos do código de barras: contornos da IBM Plex Sans (SIL OFL 1.1). Perfis ICC redistribuídos sem alteração, com as licenças em `assets/icc/ICC-PROFILE-LICENSES.md` (ISO Coated v2: licença Heidelberg; GRACoL 2013: IDEAlliance; sRGB: HP). As ilustrações da biblioteca embutida foram desenhadas para este projeto.
