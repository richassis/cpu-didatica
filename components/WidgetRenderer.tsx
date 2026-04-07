"use client";

import { ComponentInstance } from "@/lib/store";
import GprComponent from "./widgets/GprComponent";
import MemoryComponent from "./widgets/MemoryComponent";
import InstructionMemoryComponent from "./widgets/InstructionMemoryComponent";
import UlaComponent from "./widgets/UlaComponent";
import AdderComponent from "./widgets/AdderComponent";
import MuxComponent from "./widgets/MuxComponent";
import RegisterComponent from "./widgets/RegisterComponent";
import DecoderComponent from "./widgets/DecoderComponent";
import CpuComponent from "./widgets/CpuComponent";

interface Props {
  component: ComponentInstance;
  zoom: number;
}

export default function WidgetRenderer({ component, zoom }: Props) {
  switch (component.type) {
    case "GprComponent":
      return <GprComponent component={component} zoom={zoom} />;
    case "MemoryComponent":
      return <MemoryComponent component={component} zoom={zoom} />;
    case "InstructionMemoryComponent":
      return <InstructionMemoryComponent component={component} zoom={zoom} />;
    case "UlaComponent":
      return <UlaComponent component={component} zoom={zoom} />;
    case "AdderComponent":
      return <AdderComponent component={component} zoom={zoom} />;
    case "MuxComponent":
      return <MuxComponent component={component} zoom={zoom} />;
    case "Register":
      return <RegisterComponent component={component} zoom={zoom} />;
    case "DecoderComponent":
      return <DecoderComponent component={component} zoom={zoom} />;
    case "CpuComponent":
      return <CpuComponent component={component} zoom={zoom} />;
    default:
      return null;
  }
}
