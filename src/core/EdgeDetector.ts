import { BoardGrid, GridCell } from './Types';

/**
 * Utilitários para detecção de bordas acessíveis e desmonte de voxels/blocos.
 */
export class EdgeDetector {
  /**
   * Verifica se uma célula específica em (x, y) possui ao menos 1 face livre (borda externa ou vizinho nulo).
   */
  static isCellExposed(grid: BoardGrid, x: number, y: number): boolean {
    const height = grid.length;
    const width = grid[0]?.length || 0;

    if (y < 0 || y >= height || x < 0 || x >= width || grid[y][x] === null) {
      return false;
    }

    // Borda exterior do tabuleiro
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      return true;
    }

    // Vizinhos 4-way (cima, baixo, esquerda, direita)
    if (
      grid[y - 1][x] === null ||
      grid[y + 1][x] === null ||
      grid[y][x - 1] === null ||
      grid[y][x + 1] === null
    ) {
      return true;
    }

    return false;
  }

  /**
   * Retorna a lista de todas as células expostas do tabuleiro, opcionalmente filtradas por cor.
   */
  static getExposedCells(grid: BoardGrid, filterColor?: string): GridCell[] {
    const exposed: GridCell[] = [];
    const height = grid.length;
    const width = grid[0]?.length || 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = grid[y][x];
        if (color !== null) {
          if (!filterColor || color === filterColor) {
            if (this.isCellExposed(grid, x, y)) {
              exposed.push({ x, y, colorId: color, isExposed: true });
            }
          }
        }
      }
    }

    return exposed;
  }

  /**
   * Retorna um mapa com a quantidade de blocos imediatamente acessíveis de cada cor.
   * Ex: { 'A': 12, 'B': 4, 'C': 0 }
   */
  static getExposedCounts(grid: BoardGrid): Record<string, number> {
    const counts: Record<string, number> = {};
    const exposed = this.getExposedCells(grid);

    for (const cell of exposed) {
      counts[cell.colorId] = (counts[cell.colorId] || 0) + 1;
    }

    return counts;
  }

  /**
   * Simula o consumo iterativo de até `maxCount` blocos de uma cor específica.
   * Conforme um bloco externo é removido, blocos vizinhos da mesma cor tornam-se acessíveis
   * e também podem ser consumidos durante o mesmo ciclo (assim como os robôs operam continuamente).
   */
  static consumeBlocks(
    grid: BoardGrid,
    colorId: string,
    maxCount: number
  ): {
    newGrid: BoardGrid;
    removedCount: number;
    removedCoords: { x: number; y: number }[];
  } {
    // Clona o grid para manter imutabilidade
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const clonedGrid: BoardGrid = grid.map((row) => [...row]);
    const removedCoords: { x: number; y: number }[] = [];

    let removed = 0;

    while (removed < maxCount) {
      // Localiza células expostas da cor desejada
      const candidateCells: { x: number; y: number }[] = [];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (clonedGrid[y][x] === colorId && this.isCellExposed(clonedGrid, x, y)) {
            candidateCells.push({ x, y });
          }
        }
      }

      if (candidateCells.length === 0) {
        // Não há mais blocos acessíveis desta cor neste instante
        break;
      }

      // Ordenação determinística de consumo: de fora para dentro (perímetro)
      // Prioriza cantos e bordas mais próximas dos limites
      candidateCells.sort((a, b) => {
        const distA = Math.min(a.x, width - 1 - a.x, a.y, height - 1 - a.y);
        const distB = Math.min(b.x, width - 1 - b.x, b.y, height - 1 - b.y);
        return distA - distB;
      });

      // Remove o primeiro candidato disponível
      const cellToRemove = candidateCells[0];
      clonedGrid[cellToRemove.y][cellToRemove.x] = null;
      removedCoords.push(cellToRemove);
      removed++;
    }

    return {
      newGrid: clonedGrid,
      removedCount: removed,
      removedCoords,
    };
  }

  /**
   * Conta quantos blocos totais ainda restam no tabuleiro.
   */
  static countRemainingBlocks(grid: BoardGrid): number {
    let total = 0;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < (grid[y]?.length || 0); x++) {
        if (grid[y][x] !== null) total++;
      }
    }
    return total;
  }
}
