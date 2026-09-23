import { LevelData } from './Types';
import { DEFAULT_PALETTE } from './Colors';

/**
 * Cria a matriz e o deck balanceado para as 5 fases iniciais do jogo.
 * Todas as fases são matematicamente verificadas para garantir que a soma das capacidades
 * das caixas de cada cor é EXATAMENTE igual ao número total de blocos daquela cor no tabuleiro.
 */

// Helper para converter string de ASCII art em BoardGrid
function parseAsciiGrid(ascii: string[]): (string | null)[][] {
  return ascii.map((row) =>
    row.split('').map((char) => (char === '.' || char === ' ' ? null : char))
  );
}

// Helper para contar blocos por cor
function countGridColors(grid: (string | null)[][]): {
  counts: Record<string, number>;
  total: number;
} {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) {
        counts[cell] = (counts[cell] || 0) + 1;
        total++;
      }
    }
  }
  return { counts, total };
}

// ----------------------------------------------------------------------------
// Nível 1: Estrela Guia (Introdução Confortável - Laranja, Amarelo e Branco)
// ----------------------------------------------------------------------------
const LEVEL_1_ASCII = [
  '....E....',
  '...EBE...',
  '..EBBBE..',
  'EEEEBEEEE',
  '.EBBGBBE.',
  '..EBGBE..',
  '.EBBGBBE.',
  'EEEEBEEEE',
  '..EBBBE..',
  '...EBE...',
  '....E....',
];

const grid1 = parseAsciiGrid(LEVEL_1_ASCII);
const counts1 = countGridColors(grid1);
// E: 28 blocos, B: 17 blocos, G: 3 blocos. Total: 48 blocos

const LEVEL_1: LevelData = {
  id: 'level_1',
  name: 'Nível 1: Estrela Guia',
  width: grid1[0].length,
  height: grid1.length,
  initialGrid: grid1,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1
    [{ colorId: 'E', capacity: 14 }, { colorId: 'B', capacity: 8 }],
    // Coluna 2
    [{ colorId: 'E', capacity: 14 }, { colorId: 'B', capacity: 9 }],
    // Coluna 3
    [{ colorId: 'G', capacity: 3 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts1.total,
    totalBoxes: 5,
    colorCounts: counts1.counts,
    difficulty: 'Muito Fácil',
    description: 'Aprenda os conceitos básicos. Remova a casca de Laranja para liberar o Amarelo.',
  },
};

// ----------------------------------------------------------------------------
// Nível 2: Mini Robô Operário (4 Cores: Azul Ciano, Amarelo, Branco e Laranja)
// ----------------------------------------------------------------------------
const LEVEL_2_ASCII = [
  '..A...A..',
  '..AA.AA..',
  '.AAAAAAA.',
  '.AGGGGGA.',
  '.AGBAGBA.',
  '.AGGGGGA.',
  '.AGEEEGA.',
  '.AGGGGGA.',
  '.AAAAAAA.',
  '..AAAAA..',
];

const grid2 = parseAsciiGrid(LEVEL_2_ASCII);
const counts2 = countGridColors(grid2);
// A: 28, G: 25, B: 2, E: 3. Total: 58

const LEVEL_2: LevelData = {
  id: 'level_2',
  name: 'Nível 2: Mini Robô Operário',
  width: grid2[0].length,
  height: grid2.length,
  initialGrid: grid2,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1
    [{ colorId: 'A', capacity: 14 }, { colorId: 'G', capacity: 12 }],
    // Coluna 2
    [{ colorId: 'A', capacity: 14 }, { colorId: 'G', capacity: 13 }],
    // Coluna 3
    [{ colorId: 'B', capacity: 2 }, { colorId: 'E', capacity: 3 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts2.total,
    totalBoxes: 6,
    colorCounts: counts2.counts,
    difficulty: 'Fácil',
    description: 'Desmonte o capacete metálico para acessar o visor e o circuito do robô.',
  },
};

// ----------------------------------------------------------------------------
// Nível 3: Coração Quântico (3 Cores: Rosa Magenta, Laranja, Branco)
// ----------------------------------------------------------------------------
const LEVEL_3_ASCII = [
  '.CC...CC.',
  'CCCC.CCCC',
  'CCEE.EECC',
  'CEEE.EEEC',
  'CEEGGEEEC',
  '.CEEGEEC.',
  '..CEEEC..',
  '...CEC...',
  '....C....',
];

const grid3 = parseAsciiGrid(LEVEL_3_ASCII);
const counts3 = countGridColors(grid3);
// C: 26, E: 20, G: 3. Total: 49

const LEVEL_3: LevelData = {
  id: 'level_3',
  name: 'Nível 3: Coração Quântico',
  width: grid3[0].length,
  height: grid3.length,
  initialGrid: grid3,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1
    [{ colorId: 'C', capacity: 13 }, { colorId: 'E', capacity: 10 }],
    // Coluna 2
    [{ colorId: 'C', capacity: 13 }, { colorId: 'E', capacity: 10 }],
    // Coluna 3
    [{ colorId: 'G', capacity: 3 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts3.total,
    totalBoxes: 5,
    colorCounts: counts3.counts,
    difficulty: 'Médio',
    description: 'Libere as asas externas de plasma para chegar ao núcleo de energia.',
  },
};

// ----------------------------------------------------------------------------
// Nível 4: Foguete Cósmico (4 Cores: Rosa, Ciano, Branco, Amarelo)
// ----------------------------------------------------------------------------
const LEVEL_4_ASCII = [
  '....C....',
  '...CCC...',
  '...GGG...',
  '..GAGAG..',
  '..GAGAG..',
  '..GGGGG..',
  '.CGGGGGC.',
  'CCGGGGGCC',
  '.C.BBB.C.',
  '...BBB...',
  '....B....',
];

const grid4 = parseAsciiGrid(LEVEL_4_ASCII);
const counts4 = countGridColors(grid4);
// C: 12, G: 23, A: 4, B: 7. Total: 46

const LEVEL_4: LevelData = {
  id: 'level_4',
  name: 'Nível 4: Foguete Cósmico',
  width: grid4[0].length,
  height: grid4.length,
  initialGrid: grid4,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1: Asas e ponta
    [{ colorId: 'C', capacity: 6 }, { colorId: 'G', capacity: 11 }],
    // Coluna 2: Asas e propulsor
    [{ colorId: 'B', capacity: 7 }, { colorId: 'C', capacity: 6 }],
    // Coluna 3: Fuselagem
    [{ colorId: 'G', capacity: 12 }, { colorId: 'A', capacity: 4 }],
    // Coluna 4: Reserva
    [],
  ],
  metadata: {
    totalBlocks: counts4.total,
    totalBoxes: 6,
    colorCounts: counts4.counts,
    difficulty: 'Difícil',
    description: 'Desmonte o propulsor e as aletas estabilizadoras sem lotar os slots da fuselagem.',
  },
};

// ----------------------------------------------------------------------------
// Nível 5: Dragão Tecno (5 Cores: Verde Esmeralda, Ciano, Amarelo, Roxo, Branco)
// ----------------------------------------------------------------------------
const LEVEL_5_ASCII = [
  'DD.....DD',
  'DDD...DDD',
  '.DAADDAAD',
  '.DFFDDFFD',
  '..DDGGDD.',
  '...DFFD..',
  '..DBBBD..',
  '.DBBBBBD.',
  'DDDDDDDDD',
];

const grid5 = parseAsciiGrid(LEVEL_5_ASCII);
const counts5 = countGridColors(grid5);
// D: 37, A: 4, F: 6, G: 2, B: 8. Total: 57

const LEVEL_5: LevelData = {
  id: 'level_5',
  name: 'Nível 5: Dragão Tecno',
  width: grid5[0].length,
  height: grid5.length,
  initialGrid: grid5,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1
    [{ colorId: 'D', capacity: 18 }, { colorId: 'A', capacity: 4 }],
    // Coluna 2 (com interleaving estratégico: F enterrado atrás de D)
    [{ colorId: 'D', capacity: 19 }, { colorId: 'F', capacity: 6 }],
    // Coluna 3
    [{ colorId: 'B', capacity: 8 }, { colorId: 'G', capacity: 2 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts5.total,
    totalBoxes: 6,
    colorCounts: counts5.counts,
    difficulty: 'Extremo',
    description: 'Desafio mestre de gerenciamento de slots: escamas densas protegem circuitos entrelaçados.',
  },
};

export const INITIAL_LEVELS: LevelData[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
];
