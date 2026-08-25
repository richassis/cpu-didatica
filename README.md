# CPU Didática

Simulador didático de CPU. O aluno escreve um programa em assembly, executa, e
acompanha tick a tick o caminho de dados que o executa — registradores, ULA,
memória, unidade de controle e os fios entre eles.

## Rodando

```bash
npm install
npm run dev      # http://localhost:3000
```

## Duas versões do mesmo app

O app tem dois modos, e o que separa um do outro é uma flag de **build**.

| | `npm run dev` | `npm run build && npm start` |
|---|---|---|
| Program mode (aluno) | sim | sim |
| Edit mode (desenvolvedor) | sim | **não** |

`next.config.ts` define `NEXT_PUBLIC_ENABLE_EDITOR` — `1` em desenvolvimento,
`0` em produção — e `lib/editorFlag.ts` é o único lugar que lê essa variável.
Como o Next injeta o valor em tempo de build, os ramos protegidos por
`EDITOR_ENABLED` viram código morto na versão publicada.

Para gerar um build de produção **com** o editor (útil para conferir o bundle
publicado sem perder a ferramenta):

```bash
NEXT_PUBLIC_ENABLE_EDITOR=1 npm run build && npm start
```

### O que o aluno vê

Escrever e executar assembly, abrir e salvar o código em arquivo, navegar pela
linha do tempo da execução, e as configurações de visualização — base numérica,
quais sinais mostrar, velocidade da animação — disponíveis inclusive durante a
simulação.

Nada de posicionar componentes, configurar blocos, criar fios ou trocar de
projeto. Em `lib/modeStore.ts`, `enterEditMode()` é um no-op quando a flag está
desligada, então nem um botão esquecido conseguiria abrir o editor.

### O que o desenvolvedor vê a mais

O Edit mode: arrastar componentes, criar e rotear fios, configurar cada bloco,
e o `ProjectSwitcher` para trabalhar com projetos `.cpud` avulsos.

## O datapath de referência

`public/default-project.cpud` é o datapath que todo mundo vê. Ele é lido do
arquivo publicado **em toda carga da página** — não fica em cache no
localStorage — então publicar um layout novo chega a todos os usuários sem
precisar versionar nada.

O fluxo de edição é:

1. `npm run dev`, entrar no Edit mode e reposicionar o que precisar.
2. As mudanças são gravadas em `public/default-project.cpud` por
   `app/api/default-project/route.ts` (uma rota que só responde quando a flag do
   editor está ligada; em produção devolve 404). O botão **Salvar no arquivo**
   na barra do Edit mode força a gravação — vale usar antes de fechar, porque o
   arquivo é a única cópia.
3. Commitar o `.cpud` e publicar.

## Arquivos

- **Código do aluno** — qualquer arquivo de texto na importação; na exportação,
  `.asm` ou `.txt`, com o nome que o aluno escolher. As constantes estão todas
  em `lib/codeFile.ts`. Valores iniciais de memória vêm da diretiva `.data` no
  próprio assembly.
- **Projeto** — `.cpud`, só no Edit mode.

## Estrutura

```
app/          rota única + a rota de API de gravação (dev)
components/   canvas, widgets, modais; ProgramMode/ é a superfície do aluno
lib/          stores Zustand, montador, e simulator/ (o domínio, sem React)
lib/simulator/ CPU, ULA, memórias, registradores, barramento — nada de React
```

Documentos relacionados: `PORT_CONFIGURATION.md` (como declarar portas em
`lib/widgetDefinitions.ts`) e `.github/copilot-instructions.md`.
