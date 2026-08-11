export interface PresetProgram {
  id: string;
  name: string;
  description: string;
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

        .text
INICIO: LDAI  R0, #10       ; R0 = 10
        LDAI  R1, #6        ; R1 = 6
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
; Simula um laço for(cnt=1; cnt<=5; cnt++) usando ADD, SUB e JZ.
; Resultado esperado: R0=5, mem[CNT]=5

        .data
CNT:    DB    #01h          ; valor inicial do contador
END:    DB    #05h          ; valor limite

        .text
        LDA   R0, CNT       ; R0 = CNT
        LDA   R1, END       ; R1 = END
        LDAI  R2, #1        ; R2 = 1 (passo)

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

        .text
        LDA   R1, N1        ; R1 = N1
        LDA   R2, N2        ; R2 = N2
        LDAI  R3, #1        ; R3 = 1 (constante)

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

const MULTIPLICACAO = `\
; ── Multiplicação por Somas Sucessivas ──────────────────────────────────────
; Calcula N1 × N2 somando N1 repetidamente N2 vezes.
; Resultado esperado (N1=3, N2=4): mem[RE]=12

        .data
N1:     DB    3             ; primeiro fator (valor somado)
N2:     DB    4             ; segundo fator (contador de repetições)
RE:     DB    0             ; resultado

        .text
        LDA   R1, N1        ; R1 = N1
        LDA   R2, N2        ; R2 = N2 (contador)
        LDAI  R4, #0        ; R4 = acumulador = 0
        LDAI  R3, #1        ; R3 = 1 (decremento)

MULTIP: ADD   R4, R1, R4   ; acumulador += N1
        STA   R4, RE        ; salva resultado parcial
        SUB   R2, R3, R2   ; contador--
        JZ    FIM           ; se zero, termina
        JMP   MULTIP

FIM:    HLT
`;

const DESVIOS = `\
; ── Desvios Condicionais ────────────────────────────────────────────────────
; Testa JZ (desvio se zero), JN (desvio se negativo) e JMP (incondicional).
; Resultado esperado: mem[OK]=1

        .data
OK:     DB    0             ; resultado (1=sucesso, 0=falha)

        .text
        LDAI  R7, #1        ; R7 = 1 (constante de sucesso)
        LDAI  R0, #0        ; R0 = 0

        ; Teste JZ: 0 - 0 deve ser zero → deve saltar
        SUB   R0, R0, R1   ; R1 = 0
        JZ    T_JN          ; deve saltar (zero) → ok
        JMP   FIM           ; erro se chegar aqui

T_JN:   LDAI  R2, #5       ; R2 = 5
        LDAI  R3, #10       ; R3 = 10
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
; Entradas: R0=170 (10101010), R1=204 (11001100)
; Resultados: AND=136, OR=238, NOT(170)=65365

        .data
RES_AND: DB   0             ; resultado de R0 AND R1
RES_OR:  DB   0             ; resultado de R0 OR R1
RES_NOT: DB   0             ; resultado de NOT R0

        .text
        LDAI  R0, #170      ; R0 = 10101010
        LDAI  R1, #204      ; R1 = 11001100
        AND   R0, R1, R2   ; R2 = R0 AND R1 = 10001000 = 136
        OR    R0, R1, R3   ; R3 = R0 OR  R1 = 11101110 = 238
        NOT   R0, R4        ; R4 = NOT R0    = 1111...01010101
        STA   R2, RES_AND
        STA   R3, RES_OR
        STA   R4, RES_NOT
        HLT
`;

export const PRESET_PROGRAMS: PresetProgram[] = [
  { id: "basico",   name: "Exemplo Básico",         description: "Soma, subtração, memória e desvio condicional",  source: BASICO },
  { id: "for",      name: "FOR — Contador",          description: "Laço contando de 1 até 5 usando ADD, SUB, JZ",  source: FOR_CONTADOR },
  { id: "if-else",  name: "IF-THEN-ELSE",            description: "Comparação condicional entre N1 e N2",           source: IF_THEN_ELSE },
  { id: "mult",     name: "Multiplicação",            description: "N1 × N2 por somas sucessivas",                  source: MULTIPLICACAO },
  { id: "desvios",  name: "Desvios",                 description: "Testa JZ, JN e JMP — resultado OK=1 se correto", source: DESVIOS },
  { id: "logico",   name: "Instruções Lógicas",      description: "AND, OR e NOT com padrões de bits",              source: LOGICO },
];
