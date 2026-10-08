<div align="center">

# CPU Didática

**Write a program in assembly and follow, tick by tick, the datapath that runs it.**

A visual CPU simulator built for Computer Architecture and Organization courses.

[**Open the simulator →**](https://cpu-didatica.vercel.app)

[![MIT License](https://img.shields.io/badge/license-MIT-3fd69a.svg)](LICENSE)
[![CI](https://github.com/richassis/cpu-didatica/actions/workflows/ci.yml/badge.svg)](https://github.com/richassis/cpu-didatica/actions/workflows/ci.yml)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-3fd69a.svg)](CONTRIBUTING.md)

[🇧🇷 Português](README.md) · 🇬🇧 English

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/images/light.png">
  <img alt="The simulator running an ADD instruction: the assembly editor on the left, the assembled program in the middle and the datapath on the right, with the control unit in the EXECUTE state" src="docs/images/hero.png">
</picture>

</div>

> The simulator's interface, its help and its example programs are in **Portuguese**: it was
> made for Brazilian undergraduate courses. The assembly language, register names and state
> names are the usual ones and read the same in any language.

---

## Why it exists

In textbooks a CPU datapath is a still diagram. Students read that "in the EXECUTE state the
ALU adds A and B", but never see it happen, and it is hard to connect one line of assembly to
the control signals, registers and wires it drives.

CPU Didática makes that connection. Students write a program, assemble it, run it and follow
every clock tick: which state the control unit is in, which signals it asserts, what value
travels along each wire and where it lands. They can step forward, step back and replay as
often as they like.

It runs in the browser with no install and no account. Share the link with your class and
they're in.

## What you can do

<div align="center">
  <img alt="A few ticks animated: values travel along the wires between the A and B registers, the ALU and the register file while the control unit changes state" src="docs/images/demo.gif" width="860">
</div>

- **Write and assemble.** The editor has syntax highlighting and shows assembly errors with
  their line number. The machine code it produces sits right next to it, word by word, and the
  line being executed is highlighted in both.
- **Watch it run.** Each value travels along the wire it actually takes, in the order the
  hardware produces it. A register changes only when its data arrives, and the flags change
  only when the ALU computes them.
- **Move through time.** A timeline holds every tick. Play, pause, step back, jump to the end
  or scrub to any point, and hold `F` to speed up the animation.
- **See inside the control unit.** The state machine is drawn as a graph with the current state
  lit, and the control signals sit in a strip underneath it.
- **Inspect memory.** The instruction and data memories scroll and follow the address in use.
- **Tune the view.** Values can be shown in hex, decimal, signed decimal or binary. There are
  also light and dark themes, text size, animation speed and a choice of which wires to show.
- **Learn in place.** The built-in help has a guide, the full ISA reference, a description of
  every datapath block and a guided tour on first visit.
- **Start from an example.** Five programs are ready to load: a basic example, a FOR loop,
  IF-THEN-ELSE, branches and logic instructions. Your code can be saved and opened as `.asm`
  or `.txt`.

## The architecture

The CPU is a 16-bit multicycle Harvard machine. It is small enough to cover in one lecture and
read end to end.

| Block | Specification |
|---|---|
| Instruction memory | 256 × 16-bit words |
| Data memory | 256 × 16-bit words, initial values from the `.data` directive |
| Register file | 8 × 16-bit registers (`R0` to `R7`), two reads and one write |
| ALU | ADD, SUB, AND, OR and NOT, with **Z**, **C**, **N** and **V** flags |
| Control unit | A state machine: fetch, decode, then one path per instruction class |

### Instruction set

| Instruction | Effect | Flags |
|---|---|---|
| `LDA Rd, M` | `Rd ← DMem[M]` | Z, N |
| `LDAI Rd, N` | `Rd ← N` (signed 8-bit immediate) | Z, N |
| `STA Rs, M` | `DMem[M] ← Rs` | — |
| `ADD Ra, Rb, Rd` | `Rd ← Ra + Rb` | Z, C, N, V |
| `SUB Ra, Rb, Rd` | `Rd ← Ra − Rb` | Z, C, N, V |
| `AND Ra, Rb, Rd` | `Rd ← Ra AND Rb` | Z, C, N, V |
| `OR Ra, Rb, Rd` | `Rd ← Ra OR Rb` | Z, C, N, V |
| `NOT Ra, Rd` | `Rd ← NOT Ra` | Z, C, N, V |
| `JZ M` | if Z = 1, `PC ← M` | — |
| `JN M` | if N = 1, `PC ← M` | — |
| `JMP M` | `PC ← M` | — |
| `HLT` | stop | — |

### A sample program

```asm
        .data
SUM:    DB    0             ; R0 + R1
DIFF:   DB    0             ; R0 - R1

        .code
START:  LDAI  R0, 10        ; R0 = 10
        LDAI  R1, 6         ; R1 = 6
        ADD   R0, R1, R2    ; R2 = 16
        SUB   R0, R1, R3    ; R3 = 4
        STA   R2, SUM       ; mem[SUM] = 16
        STA   R3, DIFF      ; mem[DIFF] = 4
        LDA   R4, SUM       ; R4 = 16
        SUB   R4, R2, R5    ; R5 = 0, so Z = 1
        JZ    END
        JMP   START
END:    HLT
```

## For instructors

- **Nothing to install.** It is a web page, so it works on lab machines, student laptops and
  the projector.
- **Programs are plain text.** Hand out exercises as `.asm` files and students open them in
  the simulator.
- **Nothing leaves the browser.** There is no login and no server storing what students write.
- **Make it yours.** If your course uses a different ISA or datapath, the code is open and the
  datapath is an editable layout file. See [Running locally](#running-locally).

Used it in class? Hearing how it went helps the project a lot. Post in
[Discussions](https://github.com/richassis/cpu-didatica/discussions).

## Running locally

You need Node.js 20.9 or newer.

```bash
git clone https://github.com/richassis/cpu-didatica.git
cd cpu-didatica
npm install
npm run dev      # http://localhost:3000
```

### Student mode and editor mode

The same app has two modes, and a build flag decides which ones are available:

| | `npm run dev` | `npm run build && npm start` |
|---|---|---|
| Program mode (what students see) | yes | yes |
| Edit mode (place blocks, draw wires) | yes | no |

The flag is `NEXT_PUBLIC_ENABLE_EDITOR`. It is set in `next.config.ts` and read only in
`lib/editorFlag.ts`. To make a production build with the editor:

```bash
NEXT_PUBLIC_ENABLE_EDITOR=1 npm run build && npm start
```

### The datapath is a file

`public/default-project.cpud` is the layout everyone sees. It is read on every page load, so a
new layout reaches every user as soon as it is deployed. To change it:

1. Run `npm run dev`, switch to edit mode and move what you need.
2. Changes are written to the file by `app/api/default-project/route.ts`, a route that only
   exists while the editor is enabled. The **Salvar no arquivo** button forces a write.
3. Commit the `.cpud` file.

### Layout

```
app/             the single page, plus the layout-saving route (development only)
components/      canvas, blocks, dialogs; ProgramMode/ is the student interface
lib/             stores (Zustand), assembler, disassembler, animation
lib/simulator/   the domain: CPU, ALU, memories, registers, buses — no React
public/          default-project.cpud, the reference datapath
```

Built with [Next.js](https://nextjs.org), React, TypeScript, [Zustand](https://zustand.docs.pmnd.rs)
and Tailwind CSS.

## Contributing

Every kind of contribution is welcome: reporting a bug, suggesting an instruction, improving
the help text, writing an example program or sending code. Issues and pull requests in English
are fine.

- Found a problem? [Open an issue](https://github.com/richassis/cpu-didatica/issues/new/choose).
- Have an idea or a question? Use [Discussions](https://github.com/richassis/cpu-didatica/discussions).
- Want to code? Read the [contributing guide](CONTRIBUTING.md) and look for issues labeled
  [`good first issue`](https://github.com/richassis/cpu-didatica/labels/good%20first%20issue).

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Credits

A project of the **Center for Computational Sciences (C3)** at the
**Federal University of Rio Grande (FURG)**, Brazil.

- **Professor:** Ewerson Carvalho
- **Development:** Richard de Assis

## License

[MIT](LICENSE). You may use, modify and redistribute it, in other courses and institutions too,
as long as you keep the copyright notice.
