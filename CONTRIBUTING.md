# Como contribuir

Obrigado por querer ajudar a CPU Didática! Este guia explica como o projeto está organizado e o
que esperar de uma contribuição.

*English speakers: see [the short version at the end](#in-english).*

## Você não precisa programar para ajudar

- **Relate o que confundiu.** Se um aluno travou em algum ponto, isso é um bug de didática e
  vale uma [issue](https://github.com/richassis/cpu-didatica/issues/new/choose).
- **Revise os textos e as traduções.** Eles ficam em `lib/i18n/`, em português (`pt/`) e
  em inglês (`en/`).
- **Escreva um programa de exemplo** que mostre algo que os cinco atuais não mostram. Mande
  como issue com o `.asm` anexado, ou como PR em `lib/presetPrograms.ts`.
- **Conte como foi usar em aula** nas
  [Discussions](https://github.com/richassis/cpu-didatica/discussions).

## Preparando o ambiente

É preciso ter Node.js 20.9 ou mais recente.

```bash
git clone https://github.com/richassis/cpu-didatica.git
cd cpu-didatica
npm install
npm run dev
```

`npm run dev` sobe o app com o **modo edição** ligado, para posicionar blocos e criar fios. O
build de produção não tem esse modo. O [README](README.md#modo-aluno-e-modo-editor) explica a
diferença.

## Fluxo de trabalho

1. Para mudanças grandes, como uma instrução nova, um bloco novo ou uma mudança de interface,
   **abra uma issue antes** e descreva a ideia. Assim combinamos o caminho antes de você
   investir tempo.
2. Faça um fork e crie um branch a partir de **`dev`**. O `main` é o que está publicado e só
   recebe o `dev` quando ele está estável.
3. Abra o pull request contra **`dev`**.

Antes de abrir o PR, rode:

```bash
npx tsc --noEmit    # tipos
npm run lint        # sem erros novos
npm run build       # o build de produção precisa passar
```

O CI roda a checagem de tipos e o build em todo PR.

Se a mudança é visual ou mexe na simulação, **teste no navegador**. Monte e execute pelo menos o
"Exemplo Básico" até o fim e descreva no PR o que você conferiu. Um print ou GIF ajuda muito.

## Como o código está organizado

```
lib/simulator/   o domínio: CPU, ULA, memórias, registradores, barramentos
lib/             stores (Zustand), montador, desmontador, agenda da animação
components/      a interface; ProgramMode/ é o que o aluno vê
public/default-project.cpud   o layout do caminho de dados
```

Algumas regras que mantêm o projeto coerente:

- **`lib/simulator/` não importa React.** É a CPU pura, que roda sem interface.
- **Nada de números duplicados.** Opcodes, larguras e sequências de estados vêm de
  `lib/simulator/` e a interface os lê de lá. Por exemplo, `INSTRUCTION_HELP` é um `Record`
  sobre todos os mnemônicos, então uma instrução nova sem texto de ajuda nem compila.
- **Ids nunca são fixos.** Os componentes de um layout têm ids arbitrários. Para achar "o PC",
  siga os fios, por exemplo o sinal `out_wrPC` da UC.
- **Comentários explicam o porquê.** O código diz o que faz, e o comentário conta a decisão
  por trás dele.
- **Nenhum texto da interface direto no componente.** Tudo o que o aluno lê sai do catálogo
  em `lib/i18n/` (veja [Traduções](#traduções)). Código, identificadores e comentários ficam
  em inglês, como já estão.

### Adicionando uma instrução

1. `lib/simulator/ISA.ts`: o opcode e o formato.
2. `lib/simulator/Cpu.ts`: a sequência de estados em `OPCODE_SEQUENCES` e os sinais emitidos.
3. `lib/assembler.ts` e `lib/disassemble.ts`: a sintaxe.
4. `lib/i18n/pt/reference.tsx` e `lib/i18n/en/reference.tsx`: o texto da ajuda, nos dois
   idiomas. O compilador avisa se faltar.
5. Um programa de exemplo que use a instrução, em `lib/presetPrograms.ts`, com a versão em
   português e em inglês.

## Traduções

A interface existe em português e em inglês. Os textos ficam em `lib/i18n/`, uma pasta por
idioma e um arquivo por área (barra, painéis, Ajuda, tour…):

- **`pt/` é a referência.** Ele define as chaves, e o tipo `Messages` sai dele.
- **`en/` é tipado contra o `pt/`.** Uma chave que falta ou sobra no inglês quebra o
  `npx tsc --noEmit`.
- **No componente,** `const t = useT()` e depois `t.area.chave`. Fora do React,
  `getMessages()`.
- **Plurais e ordem das palavras** ficam em funções no catálogo, como
  `lines: (n) => ...`. Frases com `<b>` ou `font-mono` no meio são funções que devolvem JSX.
- **Nomes de botões citados em outros textos** (o tour, o guia) vêm de `common.ui`, para não
  saírem de sincronia com o botão.
- **Os exemplos** têm uma versão por idioma em `lib/presetPrograms.ts`. Só mudam comentários
  e nomes de labels: as duas versões têm que montar as mesmas palavras.

Achou uma tradução estranha? Abra uma issue ou mande o PR direto no arquivo da área.

## Commits

As mensagens são em português, começando pelo que mudou e, quando ajuda, pela área. Por exemplo:

```
UC: entradas OPCODE e FLAGS nas laterais
Flags reveladas só quando o dado chega
```

## Conduta

Quem participa segue o [código de conduta](CODE_OF_CONDUCT.md). O projeto é feito para
estudantes, e muita gente chega aqui na primeira contribuição da vida. Seja gentil.

---

## In English

Contributions in English are welcome: issues, PRs and discussions alike.

- Set up with `npm install && npm run dev` (Node.js 20.9+).
- Branch from **`dev`** and open your PR against **`dev`**. `main` is what is deployed.
- Before opening a PR, run `npx tsc --noEmit`, `npm run lint` (no new errors) and
  `npm run build`. If the change is visual or affects the simulation, run the "Basic Example"
  program to the end in the browser and say what you checked.
- Open an issue before large changes, such as a new instruction, block or interface change.
- Interface text lives in `lib/i18n/`: `pt/` defines the keys and `en/` is typed against it,
  so every string you add needs both languages. Fixes to the English wording are very welcome.
- `lib/simulator/` is plain TypeScript with no React. Numbers live there once, and the UI reads
  them.
- Text shown to students stays in Portuguese. Code and comments can be in English.
