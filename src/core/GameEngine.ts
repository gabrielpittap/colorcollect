import { BoardGrid, BufferSlot, LevelData, SupplyBox } from './Types';
import { EdgeDetector } from './EdgeDetector';

export type GameStatus = 'PLAYING' | 'WON' | 'LOST';

export interface GameEngineListener {
  onGridChanged?: (grid: BoardGrid, removedCoords: { x: number; y: number; colorId: string }[]) => void;
  onBufferChanged?: (slots: BufferSlot[]) => void;
  onSupplyChanged?: (columns: SupplyBox[][]) => void;
  onStatusChanged?: (status: GameStatus) => void;
  onBoxCompleted?: (slotIndex: number, box: SupplyBox) => void;
}

/**
 * Motor de execução de regras de jogo (Runtime Engine).
 * Controla as ações do jogador, os slots de buffer, consumo na borda e condições de vitória/derrota.
 */
export class GameEngine {
  public level: LevelData;
  public grid: BoardGrid;
  public bufferSlots: BufferSlot[];
  public supplyColumns: SupplyBox[][];
  public status: GameStatus = 'PLAYING';
  public totalCollectedBlocks: number = 0;
  public totalClearedBoxes: number = 0;
  private listeners: GameEngineListener = {};

  constructor(level: LevelData, listener?: GameEngineListener) {
    this.level = level;
    if (listener) this.listeners = listener;

    this.grid = level.initialGrid.map((row) => [...row]);
    this.bufferSlots = Array.from({ length: level.bufferSize }, (_, index) => ({
      index,
      box: null,
    }));

    // Constrói a pilha de suprimento
    let boxCounter = 1;
    this.supplyColumns = level.initialSupply.map((col, colIdx) =>
      col.map((item, depth) => ({
        id: `box_${boxCounter++}`,
        colorId: item.colorId,
        totalCapacity: item.capacity,
        remaining: item.capacity,
        column: colIdx,
        depth,
        isUnlocked: depth === 0,
      }))
    );
  }

  /**
   * Puxa uma caixa da coluna especificada para o primeiro slot livre do buffer.
   */
  public pullBox(colIdx: number): boolean {
    if (this.status !== 'PLAYING') return false;

    const column = this.supplyColumns[colIdx];
    if (!column || column.length === 0) return false;

    // Procura o primeiro slot livre
    const freeSlot = this.bufferSlots.find((s) => s.box === null);
    if (!freeSlot) {
      // Buffer cheio!
      return false;
    }

    // Remove a caixa do topo da coluna
    const box = column.shift()!;
    // Atualiza o desbloqueio da próxima caixa da coluna
    if (column.length > 0) {
      column[0].isUnlocked = true;
      // Atualiza profundidades
      column.forEach((b, idx) => (b.depth = idx));
    }

    // Coloca a caixa no slot livre
    freeSlot.box = box;

    this.notifySupply();
    this.notifyBuffer();

    // Executa o ciclo de coleta das formigas/robôs
    this.processCycle();

    return true;
  }

  /**
   * Processa o ciclo contínuo de coleta para todas as caixas ativas no buffer.
   */
  public processCycle(): void {
    if (this.status !== 'PLAYING') return;

    let somethingChanged = true;
    const allRemovedCoords: { x: number; y: number; colorId: string }[] = [];

    while (somethingChanged) {
      somethingChanged = false;

      for (const slot of this.bufferSlots) {
        const box = slot.box;
        if (box && box.remaining > 0) {
          const res = EdgeDetector.consumeBlocks(this.grid, box.colorId, box.remaining);

          if (res.removedCount > 0) {
            this.grid = res.newGrid;
            box.remaining -= res.removedCount;
            this.totalCollectedBlocks += res.removedCount;
            somethingChanged = true;

            for (const coord of res.removedCoords) {
              allRemovedCoords.push({ ...coord, colorId: box.colorId });
            }
          }
        }
      }

      // Conclusão de caixas (zeradas)
      for (const slot of this.bufferSlots) {
        if (slot.box && slot.box.remaining === 0) {
          const completedBox = slot.box;
          slot.box = null;
          this.totalClearedBoxes++;
          somethingChanged = true;

          if (this.listeners.onBoxCompleted) {
            this.listeners.onBoxCompleted(slot.index, completedBox);
          }
        }
      }
    }

    if (allRemovedCoords.length > 0 && this.listeners.onGridChanged) {
      this.listeners.onGridChanged(this.grid, allRemovedCoords);
    }
    this.notifyBuffer();

    // Verifica Condição de Vitória
    const remaining = EdgeDetector.countRemainingBlocks(this.grid);
    if (remaining === 0) {
      this.status = 'WON';
      this.notifyStatus();
      return;
    }

    // Verifica Condição de Derrota (Game Over):
    // Todos os slots ocupados e nenhuma das caixas consegue coletar blocos
    const emptySlots = this.bufferSlots.filter((s) => s.box === null);
    if (emptySlots.length === 0) {
      let anyCanCollect = false;
      for (const slot of this.bufferSlots) {
        if (slot.box) {
          const exposed = EdgeDetector.getExposedCells(this.grid, slot.box.colorId);
          if (exposed.length > 0) {
            anyCanCollect = true;
            break;
          }
        }
      }

      if (!anyCanCollect) {
        this.status = 'LOST';
        this.notifyStatus();
      }
    }
  }

  /**
   * Reinicia a fase para o estado original exato.
   */
  public restart(): void {
    this.status = 'PLAYING';
    this.totalCollectedBlocks = 0;
    this.totalClearedBoxes = 0;

    this.grid = this.level.initialGrid.map((row) => [...row]);
    this.bufferSlots = Array.from({ length: this.level.bufferSize }, (_, index) => ({
      index,
      box: null,
    }));

    let boxCounter = 1;
    this.supplyColumns = this.level.initialSupply.map((col, colIdx) =>
      col.map((item, depth) => ({
        id: `box_${boxCounter++}`,
        colorId: item.colorId,
        totalCapacity: item.capacity,
        remaining: item.capacity,
        column: colIdx,
        depth,
        isUnlocked: depth === 0,
      }))
    );

    this.notifyGrid();
    this.notifyBuffer();
    this.notifySupply();
    this.notifyStatus();
  }

  private notifyGrid(): void {
    if (this.listeners.onGridChanged) {
      this.listeners.onGridChanged(this.grid, []);
    }
  }

  private notifyBuffer(): void {
    if (this.listeners.onBufferChanged) {
      this.listeners.onBufferChanged([...this.bufferSlots]);
    }
  }

  private notifySupply(): void {
    if (this.listeners.onSupplyChanged) {
      this.listeners.onSupplyChanged([...this.supplyColumns]);
    }
  }

  private notifyStatus(): void {
    if (this.listeners.onStatusChanged) {
      this.listeners.onStatusChanged(this.status);
    }
  }
}
