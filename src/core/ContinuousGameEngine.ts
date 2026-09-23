import {
  BoardGrid,
  BufferSlot,
  CanvasParticle,
  LevelData,
  MiniBot,
  SupplyBox,
} from './Types';
import { EdgeDetector } from './EdgeDetector';
import { DistanceMatrix } from './DistanceMatrix';
import { SoundManager } from './SoundManager';

export type GameStatus = 'PLAYING' | 'WON' | 'LOST';

export interface ContinuousEngineListener {
  onGridChanged?: (grid: BoardGrid) => void;
  onBufferChanged?: (slots: BufferSlot[]) => void;
  onSupplyChanged?: (columns: SupplyBox[][]) => void;
  onStatusChanged?: (status: GameStatus) => void;
  onParticlesSpawned?: (particles: CanvasParticle[]) => void;
}

export class ContinuousGameEngine {
  public level: LevelData;
  public grid: BoardGrid;
  public bufferSlots: BufferSlot[];
  public supplyColumns: SupplyBox[][];
  public status: GameStatus = 'PLAYING';
  public totalCollectedBlocks: number = 0;
  public totalInitialBlocks: number = 0;
  public robots: MiniBot[] = [];
  public particles: CanvasParticle[] = [];

  // Tabela de distâncias pré-calculada para seleção de alvo
  public distanceMatrix: DistanceMatrix;

  // Células atualmente reservadas por robôs em trânsito
  private reservedCells = new Set<string>();

  // Coordenadas mundiais das docas dos 5 slots (calculadas pelo Canvas)
  private dockPositions: { x: number; y: number }[] = [];

  // Dimensões do grid e do canvas
  private gridBounds = {
    cellPixelSize: 32,
    offsetX: 0,
    offsetY: 0,
  };

  private listeners: ContinuousEngineListener = {};
  public elapsedSeconds: number = 0;

  constructor(level: LevelData, listener?: ContinuousEngineListener) {
    this.level = level;
    if (listener) this.listeners = listener;

    this.grid = level.initialGrid.map((row) => [...row]);
    this.bufferSlots = Array.from({ length: level.bufferSize }, (_, index) => ({
      index,
      box: null,
    }));

    // Constrói pilhas de suprimento
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

    this.totalInitialBlocks = EdgeDetector.countRemainingBlocks(this.grid);
    this.distanceMatrix = new DistanceMatrix(level.width, level.height);

    // Inicializa posições padrão para os 5 slots
    this.dockPositions = Array.from({ length: 5 }, (_, i) => ({
      x: 100 + i * 80,
      y: 400,
    }));
  }

  /**
   * Atualiza as coordenadas visuais das docas e do grid calculadas pelo Canvas
   */
  public updateLayoutMetrics(
    docks: { x: number; y: number }[],
    cellPixelSize: number,
    offsetX: number,
    offsetY: number
  ) {
    this.dockPositions = docks;
    this.gridBounds.cellPixelSize = cellPixelSize;
    this.gridBounds.offsetX = offsetX;
    this.gridBounds.offsetY = offsetY;
  }

  /**
   * Converte coordenadas do grid (gx, gy) para coordenadas em pixels no Canvas
   */
  public gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.gridBounds.offsetX + gx * this.gridBounds.cellPixelSize + this.gridBounds.cellPixelSize / 2,
      y: this.gridBounds.offsetY + gy * this.gridBounds.cellPixelSize + this.gridBounds.cellPixelSize / 2,
    };
  }

  /**
   * Puxa a caixa da coluna para o primeiro slot livre da doca
   */
  public pullBox(colIdx: number): boolean {
    if (this.status !== 'PLAYING') return false;

    const column = this.supplyColumns[colIdx];
    if (!column || column.length === 0) return false;

    // Procura primeiro slot livre
    const freeSlot = this.bufferSlots.find((s) => s.box === null);
    if (!freeSlot) return false;

    // Remove do topo da coluna
    const box = column.shift()!;
    if (column.length > 0) {
      column[0].isUnlocked = true;
      column.forEach((b, idx) => (b.depth = idx));
    }

    freeSlot.box = box;
    SoundManager.playClick();

    // Cria o Mini-Bot deste slot caso ainda não exista
    const dock = this.dockPositions[freeSlot.index] || { x: 200, y: 400 };
    const bot: MiniBot = {
      id: `bot_slot_${freeSlot.index}`,
      slotIndex: freeSlot.index,
      colorId: box.colorId,
      status: 'IDLE',
      x: dock.x,
      y: dock.y,
      targetGridX: -1,
      targetGridY: -1,
      dockX: dock.x,
      dockY: dock.y,
      cargoColor: null,
      actionTimer: 0,
      progress: 0,
      speed: 380, // pixels por segundo
      angle: -Math.PI / 2,
    };

    // Remove qualquer robô antigo desse slot e adiciona o novo
    this.robots = this.robots.filter((r) => r.slotIndex !== freeSlot.index);
    this.robots.push(bot);

    this.notifySupply();
    this.notifyBuffer();
    return true;
  }

  /**
   * Loop de simulação em tempo real (chamado a cada frame com delta time dt em segundos)
   */
  public update(dt: number): void {
    if (this.status !== 'PLAYING') return;

    this.elapsedSeconds += dt;

    // 1. Atualizar partículas
    this.updateParticles(dt);

    // 2. Atualizar cada robô ativo
    let gridDirty = false;
    let bufferDirty = false;

    for (const bot of this.robots) {
      const slot = this.bufferSlots[bot.slotIndex];
      const box = slot?.box;

      // Se a caixa foi removida ou esgotou, o robô retorna e desativa
      if (!box || box.remaining <= 0) {
        if (bot.cargoColor) {
          // Descarrega o que sobrou
          bot.cargoColor = null;
        }
        bot.status = 'IDLE';
        continue;
      }

      // Atualiza coordenadas da doca
      const dock = this.dockPositions[bot.slotIndex];
      if (dock) {
        bot.dockX = dock.x;
        bot.dockY = dock.y;
      }

      switch (bot.status) {
        case 'IDLE': {
          // Busca alvo mais próximo do seu slot usando a DistanceMatrix
          const exposedCells = EdgeDetector.getExposedCells(this.grid, box.colorId);
          // Filtra alvos que já estão reservados por outro robô
          const availableTargets = exposedCells.filter(
            (c) => !this.reservedCells.has(`${c.x},${c.y}`)
          );

          if (availableTargets.length > 0) {
            // Seleção de Alvo por Proximidade do Slot!
            const target = this.distanceMatrix.getClosestExposedTarget(
              bot.slotIndex,
              availableTargets
            );

            if (target) {
              bot.targetGridX = target.x;
              bot.targetGridY = target.y;
              this.reservedCells.add(`${target.x},${target.y}`);
              bot.status = 'SEEKING';
            }
          }
          break;
        }

        case 'SEEKING': {
          // Move em direção ao bloco alvo
          const targetWorld = this.gridToWorld(bot.targetGridX, bot.targetGridY);
          const dx = targetWorld.x - bot.x;
          const dy = targetWorld.y - bot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          bot.angle = Math.atan2(dy, dx);

          const step = bot.speed * dt;
          if (dist <= step || dist < 4) {
            bot.x = targetWorld.x;
            bot.y = targetWorld.y;
            bot.status = 'HARVESTING';
            bot.actionTimer = 0.08; // Pequeno delay satisfatório de mastigação/pop
          } else {
            bot.x += (dx / dist) * step;
            bot.y += (dy / dist) * step;
          }
          break;
        }

        case 'HARVESTING': {
          bot.actionTimer -= dt;
          if (bot.actionTimer <= 0) {
            // Remove o bloco do tabuleiro
            const targetColor = this.grid[bot.targetGridY]?.[bot.targetGridX];
            if (targetColor) {
              this.grid[bot.targetGridY][bot.targetGridX] = null;
              this.reservedCells.delete(`${bot.targetGridX},${bot.targetGridY}`);

              // Efeitos de coleta
              const targetWorld = this.gridToWorld(bot.targetGridX, bot.targetGridY);
              this.spawnBlockParticles(targetWorld.x, targetWorld.y, targetColor);
              SoundManager.playHarvest(1 + (box.totalCapacity - box.remaining) * 0.03);

              bot.cargoColor = targetColor;
              bot.status = 'RETURNING';
              gridDirty = true;
            } else {
              // Bloco já sumiu por alguma razão, volta para idle
              this.reservedCells.delete(`${bot.targetGridX},${bot.targetGridY}`);
              bot.status = 'IDLE';
            }
          }
          break;
        }

        case 'RETURNING': {
          // Move de volta para a sua doca
          const dx = bot.dockX - bot.x;
          const dy = bot.dockY - bot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          bot.angle = Math.atan2(dy, dx);

          const step = bot.speed * dt;
          if (dist <= step || dist < 4) {
            bot.x = bot.dockX;
            bot.y = bot.dockY;
            bot.status = 'DEPOSITING';
            bot.actionTimer = 0.05;
          } else {
            bot.x += (dx / dist) * step;
            bot.y += (dy / dist) * step;
          }
          break;
        }

        case 'DEPOSITING': {
          bot.actionTimer -= dt;
          if (bot.actionTimer <= 0) {
            bot.cargoColor = null;
            box.remaining = Math.max(0, box.remaining - 1);
            this.totalCollectedBlocks++;
            SoundManager.playDeposit();
            bufferDirty = true;

            // Caixa zerada: completou a tarefa!
            if (box.remaining === 0) {
              SoundManager.playBoxComplete();
              slot.box = null;
              bot.status = 'IDLE';

              // Remove o robô da lista
              this.robots = this.robots.filter((r) => r.slotIndex !== bot.slotIndex);
            } else {
              bot.status = 'IDLE';
            }
          }
          break;
        }
      }
    }

    if (gridDirty) this.notifyGrid();
    if (bufferDirty) this.notifyBuffer();

    // 3. Checar Condições de Fim de Jogo
    this.checkGameCompletion();
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private spawnBlockParticles(x: number, y: number, colorId: string) {
    const colorDef = this.level.palette[colorId];
    const hex = colorDef ? colorDef.hex : '#ffffff';
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20, // leve empurrão para cima
        color: hex,
        size: 3 + Math.random() * 4,
        alpha: 1,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
      });
    }
  }

  private checkGameCompletion() {
    // Vitória: Todos os blocos coletados
    const remaining = EdgeDetector.countRemainingBlocks(this.grid);
    if (remaining === 0 && this.robots.every((r) => !r.cargoColor)) {
      this.status = 'WON';
      SoundManager.playVictory();
      this.notifyStatus();
      return;
    }

    // Derrota (Deadlock):
    // 5 slots ocupados, nenhum robô tem alvo e nenhum robô está em trânsito com carga
    const emptySlots = this.bufferSlots.filter((s) => s.box === null);
    if (emptySlots.length === 0) {
      let anyCanCollect = false;
      for (const slot of this.bufferSlots) {
        if (slot.box && slot.box.remaining > 0) {
          const exposed = EdgeDetector.getExposedCells(this.grid, slot.box.colorId);
          if (exposed.length > 0) {
            anyCanCollect = true;
            break;
          }
        }
      }

      // Se nenhum slot consegue coletar e nenhum robô está carregando bloco
      const anyCarrying = this.robots.some((r) => r.cargoColor !== null);
      if (!anyCanCollect && !anyCarrying) {
        this.status = 'LOST';
        SoundManager.playGameOver();
        this.notifyStatus();
      }
    }
  }

  /**
   * Reinicia a fase para o estado original
   */
  public restart(): void {
    this.status = 'PLAYING';
    this.totalCollectedBlocks = 0;
    this.elapsedSeconds = 0;
    this.reservedCells.clear();
    this.particles = [];
    this.robots = [];

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
    this.listeners.onGridChanged?.(this.grid);
  }

  private notifyBuffer(): void {
    this.listeners.onBufferChanged?.([...this.bufferSlots]);
  }

  private notifySupply(): void {
    this.listeners.onSupplyChanged?.([...this.supplyColumns]);
  }

  private notifyStatus(): void {
    this.listeners.onStatusChanged?.(this.status);
  }
}
