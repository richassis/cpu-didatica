import type { Messages } from "../index";
import { common } from "./common";

export const help: Messages["help"] = {
  dialog: {
    aria: common.ui.help,
    tablistAria: "Help sections",
    close: "Close help",
    tabs: {
      guide: "Guide",
      isa: "ISA",
      datapath: "Datapath",
      feedback: "Feedback",
      credits: "Credits",
    },
  },

  guide: {
    replayTour: "Replay the tour",
    replayWelcome: "Show the welcome again",

    howTo: {
      heading: "How to use the simulator",
      steps: {
        write: {
          title: "Write the program",
          body: () => (
            <>
              In the <b className="text-fg">{common.ui.assemblyPanel}</b> column, write in assembly or pick an
              example under <i>{common.ui.program}</i>. You can also open and save text files from the top
              bar.
            </>
          ),
        },
        assemble: {
          title: "Assemble",
          body: () => (
            <>
              <b className="text-fg">{common.ui.assemble}</b> translates the text into 16-bit words, which appear
              under <b className="text-fg">{common.ui.machinePanel}</b> along with each instruction&apos;s address and
              the data table. Errors appear below the code, with the line number.
            </>
          ),
        },
        simulate: {
          title: "Simulate",
          body: () => (
            <>
              <b className="text-fg">{common.ui.simulate}</b> runs the program up to HLT and opens the timeline. Use
              the player: step one tick back or forward, play everything, jump to the start or the end, and
              drag the slider to go to any tick.
            </>
          ),
        },
        follow: {
          title: "Follow the datapath",
          body: () => (
            <>
              Each tick is a state of the CU. Components light up when they act, the dots show values
              traveling along the wires, and the counter shows the tick. The list buttons on the memories
              open both memories side by side, in place of the code.
            </>
          ),
        },
      },
    },

    assembly: {
      heading: "Writing assembly",
      example: `        .data
SUM:    DB    0            ; variable, starts at 0

        .code
        LDAI  R0, 10       ; R0 = 10
        LDAI  R1, 6        ; R1 = 6
        ADD   R0, R1, R2   ; R2 = R0 + R1
        STA   R2, SUM      ; DMem[SUM] = R2
        HLT`,
      comment: () => (
        <><span className="font-mono text-fg">;</span> starts a comment that runs to the end of the line.</>
      ),
      registers: () => (
        <>
          <span className="font-mono text-fg">R0</span> to <span className="font-mono text-fg">R7</span> are
          the registers; upper and lower case are the same.
        </>
      ),
      label: () => (
        <>
          A <b className="text-fg">label</b> (<span className="font-mono text-fg">LOOP:</span>) names an
          address and can be the target of <span className="font-mono text-fg">JMP</span>,{" "}
          <span className="font-mono text-fg">JZ</span> and{" "}
          <span className="font-mono text-fg">JN</span>.
        </>
      ),
      sections: () => (
        <>
          <span className="font-mono text-fg">.data</span> opens the variables section and{" "}
          <span className="font-mono text-fg">.code</span> (or <span className="font-mono text-fg">.text</span>)
          goes back to code. Each line <span className="font-mono text-fg">NAME: DB value</span> reserves
          one word of data memory, in the order it appears, with its initial value (0 if omitted).
        </>
      ),
      numbers: () => (
        <>
          Variables (<span className="font-mono text-fg">DB</span>) are 16 bits wide and can be written in:
        </>
      ),
      formats: {
        decimal: "decimal",
        hexadecimal: "hexadecimal",
        binary: "binary",
      },
      immediate: () => (
        <>
          <b className="text-fg">Careful:</b> in <span className="font-mono text-fg">LDAI</span> the
          immediate is only 8 bits: it ranges from −128 to 127. Values from 128 to 255 are accepted too,
          but bit 7 is sign-extended and they become negative
          (<span className="font-mono text-fg">LDAI R0, 200</span> loads −56). Memory addresses
          range from 0 to 255.
        </>
      ),
    },

    shortcutsHeading: "Shortcuts",

    settings: {
      heading: `${common.ui.settings} and top bar`,
      values: () => (
        <>
          <b className="text-fg">Values:</b> the base numbers are shown in — hex, dec+ (unsigned),
          dec± (signed, two&apos;s complement) and bin. Control signals, flags, addresses, opcodes and
          instructions are never shown signed.
        </>
      ),
      signals: () => (
        <>
          <b className="text-fg">Signals:</b> show or hide the wires; and, among them, only the control
          ones or only the data ones.
        </>
      ),
      speed: () => (
        <>
          <b className="text-fg">Speed:</b> from Low to High, the same speed on every wire. Hold the
          fast-forward button (or the F key) to speed up just the tick in progress.
        </>
      ),
      zoom: () => (
        <>
          <b className="text-fg">Zoom:</b> the − and + buttons zoom in and out; the percentage fits the
          drawing to the screen. There is also a light and a dark theme.
        </>
      ),
    },

    legendHeading: "Diagram legend",

    presets: {
      heading: "Example programs",
      load: "load",
      loadTitle: "Load this program into the editor",
      lockedTitle: "Stop the simulation to change the program",
    },
  },

  shortcuts: {
    items: [
      { keys: "Space", note: "play / pause" },
      { keys: "← →", note: "one tick back / forward" },
      { keys: "Home", note: "go to the start" },
      { keys: "End", note: "go to the end, without animating" },
      { keys: "F (hold)", note: "speed up the animation in progress" },
      { keys: "Esc", note: "close windows and panels" },
    ],
    note:
      "The playback shortcuts (Space, arrows, Home, End and F) work while the timeline is active, " +
      `after ${common.ui.simulate}. Keyboard shortcuts are off while you type in the editor.`,
  },

  feedback: {
    heading: "Your feedback helps the simulator improve",
    intro:
      "Tell us what worked, what was confusing and what was missing. Write here and the simulator " +
      "opens your email app with the message ready to send.",
    kindAria: "Feedback type",
    kinds: {
      suggestion: {
        label: "Suggestion",
        placeholder: "An idea for improvement: what would you like the simulator to do or show?",
      },
      problem: {
        label: "Problem",
        placeholder: "What you did, what you expected to happen and what actually happened.",
      },
      praise: {
        label: "Praise",
        placeholder: "What worked well, what helped you understand the CPU.",
      },
    },
    messageAria: "Message",
    writeEmail: "Write email",
    fallback: "If the email does not open, send it to",
    copy: "Copy",
    copied: "Copied",
    privacy:
      "The email goes out from your own email app, and only when you send it: the simulator sends " +
      "nothing on its own. Your program's code is not included.",
    context: {
      browser: "Browser",
      date: "Date",
    },
  },

  credits: {
    tagline:
      "A teaching CPU simulator for following, tick by tick, the datapath as it runs an assembly " +
      "program.",
    projectOf: (university) => (
      <>
        A project of <b>{university}</b>
      </>
    ),
    professor: "Professor",
    student: "Student",
    openSource: "The code is open source. Want to contribute? Suggestions, issues and pull requests are welcome.",
    repository: "Project on GitHub",
  },
};
