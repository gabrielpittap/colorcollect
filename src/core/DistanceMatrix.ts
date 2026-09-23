/**
 * ColorCollect DistanceMatrix
 * Tabela pré-calculada de distâncias entre cada um dos 5 slots de ancoragem (0 a 4)
 * e cada coordenada (x, y) da matriz do tabuleiro.
 * 
 * Permite que o robô do Slot K selecione instantaneamente (em O(1))
 * o bloco exposto mais próximo da sua base de lançamento.
 */

export interface SlotPosition {
  x: number;
  y: number;
}

export class DistanceMatrix {
  private width: number;
  private height: number;
  // table[slotIndex][y][x] = distância euclidiana da doca do slot até a célula (x, y)
  private table: Float32Array[];

  constructor(width: number, height: number, bufferSize: number = 5) {
    this.width = width;
    this.height = height;
    this.table = [];

    // Calcula a posição virtual dos slots na base da matriz (y = height + 1)
    const slotPositions: SlotPosition[] = [];
    for (let s = 0; s < bufferSize; s++) {
      const norm = bufferSize > 1 ? s / (bufferSize - 1) : 0.5;
      slotPositions.push({
        x: (width - 1) * norm,
        y: height + 1,
      });
    }

    for (let s = 0; s < bufferSize; s++) {
      const slot = slotPositions[s];
      const dists = new Float32Array(width * height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - slot.x;
          const dy = y - slot.y;
          // Distância euclidiana com leve peso vertical para criar rotas elegantes
          dists[y * width + x] = Math.sqrt(dx * dx + dy * dy);
        }
      }
      this.table.push(dists);
    }
  }

  /**
   * Obtém a distância pré-calculada entre o slot K e a célula (x, y)
   */
  public getDistance(slotIndex: number, x: number, y: number): number {
    const s = Math.max(0, Math.min(this.table.length - 1, slotIndex));
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return Infinity;
    return this.table[s][y * this.width + x];
  }

  /**
   * Encontra o bloco exposto mais próximo da doca do slot informado.
   * Se houver múltiplos blocos, seleciona o de menor distância euclidiana pré-calculada.
   */
  public getClosestExposedTarget(
    slotIndex: number,
    candidates: { x: number; y: number }[]
  ): { x: number; y: number } | null {
    if (candidates.length === 0) return null;

    let bestCell = candidates[0];
    let minDistance = this.getDistance(slotIndex, bestCell.x, bestCell.y);

    for (let i = 1; i < candidates.length; i++) {
      const cell = candidates[i];
      const dist = this.getDistance(slotIndex, cell.x, cell.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestCell = cell;
      }
    }

    return bestCell;
  }
}
