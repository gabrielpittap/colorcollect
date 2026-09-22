import { BoardGrid } from './Types';
import { LevelGenerator } from './LevelGenerator';

/**
 * Nível 1: Alvo Concêntrico (Target) - Demonstração pura de dependência
 * Camada 0: A (Azul Ciano) na moldura externa
 * Camada 1: B (Amarelo) no anel intermediário
 * Camada 2: C (Magenta) no miolo
 */
export function createConcentricLevel(): BoardGrid {
  const size = 12;
  const grid: BoardGrid = Array.from({ length: size }, () =>
    Array(size).fill('C')
  );

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x <= 1 || x >= size - 2 || y <= 1 || y >= size - 2) {
        grid[y][x] = 'A'; // Casca externa
      } else if (x <= 3 || x >= size - 4 || y <= 3 || y >= size - 4) {
        grid[y][x] = 'B'; // Camada média
      } else {
        grid[y][x] = 'C'; // Miolo
      }
    }
  }

  return grid;
}

/**
 * Nível 2: Mini Robô (Cubic Bot)
 * Matriz 14x14 representando um robozinho com rodinhas (E), corpo (A), visor (B) e núcleo (C).
 */
export function createMiniBotLevel(): BoardGrid {
  // A: Corpo Azul, B: Visor Amarelo, C: Núcleo Magenta, D: Antena Verde, E: Rodinhas Laranja
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
    row.split('').map((char) => (char === '.' ? null : char))
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
    row.split('').map((char) => (char === '.' ? null : char))
  );
}
