import { LevelData } from './Types';
import { DEFAULT_PALETTE, LEGACY_LETTER_MAP } from './Colors';

/**
 * Cria a matriz e o deck balanceado para as 5 fases iniciais do jogo.
 * Todas as fases usam identificadores hexadecimais internos de 3 dígitos (#4AF, #FC4, etc.).
 * Rigorosamente auditadas matematicamente para garantir 100% de consistência.
 */

function parseAsciiGrid(
  ascii: string[],
  charMap: Record<string, string> = LEGACY_LETTER_MAP
): (string | null)[][] {
  return ascii.map((row) =>
    row.split('').map((char) => {
      if (char === '.' || char === ' ') return null;
      return charMap[char] || char;
    })
  );
}

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
// Nível 1: Estrela Guia (#F84 Laranja, #FC4 Amarelo, #FFF Branco - 55 blocos)
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
    [{ colorId: '#F84', capacity: 16 }, { colorId: '#FC4', capacity: 10 }],
    // Coluna 2
    [{ colorId: '#F84', capacity: 16 }, { colorId: '#FC4', capacity: 10 }],
    // Coluna 3
    [{ colorId: '#FFF', capacity: 3 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts1.total,
    totalBoxes: 5,
    colorCounts: counts1.counts,
    difficulty: 'Muito Fácil',
    description: 'Aprenda os conceitos básicos. Remova a casca de caixas para liberar o núcleo.',
  },
};

// ----------------------------------------------------------------------------
// Nível 2: Mini Robô Operário (#4AF Ciano, #FC4 Amarelo, #FFF Branco, #F84 Laranja - 60 blocos)
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

const LEVEL_2: LevelData = {
  id: 'level_2',
  name: 'Nível 2: Mini Robô Operário',
  width: grid2[0].length,
  height: grid2.length,
  initialGrid: grid2,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1: Chassi e placa
    [{ colorId: '#4AF', capacity: 18 }, { colorId: '#FFF', capacity: 10 }],
    // Coluna 2: Chassi e placa
    [{ colorId: '#4AF', capacity: 18 }, { colorId: '#FFF', capacity: 9 }],
    // Coluna 3: Visor
    [{ colorId: '#FC4', capacity: 2 }],
    // Coluna 4: Detalhes
    [{ colorId: '#F84', capacity: 3 }],
  ],
  metadata: {
    totalBlocks: counts2.total,
    totalBoxes: 6,
    colorCounts: counts2.counts,
    difficulty: 'Fácil',
    description: 'Desmonte o chassi externo para acessar os circuitos internos do robô.',
  },
};

// ----------------------------------------------------------------------------
// Nível 3: Coração Quântico (#F6C Magenta, #F84 Laranja, #FFF Branco - 53 blocos)
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
    [{ colorId: '#F6C', capacity: 14 }, { colorId: '#F84', capacity: 12 }],
    // Coluna 2
    [{ colorId: '#F6C', capacity: 13 }, { colorId: '#F84', capacity: 11 }],
    // Coluna 3
    [{ colorId: '#FFF', capacity: 3 }],
    // Coluna 4
    [],
  ],
  metadata: {
    totalBlocks: counts3.total,
    totalBoxes: 5,
    colorCounts: counts3.counts,
    difficulty: 'Médio',
    description: 'Libere a armadura externa para chegar ao núcleo de energia.',
  },
};

// ----------------------------------------------------------------------------
// Nível 4: Foguete Cósmico (#F6C Rosa, #FFF Branco, #FC4 Amarelo, #4AF Ciano - 47 blocos)
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

const LEVEL_4: LevelData = {
  id: 'level_4',
  name: 'Nível 4: Foguete Cósmico',
  width: grid4[0].length,
  height: grid4.length,
  initialGrid: grid4,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1: Aletas e fuselagem
    [{ colorId: '#F6C', capacity: 6 }, { colorId: '#FFF', capacity: 12 }],
    // Coluna 2: Propulsor e bico
    [{ colorId: '#FC4', capacity: 7 }, { colorId: '#F6C', capacity: 6 }],
    // Coluna 3: Fuselagem e cabine
    [{ colorId: '#FFF', capacity: 12 }, { colorId: '#4AF', capacity: 4 }],
    // Coluna 4: Reserva
    [],
  ],
  metadata: {
    totalBlocks: counts4.total,
    totalBoxes: 6,
    colorCounts: counts4.counts,
    difficulty: 'Difícil',
    description: 'Desmonte o propulsor e as aletas sem lotar os slots da fuselagem.',
  },
};

// ----------------------------------------------------------------------------
// Nível 5: Dragão Tecno (#4D8 Verde, #4AF Ciano, #A4F Roxo, #FC4 Amarelo, #FFF Branco - 57 blocos)
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

const LEVEL_5: LevelData = {
  id: 'level_5',
  name: 'Nível 5: Dragão Tecno',
  width: grid5[0].length,
  height: grid5.length,
  initialGrid: grid5,
  palette: DEFAULT_PALETTE,
  bufferSize: 5,
  initialSupply: [
    // Coluna 1: Escamas e chifres
    [{ colorId: '#4D8', capacity: 18 }, { colorId: '#4AF', capacity: 4 }],
    // Coluna 2: Escamas e asas
    [{ colorId: '#4D8', capacity: 19 }, { colorId: '#A4F', capacity: 6 }],
    // Coluna 3: Peito e cristal central
    [{ colorId: '#FC4', capacity: 8 }, { colorId: '#FFF', capacity: 2 }],
    // Coluna 4: Reserva
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
