"use client";

import { useState } from "react";
import { 
  INSTRUCTION_SET, 
  Opcode, 
  encodeInstruction,
  type StandardDescriptor,
  type ULADescriptor
} from "@/lib/simulator/ISA";
import type { InstructionMemory } from "@/lib/simulator/InstructionMemory";

interface Props {
  imem: InstructionMemory;
  onClose: () => void;
  initialAddress?: number;
}

const REGISTER_NAMES = ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7"];

export default function InstructionBuilder({ imem, onClose, initialAddress = 0 }: Props) {
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);
  const [selectedMnemonic, setSelectedMnemonic] = useState<keyof typeof Opcode>("LDA");
  const [gprAddr, setGprAddr] = useState(0);
  const [operand, setOperand] = useState(0);
  const [srcA, setSrcA] = useState(0);
  const [srcB, setSrcB] = useState(0);
  const [dst, setDst] = useState(0);

  const descriptor = INSTRUCTION_SET[selectedMnemonic];
  const currentValue = imem.peek(selectedAddress);
  
  // Calculate the encoded instruction
  const encodedValue = encodeInstruction(selectedMnemonic, {
    gprAddr,
    operand,
    srcA,
    srcB,
    dst,
  });

  const handleMnemonicChange = (value: keyof typeof Opcode) => {
    setSelectedMnemonic(value);
    setGprAddr(0);
    setOperand(0);
    setSrcA(0);
    setSrcB(0);
    setDst(0);
  };

  const handleSet = () => {
    imem.poke(selectedAddress, encodedValue);
    onClose();
  };

  const handleClear = () => {
    imem.poke(selectedAddress, 0);
    onClose();
  };

  // Generate address options
  const addressOptions = Array.from({ length: imem.wordCount }, (_, i) => i);

  // Format numbers
  const formatHex = (value: number, bits: number) => {
    const digits = Math.ceil(bits / 4);
    return "0x" + value.toString(16).toUpperCase().padStart(digits, "0");
  };

  const formatBinary = (value: number, bits: number) => {
    return value.toString(2).padStart(bits, "0");
  };

  // Get binary breakdown
  const getBinaryBreakdown = () => {
    const opcodeBits = formatBinary((encodedValue >> 11) & 0b11111, 5);
    
    if (descriptor.format === "standard") {
      const gprBits = formatBinary((encodedValue >> 8) & 0b111, 3);
      const operandBits = formatBinary(encodedValue & 0xFF, 8);
      return { opcodeBits, field1: gprBits, field2: operandBits };
    } else {
      const srcABits = formatBinary((encodedValue >> 8) & 0b111, 3);
      const srcBBits = formatBinary((encodedValue >> 5) & 0b111, 3);
      const padBits = formatBinary((encodedValue >> 3) & 0b11, 2);
      const dstBits = formatBinary(encodedValue & 0b111, 3);
      return { opcodeBits, srcABits, srcBBits, padBits, dstBits };
    }
  };

  const breakdown = getBinaryBreakdown();

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface rounded-lg border border-line max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="t-panel text-fg">Instruction builder</h3>
        <button
          onClick={onClose}
          className="text-fg-muted hover:text-fg text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Address Selection */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-fg-muted min-w-[100px]">Address:</label>
        <select
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(Number(e.target.value))}
          className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active"
        >
          {addressOptions.map((addr) => (
            <option key={addr} value={addr}>
              {formatHex(addr, 8)}
            </option>
          ))}
        </select>
        <span className="text-sm text-fg-muted">
          Current: <span className="text-fg font-mono">{formatHex(currentValue, 16)}</span>
        </span>
      </div>

      {/* Opcode Selection */}
      <div className="flex items-start gap-4">
        <label className="text-sm text-fg-muted min-w-[100px] pt-2">Opcode:</label>
        <div className="flex-1">
          <select
            value={selectedMnemonic}
            onChange={(e) => handleMnemonicChange(e.target.value as keyof typeof Opcode)}
            className="w-full bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active mb-2"
          >
            {(Object.keys(INSTRUCTION_SET) as Array<keyof typeof Opcode>).map((mnemonic) => (
              <option key={mnemonic} value={mnemonic}>
                {mnemonic} - {INSTRUCTION_SET[mnemonic].description}
              </option>
            ))}
          </select>
          <p className="text-xs text-fg-muted italic">{descriptor.description}</p>
        </div>
      </div>

      {/* Dynamic Fields Based on Format */}
      <div className="border-t border-line pt-4">
        {descriptor.format === "standard" ? (
          <>
            {/* Standard Format Fields */}
            {(descriptor as StandardDescriptor).usesGPR && (
              <div className="flex items-center gap-4 mb-3">
                <label className="text-sm text-fg-muted min-w-[100px]">GPR Address:</label>
                <select
                  value={gprAddr}
                  onChange={(e) => setGprAddr(Number(e.target.value))}
                  className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active"
                >
                  {REGISTER_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name} (0b{idx.toString(2).padStart(3, "0")})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(descriptor as StandardDescriptor).usesOperand && (
              <div className="flex items-center gap-4">
                <label className="text-sm text-fg-muted min-w-[100px]">Operand (8-bit):</label>
                <input
                  type="text"
                  value={formatHex(operand, 8)}
                  onChange={(e) => {
                    const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "");
                    const val = parseInt(hex || "0", 16);
                    if (!isNaN(val) && val <= 0xFF) {
                      setOperand(val);
                    }
                  }}
                  className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg font-mono focus:outline-none focus:border-st-active"
                  placeholder="0x00"
                />
                <span className="text-xs text-fg-muted">Range: 0x00-0xFF</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ULA Format Fields */}
            <div className="flex items-center gap-4 mb-3">
              <label className="text-sm text-fg-muted min-w-[100px]">Source A:</label>
              <select
                value={srcA}
                onChange={(e) => setSrcA(Number(e.target.value))}
                className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active"
              >
                {REGISTER_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name} (0b{idx.toString(2).padStart(3, "0")})
                  </option>
                ))}
              </select>
            </div>
            {(descriptor as ULADescriptor).usesSrcB && (
              <div className="flex items-center gap-4 mb-3">
                <label className="text-sm text-fg-muted min-w-[100px]">Source B:</label>
                <select
                  value={srcB}
                  onChange={(e) => setSrcB(Number(e.target.value))}
                  className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active"
                >
                  {REGISTER_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name} (0b{idx.toString(2).padStart(3, "0")})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="text-sm text-fg-muted min-w-[100px]">Destination:</label>
              <select
                value={dst}
                onChange={(e) => setDst(Number(e.target.value))}
                className="flex-1 bg-sunken border border-line rounded px-3 py-2 text-fg focus:outline-none focus:border-st-active"
              >
                {REGISTER_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name} (0b{idx.toString(2).padStart(3, "0")})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Encoding Display */}
      <div className="border-t border-line pt-4">
        <h4 className="t-section mb-3">Instruction encoding</h4>
        
        {/* Binary Breakdown */}
        <div className="bg-canvas border border-line rounded p-3 mb-3 font-mono text-xs">
          {descriptor.format === "standard" ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-fg-muted mb-1">OPCODE</div>
                <div className="text-fg font-medium">{breakdown.opcodeBits}</div>
                <div className="text-fg-faint text-[10px]">[15:11]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">GPR</div>
                <div className="text-st-active font-medium">{breakdown.field1}</div>
                <div className="text-fg-faint text-[10px]">[10:8]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">OPERAND</div>
                <div className="text-fg font-medium">{breakdown.field2}</div>
                <div className="text-fg-faint text-[10px]">[7:0]</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 text-center">
              <div>
                <div className="text-fg-muted mb-1">OPCODE</div>
                <div className="text-fg font-medium">{breakdown.opcodeBits}</div>
                <div className="text-fg-faint text-[10px]">[15:11]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">SRC_A</div>
                <div className="text-st-active font-medium">{breakdown.srcABits}</div>
                <div className="text-fg-faint text-[10px]">[10:8]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">SRC_B</div>
                <div className="text-fg font-medium">{breakdown.srcBBits}</div>
                <div className="text-fg-faint text-[10px]">[7:5]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">PAD</div>
                <div className="text-fg-faint font-medium">{breakdown.padBits}</div>
                <div className="text-fg-faint text-[10px]">[4:3]</div>
              </div>
              <div>
                <div className="text-fg-muted mb-1">DST</div>
                <div className="text-st-warn font-medium">{breakdown.dstBits}</div>
                <div className="text-fg-faint text-[10px]">[2:0]</div>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-fg-muted">Hex: </span>
            <span className="num font-mono text-lg text-fg">
              {formatHex(encodedValue, 16)}
            </span>
          </div>
          <div>
            <span className="text-sm text-fg-muted">Binary: </span>
            <span className="text-xs font-mono text-fg">
              {formatBinary(encodedValue, 16)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-line">
        <button
          onClick={handleSet}
          className="flex-1 rounded-lg border border-line-strong bg-raised px-4 py-2 text-xs text-fg transition-colors hover:border-st-active"
        >
          Set instruction
        </button>
        <button
          onClick={handleClear}
          className="rounded-lg border border-line px-4 py-2 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          Clear
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
