"use client";

import { Props } from "@/lib/store";
import NodeShell from "@/components/widgets/NodeShell";

/**
 * A plain adder.
 *
 * Deliberately shows no operands and no result: it is secondary hardware, and
 * putting numbers in it next to the ALU made it read as equally important. Its
 * values are legible on the wires and in the port tooltips.
 *
 * Same trapezoid family as the ALU but without the V notch — that absence is
 * what says "always adds" rather than "computes a selected operation".
 */
export default function AdderComponent({ component, zoom }: Props) {
  return <NodeShell component={component} zoom={zoom} silhouette="adder" />;
}
