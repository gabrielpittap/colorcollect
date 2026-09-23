import { BoardGrid } from './Types';
import { LEGACY_LETTER_MAP } from './Colors';

/**
 * Nível 1: Alvo Concêntrico (Target)
 * Casca: #4AF (Ciano), Meio: #FC4 (Amarelo), Miolo: #F6C (Magenta)
 */
export function createConcentricLevel(): BoardGrid {
  const size = 12;
  const grid: BoardGrid = Array.from({ length: size }, () =>
    Array(size).fill('#F6C')
  );

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x <= 1 || x >= size - 2 || y <= 1 || y >= size - 2) {
        grid[y][x] = '#4AF'; // Casca externa
      } else if (x <= 3 || x >= size - 4 || y <= 3 || y >= size - 4) {
        grid[y][x] = '#FC4'; // Camada média
      } else {
        grid[y][x] = '#F6C'; // Miolo
      }
    }
  }

  return grid;
}

/**
 * Nível 2: Mini Robô (Cubic Bot)
 */
export function createMiniBotLevel(): BoardGrid {
  const layout = [
    '..............',
    '.....DD.......',
    '.....DD.......',
    '..AAAAAAAAAA..',
    '..ABBBBBBBBA..',
    '..ABBAAABBAA..',
    '..ABBBBBBBBA..',
    '..AAAAAAAAAA..',
    '..AAACCCCAAA..',
    '..AAACCCCAAA..',
    '..AAAAAAAAAA..',
    '.EEEE....EEEE.',
    '.EEEE....EEEE.',
    '..............',
  ];

  return layout.map((row) =>
    row.split('').map((char) => (char === '.' ? null : (LEGACY_LETTER_MAP[char] || char)))
  );
}

/**
 * Nível 3: Coração Colorido (Pixel Heart)
 */
export function createHeartLevel(): BoardGrid {
  const layout = [
    '..CCCC..CCCC..',
    '.CCCCCC.CCCCCC.',
    'CCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCC',
    'CCBBBBBBBBBBCC',
    'CCBBAAAAAABBCC',
    '.CBAAAAAAAABC.',
    '..BAAAAAAAAB..',
    '...AAAAAAAA...',
    '....AAAAAA....',
    '.....AAAA.....',
    '......AA......',
  ];

  return layout.map((row) =>
    row.split('').map((char) => (char === '.' ? null : (LEGACY_LETTER_MAP[char] || char)))
  );
}
