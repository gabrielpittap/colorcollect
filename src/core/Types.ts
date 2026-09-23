/**
 * ColorCollect Core Types
 * Definições de tipos para a matriz, caixas de suprimento, robôs organizadores e fases.
 */

export interface ColorDef {
  id: string;       // ex: 'A', 'B', 'C' ou '1', '2'
  letter: string;   // Letra de exibição
  name: string;     // Nome amigável (ex: "Azul Elétrico")
  hex: string;      // Cor primária HEX
  textHex: string;  // Cor de texto de alto contraste (#ffffff ou #000000)
}

export interface GridCell {
  x: number;
  y: number;
  colorId: string;
  isExposed: boolean; // Se tem pelo menos 1 vizinho livre (acessível pelo robô)
}

export type BoardGrid = (string | null)[][]; // grid[y][x]: null se já coletado

export interface SupplyBox {
  id: string;
  colorId: string;
  totalCapacity: number;  // Quantidade de blocos necessária
  remaining: number;      // Quantidade ainda pendente
  column: number;         // Coluna na grade inferior (0-indexed)
  depth: number;          // Posição na coluna (0 = frente/desbloqueada, 1 = logo atrás, etc.)
  isUnlocked: boolean;    // Verdadeiro se depth == 0
}

export interface BufferSlot {
  index: number;
  box: SupplyBox | null;
}

export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  initialGrid: (string | null)[][];
  initialSupply: { colorId: string; capacity: number }[][]; // [coluna][profundidade]
  palette: Record<string, ColorDef>;
  bufferSize: number; // Padrão: 5 slots
  metadata: {
    totalBlocks: number;
    totalBoxes: number;
    colorCounts: Record<string, number>;
    solutionsCount?: number;
    difficulty?: 'Muito Fácil' | 'Fácil' | 'Médio' | 'Difícil' | 'Extremo' | 'Impossível';
    optimalSequence?: string[];
    isCustom?: boolean;
    description?: string;
  };
}

export interface DependencyEdge {
  fromColor: string; // Cor externa que precisa ser removida primeiro
  toColor: string;   // Cor interna que está bloqueada
  blockingCount: number; // Quantos blocos da cor interna ela obstrui
}

export interface SolverMove {
  column: number;
  boxColor: string;
  boxCapacity: number;
}

export interface SolverResult {
  isSolvable: boolean;
  totalSolutions: number;      // Número de caminhos válidos até a vitória
  difficulty: 'Muito Fácil' | 'Fácil' | 'Médio' | 'Difícil' | 'Extremo' | 'Impossível';
  branchingFactor: number;     // Média de escolhas seguras por turno
  deadlockStatesCount: number; // Quantas decisões levam a game over
  bestSolution?: SolverMove[]; // Menor sequência de cliques
  statesEvaluated: number;
  executionTimeMs: number;
}

// -------------------------------------------------------------
// Tipos do Motor de Simulação Contínua & Robôs Organizadores
// -------------------------------------------------------------

export type RobotState = 'IDLE' | 'SEEKING' | 'HARVESTING' | 'RETURNING' | 'DEPOSITING';

export interface MiniBot {
  id: string;
  slotIndex: number;
  colorId: string;
  status: RobotState;
  
  // Posição atual no Canvas (pixels)
  x: number;
  y: number;
  
  // Alvo atual na matriz (coordenadas do grid)
  targetGridX: number;
  targetGridY: number;
  
  // Posição da doca de origem no Canvas
  dockX: number;
  dockY: number;
  
  // Bloquinho carregado
  cargoColor: string | null;
  
  // Temporizadores de animação
  actionTimer: number; // segundos no estado atual
  progress: number;    // 0 a 1 interpolado
  speed: number;       // pixels por segundo
  
  // Rotação do robô (para virar na direção do movimento)
  angle: number;
}

export interface CanvasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface LevelProgress {
  completed: boolean;
  stars: number;
  bestTimeSeconds?: number;
  attempts?: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  fastSpeed: boolean;
}
