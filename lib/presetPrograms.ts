import type { Locale } from "@/lib/locale";

/**
 * An example program, written once per language: the comments and the label
 * names are translated, the instructions and data are the same, so every
 * version assembles to the same words.
 */
export interface PresetProgram {
  id: string;
  name: Readonly<Record<Locale, string>>;
  source: Readonly<Record<Locale, string>>;
}

// Column widths used throughout:  LABEL(8) + MNEMONIC(6) + OPERANDS + COMMENT
// Blank label = 8 spaces; directives start at mnemonic column (8 spaces indent)

const BASICO_PT = `\
; ── Exemplo Básico ──────────────────────────────────────────────────────────
; Demonstra: carga imediata, operações ULA, memória e desvio condicional.
; Resultado esperado: R2=16, R3=4, mem[SOMA]=16, mem[DIFF]=4

        .data
SOMA:   DB    0             ; resultado de R0 + R1
DIFF:   DB    0             ; resultado de R0 - R1

        .code
INICIO: LDAI  R0, 10       ; R0 = 10
        LDAI  R1, 6        ; R1 = 6
        ADD   R0, R1, R2    ; R2 = R0 + R1 = 16
        SUB   R0, R1, R3    ; R3 = R0 - R1 = 4
        STA   R2, SOMA      ; mem[SOMA] = 16
        STA   R3, DIFF      ; mem[DIFF] = 4
        LDA   R4, SOMA      ; R4 = mem[SOMA] = 16
        SUB   R4, R2, R5    ; R5 = R4 - R2 (deve ser zero)
        JZ    FIM
        JMP   INICIO

FIM:    HLT
`;

const FOR_CONTADOR_PT = `\
; ── FOR — Contador ──────────────────────────────────────────────────────────
; Simula um laço do { cnt++; } while (cnt != END) usando ADD, SUB e JZ:
; o contador sai de 1 e para em 5, então o corpo roda 4 vezes.
; Resultado esperado: R0=5, mem[CNT]=5

        .data
CNT:    DB    01h          ; valor inicial do contador
END:    DB    05h          ; valor limite

        .code
        LDA   R0, CNT       ; R0 = CNT
        LDA   R1, END       ; R1 = END
        LDAI  R2, 1        ; R2 = 1 (passo)

CONTA:  ADD   R0, R2, R0   ; R0 = R0 + 1
        STA   R0, CNT       ; salva contador na memória
        SUB   R1, R0, R3   ; R3 = END - R0
        JZ    FIM           ; se END == R0, termina
        JMP   CONTA

FIM:    HLT
`;

const IF_THEN_ELSE_PT = `\
; ── IF-THEN-ELSE ────────────────────────────────────────────────────────────
; Compara N1 e N2; marca 1 na variável correspondente ao resultado.
; Resultado esperado (N1=3, N2=4): mem[NmenorN2]=1

        .data
N1:     DB    3             ; primeiro número
N2:     DB    4             ; segundo número
NmenorN2: DB  0             ; 1 se N1 < N2
NmaiorN2: DB  0             ; 1 se N1 > N2
NigualN2: DB  0             ; 1 se N1 == N2

        .code
        LDA   R1, N1        ; R1 = N1
        LDA   R2, N2        ; R2 = N2
        LDAI  R3, 1        ; R3 = 1 (constante)

TESTA:  SUB   R2, R1, R0   ; R0 = N2 - N1
        JZ    IGUAL         ; N2 == N1
        JN    MAIOR         ; N2 < N1 → N1 é maior

MENOR:  STA   R3, NmenorN2 ; N1 < N2
        JMP   FIM

MAIOR:  STA   R3, NmaiorN2 ; N1 > N2
        JMP   FIM

IGUAL:  STA   R3, NigualN2 ; N1 == N2

FIM:    HLT
`;

const DESVIOS_PT = `\
; ── Desvios Condicionais ────────────────────────────────────────────────────
; Testa JZ (desvio se zero), JN (desvio se negativo) e JMP (incondicional).
; Resultado esperado: mem[OK]=1

        .data
OK:     DB    0             ; resultado (1=sucesso, 0=falha)

        .code
        LDAI  R7, 1        ; R7 = 1 (constante de sucesso)
        LDAI  R0, 0        ; R0 = 0

        ; Teste JZ: 0 - 0 deve ser zero → deve saltar
        SUB   R0, R0, R1   ; R1 = 0
        JZ    T_JN          ; deve saltar (zero) → ok
        JMP   FIM           ; erro se chegar aqui

T_JN:   LDAI  R2, 5       ; R2 = 5
        LDAI  R3, 10       ; R3 = 10
        SUB   R2, R3, R4   ; R4 = 5 - 10 < 0 (negativo)
        JN    T_JMP         ; deve saltar (negativo) → ok
        JMP   FIM           ; erro se chegar aqui

T_JMP:  JMP   SUCESSO      ; deve saltar (incondicional) → ok
        JMP   FIM           ; erro se chegar aqui

SUCESSO: STA  R7, OK       ; OK = 1

FIM:    HLT
`;

const LOGICO_PT = `\
; ── Instruções Lógicas ──────────────────────────────────────────────────────
; Demonstra AND, OR e NOT com padrões de bits de 16 bits.
; Entradas: R0=85 (01010101), R1=51 (00110011)
; Resultados: AND=17, OR=119, NOT(85)=0xFFAA (−86)

        .data
RES_AND: DB   0             ; resultado de R0 AND R1
RES_OR:  DB   0             ; resultado de R0 OR R1
RES_NOT: DB   0             ; resultado de NOT R0

        .code
        LDAI  R0, 85       ; R0 = 01010101
        LDAI  R1, 51       ; R1 = 00110011
        AND   R0, R1, R2   ; R2 = R0 AND R1 = 00010001 = 17
        OR    R0, R1, R3   ; R3 = R0 OR  R1 = 01110111 = 119
        NOT   R0, R4        ; R4 = NOT R0    = 11111111 10101010 = 0xFFAA (−86)
        STA   R2, RES_AND
        STA   R3, RES_OR
        STA   R4, RES_NOT
        HLT
`;

const BASICO_EN = `\
; ── Basic Example ───────────────────────────────────────────────────────────
; Shows: immediate load, ALU operations, memory and a conditional branch.
; Expected result: R2=16, R3=4, mem[SUM]=16, mem[DIFF]=4

        .data
SUM:    DB    0             ; result of R0 + R1
DIFF:   DB    0             ; result of R0 - R1

        .code
START:  LDAI  R0, 10       ; R0 = 10
        LDAI  R1, 6        ; R1 = 6
        ADD   R0, R1, R2    ; R2 = R0 + R1 = 16
        SUB   R0, R1, R3    ; R3 = R0 - R1 = 4
        STA   R2, SUM       ; mem[SUM] = 16
        STA   R3, DIFF      ; mem[DIFF] = 4
        LDA   R4, SUM       ; R4 = mem[SUM] = 16
        SUB   R4, R2, R5    ; R5 = R4 - R2 (should be zero)
        JZ    DONE
        JMP   START

DONE:   HLT
`;

const FOR_CONTADOR_EN = `\
; ── FOR — Counter ───────────────────────────────────────────────────────────
; Simulates a loop do { cnt++; } while (cnt != END) using ADD, SUB and JZ:
; the counter starts at 1 and stops at 5, so the body runs 4 times.
; Expected result: R0=5, mem[CNT]=5

        .data
CNT:    DB    01h          ; initial counter value
END:    DB    05h          ; limit value

        .code
        LDA   R0, CNT       ; R0 = CNT
        LDA   R1, END       ; R1 = END
        LDAI  R2, 1        ; R2 = 1 (step)

LOOP:   ADD   R0, R2, R0   ; R0 = R0 + 1
        STA   R0, CNT       ; store the counter in memory
        SUB   R1, R0, R3   ; R3 = END - R0
        JZ    DONE          ; if END == R0, stop
        JMP   LOOP

DONE:   HLT
`;

const IF_THEN_ELSE_EN = `\
; ── IF-THEN-ELSE ────────────────────────────────────────────────────────────
; Compares N1 and N2; writes 1 to the variable that matches the result.
; Expected result (N1=3, N2=4): mem[N1_LT_N2]=1

        .data
N1:     DB    3             ; first number
N2:     DB    4             ; second number
N1_LT_N2: DB  0             ; 1 if N1 < N2
N1_GT_N2: DB  0             ; 1 if N1 > N2
N1_EQ_N2: DB  0             ; 1 if N1 == N2

        .code
        LDA   R1, N1        ; R1 = N1
        LDA   R2, N2        ; R2 = N2
        LDAI  R3, 1        ; R3 = 1 (constant)

TEST:   SUB   R2, R1, R0   ; R0 = N2 - N1
        JZ    EQUAL         ; N2 == N1
        JN    GREATER       ; N2 < N1 → N1 is greater

LESS:   STA   R3, N1_LT_N2 ; N1 < N2
        JMP   DONE

GREATER: STA  R3, N1_GT_N2 ; N1 > N2
        JMP   DONE

EQUAL:  STA   R3, N1_EQ_N2 ; N1 == N2

DONE:   HLT
`;

const DESVIOS_EN = `\
; ── Conditional Branches ────────────────────────────────────────────────────
; Tests JZ (branch if zero), JN (branch if negative) and JMP (unconditional).
; Expected result: mem[OK]=1

        .data
OK:     DB    0             ; result (1=success, 0=failure)

        .code
        LDAI  R7, 1        ; R7 = 1 (success constant)
        LDAI  R0, 0        ; R0 = 0

        ; JZ test: 0 - 0 must be zero → must branch
        SUB   R0, R0, R1   ; R1 = 0
        JZ    T_JN          ; must branch (zero) → ok
        JMP   DONE          ; error if we get here

T_JN:   LDAI  R2, 5       ; R2 = 5
        LDAI  R3, 10       ; R3 = 10
        SUB   R2, R3, R4   ; R4 = 5 - 10 < 0 (negative)
        JN    T_JMP         ; must branch (negative) → ok
        JMP   DONE          ; error if we get here

T_JMP:  JMP   SUCCESS      ; must branch (unconditional) → ok
        JMP   DONE          ; error if we get here

SUCCESS: STA  R7, OK       ; OK = 1

DONE:   HLT
`;

const LOGICO_EN = `\
; ── Logic Instructions ──────────────────────────────────────────────────────
; Shows AND, OR and NOT on 16-bit bit patterns.
; Inputs: R0=85 (01010101), R1=51 (00110011)
; Results: AND=17, OR=119, NOT(85)=0xFFAA (−86)

        .data
RES_AND: DB   0             ; result of R0 AND R1
RES_OR:  DB   0             ; result of R0 OR R1
RES_NOT: DB   0             ; result of NOT R0

        .code
        LDAI  R0, 85       ; R0 = 01010101
        LDAI  R1, 51       ; R1 = 00110011
        AND   R0, R1, R2   ; R2 = R0 AND R1 = 00010001 = 17
        OR    R0, R1, R3   ; R3 = R0 OR  R1 = 01110111 = 119
        NOT   R0, R4        ; R4 = NOT R0    = 11111111 10101010 = 0xFFAA (−86)
        STA   R2, RES_AND
        STA   R3, RES_OR
        STA   R4, RES_NOT
        HLT
`;

export const PRESET_PROGRAMS: readonly PresetProgram[] = [
  { id: "basico",  name: { pt: "Exemplo Básico", en: "Basic Example" },          source: { pt: BASICO_PT, en: BASICO_EN } },
  { id: "for",     name: { pt: "FOR — Contador", en: "FOR — Counter" },          source: { pt: FOR_CONTADOR_PT, en: FOR_CONTADOR_EN } },
  { id: "if-else", name: { pt: "IF-THEN-ELSE", en: "IF-THEN-ELSE" },             source: { pt: IF_THEN_ELSE_PT, en: IF_THEN_ELSE_EN } },
  { id: "desvios", name: { pt: "Desvios", en: "Branches" },                      source: { pt: DESVIOS_PT, en: DESVIOS_EN } },
  { id: "logico",  name: { pt: "Instruções Lógicas", en: "Logic Instructions" }, source: { pt: LOGICO_PT, en: LOGICO_EN } },
];

/**
 * The example whose text this is, in any language — an example stays the same
 * example after a language switch, until the student edits it.
 */
export function findPresetBySource(source: string): PresetProgram | undefined {
  return PRESET_PROGRAMS.find((p) => Object.values(p.source).includes(source));
}
