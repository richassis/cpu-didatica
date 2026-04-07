"use client";

import { useState, useEffect } from "react";
import { 
  INSTRUCTION_SET, 
  Opcode, 
  encodeInstruction,
  type InstructionDescriptor,
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

  // Reset fields when mnemonic changes
  useEffect(() => {
    setGprAddr(0);
    setOperand(0);
    setSrcA(0);
    setSrcB(0);
    setDst(0);
  }, [selectedMnemonic]);

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
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-indigo-300">Instruction Builder</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Address Selection */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-400 min-w-[100px]">Address:</label>
        <select
          value={selectedAddress}
          onChange={(e) => setSelectedAddress(Number(e.target.value))}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
        >
          {addressOptions.map((addr) => (
            <option key={addr} value={addr}>
              {formatHex(addr, 8)}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          Current: <span className="text-gray-300 font-mono">{formatHex(currentValue, 16)}</span>
        </span>
      </div>

      {/* Opcode Selection */}
      <div className="flex items-start gap-4">
        <label className="text-sm text-gray-400 min-w-[100px] pt-2">Opcode:</label>
        <div className="flex-1">
          <select
            value={selectedMnemonic}
            onChange={(e) => setSelectedMnemonic(e.target.value as keyof typeof Opcode)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 mb-2"
          >
            {(Object.keys(INSTRUCTION_SET) as Array<keyof typeof Opcode>).map((mnemonic) => (
              <option key={mnemonic} value={mnemonic}>
                {mnemonic} - {INSTRUCTION_SET[mnemonic].description}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 italic">{descriptor.description}</p>
        </div>
      </div>

      {/* Dynamic Fields Based on Format */}
      <div className="border-t border-gray-700 pt-4">
        {descriptor.format === "standard" ? (
          <>
            {/* Standard Format Fields */}
            {(descriptor as StandardDescriptor).usesGPR && (
              <div className="flex items-center gap-4 mb-3">
                <label className="text-sm text-gray-400 min-w-[100px]">GPR Address:</label>
                <select
                  value={gprAddr}
                  onChange={(e) => setGprAddr(Number(e.target.value))}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                <label className="text-sm text-gray-400 min-w-[100px]">Operand (8-bit):</label>
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
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="0x00"
                />
                <span className="text-xs text-gray-500">Range: 0x00-0xFF</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ULA Format Fields */}
            <div className="flex items-center gap-4 mb-3">
              <label className="text-sm text-gray-400 min-w-[100px]">Source A:</label>
              <select
                value={srcA}
                onChange={(e) => setSrcA(Number(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
                <label className="text-sm text-gray-400 min-w-[100px]">Source B:</label>
                <select
                  value={srcB}
                  onChange={(e) => setSrcB(Number(e.target.value))}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
              <label className="text-sm text-gray-400 min-w-[100px]">Destination:</label>
              <select
                value={dst}
                onChange={(e) => setDst(Number(e.target.value))}
                className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
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
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Instruction Encoding:</h4>
        
        {/* Binary Breakdown */}
        <div className="bg-gray-950 border border-gray-700 rounded p-3 mb-3 font-mono text-xs">
          {descriptor.format === "standard" ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-gray-500 mb-1">OPCODE</div>
                <div className="text-indigo-300 font-bold">{breakdown.opcodeBits}</div>
                <div className="text-gray-600 text-[10px]">[15:11]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">GPR</div>
                <div className="text-green-300 font-bold">{breakdown.field1}</div>
                <div className="text-gray-600 text-[10px]">[10:8]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">OPERAND</div>
                <div className="text-cyan-300 font-bold">{breakdown.field2}</div>
                <div className="text-gray-600 text-[10px]">[7:0]</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 text-center">
              <div>
                <div className="text-gray-500 mb-1">OPCODE</div>
                <div className="text-indigo-300 font-bold">{breakdown.opcodeBits}</div>
                <div className="text-gray-600 text-[10px]">[15:11]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">SRC_A</div>
                <div className="text-green-300 font-bold">{breakdown.srcABits}</div>
                <div className="text-gray-600 text-[10px]">[10:8]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">SRC_B</div>
                <div className="text-cyan-300 font-bold">{breakdown.srcBBits}</div>
                <div className="text-gray-600 text-[10px]">[7:5]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">PAD</div>
                <div className="text-gray-600 font-bold">{breakdown.padBits}</div>
                <div className="text-gray-600 text-[10px]">[4:3]</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">DST</div>
                <div className="text-orange-300 font-bold">{breakdown.dstBits}</div>
                <div className="text-gray-600 text-[10px]">[2:0]</div>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-400">Hex: </span>
            <span className="text-lg font-mono font-bold text-indigo-300">
              {formatHex(encodedValue, 16)}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-400">Binary: </span>
            <span className="text-xs font-mono text-gray-300">
              {formatBinary(encodedValue, 16)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSet}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          Set Instruction
        </button>
        <button
          onClick={handleClear}
          className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onClose}
          className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
