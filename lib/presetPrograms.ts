export interface PresetProgram {
  id: string;
  name: string;
  source: string;
}

// Column widths used throughout:  LABEL(8) + MNEMONIC(6) + OPERANDS + COMMENT
// Blank label = 8 spaces; directives start at mnemonic column (8 spaces indent)

const BASICO = `\
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

const FOR_CONTADOR = `\
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

const IF_THEN_ELSE = `\
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

const DESVIOS = `\
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

const LOGICO = `\
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

export const PRESET_PROGRAMS: PresetProgram[] = [
  { id: "basico",   name: "Exemplo Básico",         source: BASICO },
  { id: "for",      name: "FOR — Contador",          source: FOR_CONTADOR },
  { id: "if-else",  name: "IF-THEN-ELSE",            source: IF_THEN_ELSE },
  { id: "desvios",  name: "Desvios",                 source: DESVIOS },
  { id: "logico",   name: "Instruções Lógicas",      source: LOGICO },
];
