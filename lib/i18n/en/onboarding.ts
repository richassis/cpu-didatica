import type { Messages } from "../index";
import { common } from "./common";

const ui = common.ui;

export const onboarding: Messages["onboarding"] = {
  splash: {
    subtitle: "Datapath simulator",
    projectOf: "A project of",
    professor: "Professor",
    student: "Student",
    continue: "Continue",
    continueHint: "click or press Enter",
  },

  welcome: {
    ariaLabel: "Welcome",
    title: "Welcome to CPU Didática",
    intro:
      "A simulator to watch, tick by tick, how a CPU runs a program: from the instruction in memory to the result written to the register.",
    points: {
      write: { title: "Write in assembly", body: "A short program, or one of the ready-made examples." },
      assemble: { title: "Assemble and simulate", body: "Watch the text turn into 16-bit words and the program run." },
      follow: { title: "Follow every tick", body: "Values travel through the datapath, step by step." },
    },
    takeTour: "Take the tour",
    explore: "Explore on my own",
    openHelp: "Open the help",
  },

  tour: {
    ariaLabel: (title) => `Tour: ${title}`,
    stepOf: (n, total) => `${n} of ${total}`,
    skip: "Skip tour",
    back: "Back",
    finish: "Finish",
    doItForMe: "Do it for me",
    steps: {
      intro: {
        title: "Let's take a look around",
        body: `In a few steps you'll see where to write a program, how to run it and how to follow each tick in the datapath. Use ${ui.next} or the arrow keys. Esc leaves at any time.`,
      },
      editor: {
        title: ui.assemblyPanel,
        body: `This is where you write the program in assembly, or pick an example under ${ui.program}. Each line is one CPU instruction.`,
      },
      assemble: {
        title: ui.assemble,
        body: `${ui.assemble} translates the text into 16-bit words, the ones the CPU actually understands.`,
        hint: `Click ${ui.assemble} to continue.`,
      },
      machine: {
        title: ui.machinePanel,
        body: "The output of the assembler: each instruction's address, its 16-bit word and its opcode. The program's variables are listed below.",
      },
      simulate: {
        title: ui.simulate,
        body: `${ui.simulate} runs the program up to HLT and opens the timeline: you can step through every tick, forward and back.`,
        hint: `Click ${ui.simulate} to continue.`,
      },
      player: {
        title: "Player and counter",
        body: "Step back or forward one tick, play it all, or drag the bar to jump to any tick. Hold F to speed up the running animation. The counter shows which tick you're on.",
      },
      datapath: {
        title: "The datapath",
        body: "This is where the CPU does its work. Components light up when they act, and the dots show values travelling along the wires. Hover over a port to see its value.",
      },
      controlUnit: {
        title: "The control unit",
        body: "The CU runs the show: the drawing shows which state it is in, and the strip below shows the control signals it sends out in each state.",
      },
      memories: {
        title: "The memories",
        body: "This button opens the instruction and data memories side by side, in place of the code, so you can see what they hold while the simulation runs.",
      },
      settings: {
        title: ui.settings,
        body: "Here you choose the number base (hex, decimal, binary), which wires to show, the animation speed and the text size.",
      },
      zoom: {
        title: "Zoom",
        body: "Zoom the drawing in or out. Clicking the percentage fits everything to the screen.",
      },
      help: {
        title: ui.help,
        body: "Here you'll find the guide, the instruction table and the encoder, the datapath with its control signals, the credits and feedback. You can replay this tour from there. Enjoy exploring!",
      },
    },
  },
};
