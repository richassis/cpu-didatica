"use client";

import { ComponentInstance } from "@/lib/store";
import LabelWidget from "./widgets/LabelWidget";
import ValueDisplayWidget from "./widgets/ValueDisplayWidget";
import GprComponent from "./widgets/GprComponent";
import MemoryComponent from "./widgets/MemoryComponent";
import UlaComponent from "./widgets/UlaComponent";
import RegisterComponent from "./widgets/RegisterComponent";

interface Props {
  component: ComponentInstance;
  zoom: number;
}

export default function WidgetRenderer({ component, zoom }: Props) {
  switch (component.type) {
    case "LabelWidget":
      return <LabelWidget component={component} zoom={zoom} />;
    case "ValueDisplayWidget":
      return <ValueDisplayWidget component={component} zoom={zoom} />;
    case "GprComponent":
      return <GprComponent component={component} zoom={zoom} />;
    case "MemoryComponent":
      return <MemoryComponent component={component} zoom={zoom} />;
    case "UlaComponent":
      return <UlaComponent component={component} zoom={zoom} />;
    case "Register":
        return <RegisterComponent component={component} zoom={zoom} />;

    default:
      return null;
  }
}
