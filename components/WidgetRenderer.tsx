"use client";

import { ComponentInstance } from "@/lib/store";
import LabelWidget from "./widgets/LabelWidget";
import ValueDisplayWidget from "./widgets/ValueDisplayWidget";
import GprComponent from "./widgets/GprComponent";
import MemoryComponent from "./widgets/MemoryComponent";
import UlaComponent from "./widgets/UlaComponent";
import AdderComponent from "./widgets/AdderComponent";
import MuxComponent from "./widgets/MuxComponent";
import RegisterComponent from "./widgets/RegisterComponent";
import DecoderComponent from "./widgets/DecoderComponent";
import CpuComponent from "./widgets/CpuComponent";
import PortTooltipWrapper from "./PortTooltipWrapper";
import WidgetWithPorts from "./WidgetWithPorts";

interface Props {
  component: ComponentInstance;
  zoom: number;
}

// Components that have ports (Connectable)
const CONNECTABLE_TYPES = ["Register", "GprComponent", "UlaComponent", "AdderComponent", "MuxComponent", "MemoryComponent", "CpuComponent", "DecoderComponent"];

export default function WidgetRenderer({ component, zoom }: Props) {
  const isConnectable = CONNECTABLE_TYPES.includes(component.type);

  const renderWidget = () => {
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
  };

  const widget = renderWidget();
  if (!widget) return null;

  // Wrap connectable components with tooltip only
  if (isConnectable) {
    return (
      <PortTooltipWrapper componentId={component.id} componentLabel={component.label}>
        {widget}
      </PortTooltipWrapper>
    );
  }

  return widget;
}
