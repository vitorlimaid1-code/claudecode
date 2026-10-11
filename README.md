# Diagramador de Livros

Aplicativo desktop para **diagramar livros diretamente no PC** e exportar o miolo em **PDF pronto para gráfica** ou impressão sob demanda (Amazon KDP, Clube de Autores, UICLAP etc.).

- 100% **local e offline**: nenhum texto sai do computador (o app bloqueia qualquer acesso à rede).
- Os projetos são salvos como arquivos **`.livro`** na pasta que você escolher, com salvamento automático de recuperação.

## Instalação (Windows)

1. Baixe `Diagramador-de-Livros-Setup-<versão>.exe`
   - na aba **Releases** do repositório, ou
   - em **Actions → Instalador Windows → (última execução) → Artifacts**.
2. Execute o instalador e siga os passos (permite escolher a pasta; cria atalhos na Área de Trabalho e no Menu Iniciar).
3. Como o instalador não é assinado digitalmente, o Windows SmartScreen pode avisar: clique em **Mais informações → Executar assim mesmo**.

## Recursos

**Conteúdo**
- Capítulos com editor de texto: parágrafo, subtítulo, seção, citação, negrito, itálico, sublinhado, versalete, sobrescrito, alinhamentos, listas, parágrafo sem recuo, **quebra de cena**, **quebra de página** (Ctrl+Enter) e **imagens**.
- Capítulos numerados ou não (prefácio, agradecimentos…), reordenação por arrastar e soltar.
- **Importação** de Word (`.docx`), texto (`.txt`), Markdown (`.md`) e HTML — títulos de nível 1 (ou linhas “Capítulo X”) viram capítulos automaticamente.
- Colagem limpa do Word/Google Docs (mantém itálico/negrito, remove formatação estranha).

**Páginas iniciais**: falsa folha de rosto, folha de rosto, créditos/ficha (gerada automaticamente se vazia), dedicatória, epígrafe e **sumário automático com números de página**.

**Diagramação**
- Formatos: 14×21, 16×23, 15,5×23, 12×18, A5, A4, 6×9", 5,5×8,5", 5×8" ou personalizado.
- Margens espelhadas (interna/externa), **sangria** e **marcas de corte**.
- 7 fontes embutidas (EB Garamond, Crimson Pro, Libre Baskerville, Lora, Merriweather, Cormorant Garamond, Playfair Display) + fontes do Windows; todas incorporadas ao PDF.
- Tamanho, entrelinha, recuo, espaçamento, justificação, **hifenização em português**, controle de viúvas/órfãs.
- Capítulos: rótulo e numeração (1, I, “Um”), recuo do topo, início em página ímpar, **letra capitular**, primeira linha em versalete.
- Cabeçalhos correntes (título do livro / capítulo, autor / título) e numeração (rodapé externo, centro ou topo), contando a partir do 1º capítulo.
- Estilos prontos: Clássico, Elegante, Moderno, Acadêmico e Infantojuvenil.

**Prévia** em tempo real, página a página, em páginas duplas (livro aberto) ou simples, com zoom e guias da mancha gráfica.

## Desenvolvimento

Requisitos: Node.js 20+.

```bash
npm install          # instala dependências e copia Paged.js/fontes para src/renderer/vendor
npm start            # abre o aplicativo
npm test             # gera um PDF de exemplo pelo mesmo caminho da exportação
npm run dist:win     # gera dist/Diagramador-de-Livros-Setup-<versão>.exe
```

`npm run dist:win` funciona no Windows e também em Linux/macOS (sem precisar do Wine).
O workflow `.github/workflows/build-windows.yml` gera o instalador a cada push; criar uma tag `v*` (ex.: `v1.0.0`) publica uma Release com o `.exe`.

### Estrutura

| Caminho | Função |
| --- | --- |
| `src/main.js` | Processo principal: janelas, menus, arquivos, importação, exportação PDF, bloqueio de rede |
| `src/book.js` | Converte o projeto em HTML + CSS paginado (regras `@page`) |
| `src/shared/defaults.js` | Formatos, fontes, configurações padrão e estilos prontos |
| `src/renderer/` | Interface (editor, painéis, prévia) e página de paginação com Paged.js |
| `scripts/` | Cópia de dependências da interface e geração do instalador |

## Licenças de terceiros

Electron (MIT), Paged.js (MIT), Mammoth (BSD-2), Hyphen (ISC) e fontes sob SIL Open Font License.
