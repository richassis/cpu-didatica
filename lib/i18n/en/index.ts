import type { Messages } from "../index";
import { common } from "./common";
import { assembler } from "./assembler";
import { errors } from "./errors";
import { canvas } from "./canvas";
import { bar } from "./bar";
import { program } from "./program";
import { legend } from "./legend";
import { onboarding } from "./onboarding";
import { help } from "./help";
import { reference } from "./reference";

export const en: Messages = { common, assembler, errors, canvas, bar, program, legend, onboarding, help, reference };
