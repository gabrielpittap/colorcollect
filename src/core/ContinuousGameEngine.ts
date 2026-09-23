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
import { Pathfinder, GridPoint } from './Pathfinder';

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

  // Células atualmente reservadas por robôs a caminho
  private reservedCells = new Set<string>();

  // Coordenadas mundiais das docas dos 5 slots
  private dockPositions: { x: number; y: number }[] = [];

  // Coordenadas da porta lateral direita de saída
  public rightDoor = {
    x: 390,
    y: 200,
    width: 24,
    height: 54,
  };

  // Cooldown de spawn por slot para manter robôs em fila ritmada
  private spawnCooldowns: number[] = [0, 0, 0, 0, 0];

  // Dimensões do grid e do canvas
  public gridBounds = {
    cellPixelSize: 32,
    offsetX: 0,
    offsetY: 0,
  };

  private listeners: ContinuousEngineListener = {};
  public elapsedSeconds: number = 0;
  private botCounter = 1;

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

    this.dockPositions = Array.from({ length: 5 }, (_, i) => ({
      x: 60 + i * 70,
      y: 420,
    }));
  }

  public canvasWidth: number = 400;
  public canvasHeight: number = 600;

  /**
   * Atualiza as coordenadas visuais das docas, portas e do grid calculadas pelo Canvas
   */
  public updateLayoutMetrics(
    docks: { x: number; y: number }[],
    cellPixelSize: number,
    offsetX: number,
    offsetY: number,
    canvasWidth: number,
    canvasHeight: number
  ) {
    this.dockPositions = docks;
    this.gridBounds.cellPixelSize = cellPixelSize;
    this.gridBounds.offsetX = offsetX;
    this.gridBounds.offsetY = offsetY;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.rightDoor.x = canvasWidth - 14;
    this.rightDoor.y = offsetY + (this.level.height * cellPixelSize) / 2;
  }

  /**
   * Converte coordenadas lógicas do grid (gx, gy) para pixels no Canvas
   */
  public gridToWorld(gx: number, gy: number): { x: number; y: number } {
    const rawX = this.gridBounds.offsetX + gx * this.gridBounds.cellPixelSize + this.gridBounds.cellPixelSize / 2;
    const rawY = this.gridBounds.offsetY + gy * this.gridBounds.cellPixelSize + this.gridBounds.cellPixelSize / 2;

    // Se estiver em corredores perimetrais fora do grid, evita corte nas bordas do canvas
    const pad = Math.max(6, this.gridBounds.cellPixelSize * 0.35);
    const clampedX = Math.max(pad, Math.min(this.canvasWidth - 14, rawX));
    const clampedY = Math.max(pad, rawY);

    return {
      x: clampedX,
      y: clampedY,
    };
  }

  /**
   * Mapeia a doca do slot K para coordenadas lógicas de grade
   */
  public getDockGridPos(slotIndex: number): GridPoint {
    const normX = slotIndex / 4; // 0 a 1
    const gx = Math.round(normX * (this.level.width - 1));
    const gy = this.level.height; // Logo abaixo da matriz
    return { x: gx, y: gy };
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

    this.notifySupply();
    this.notifyBuffer();
    return true;
  }

  /**
   * Loop de simulação em tempo real (60 FPS)
   */
  public update(dt: number): void {
    if (this.status !== 'PLAYING') return;

    this.elapsedSeconds += dt;

    // Atualiza cooldown de spawn por slot
    for (let i = 0; i < this.spawnCooldowns.length; i++) {
      if (this.spawnCooldowns[i] > 0) {
        this.spawnCooldowns[i] -= dt;
      }
    }

    // 1. Atualizar partículas
    this.updateParticles(dt);

    // 2. Despachar robôs (Enxame contínuo: se caixa tem 10, solta 10 robôs conforme blocos disponíveis)
    this.spawnSwarmRobots();

    // 3. Atualizar cada robô ativo em movimento ortogonal
    this.updateRobots(dt);

    // 4. Checar Condições de Fim de Jogo
    this.checkGameCompletion();
  }

  /**
   * Despacha robôs a partir de cada doca ativa, até o limite de capacidade da caixa
   */
  private spawnSwarmRobots() {
    for (const slot of this.bufferSlots) {
      const box = slot.box;
      if (!box || box.remaining <= 0) continue;

      // Conta quantos robôs já estão a caminho (buscando ou colhendo) para esta caixa.
      // Robôs que já estão 'EXITING' já decrementaram box.remaining e não devem travar novos spawns.
      const inFlightBots = this.robots.filter(
        (r) => r.slotIndex === slot.index && (r.status === 'SEEKING' || r.status === 'HARVESTING')
      );
      const unspawnedNeeded = box.remaining - inFlightBots.length;

      // Se ainda precisamos de robôs e o cooldown permitiu
      if (unspawnedNeeded > 0 && this.spawnCooldowns[slot.index] <= 0) {
        // Encontra blocos expostos da cor desta caixa que não estão reservados
        const exposedCells = EdgeDetector.getExposedCells(this.grid, box.colorId);
        const availableTargets = exposedCells.filter(
          (c) => !this.reservedCells.has(`${c.x},${c.y}`)
        );

        if (availableTargets.length === 0) continue;

        // Posição de largada da doca em coordenadas de grade
        const dockPos = this.getDockGridPos(slot.index);
        const dockWorld = this.dockPositions[slot.index] || { x: 100, y: 400 };

        // Testa quais alvos possuem rota ortogonal transitável até eles
        const validCandidates: { cell: { x: number; y: number }; path: GridPoint[] }[] = [];

        for (const candidate of availableTargets) {
          const path = Pathfinder.findPathToBlockFace(
            dockPos.x,
            dockPos.y,
            candidate.x,
            candidate.y,
            this.grid,
            this.level.width,
            this.level.height
          );

          if (path && path.length > 0) {
            validCandidates.push({ cell: candidate, path });
          }
        }

        if (validCandidates.length > 0) {
          // Seleciona o candidato mais próximo deste slot (Distância Pré-calculada)
          const bestCandidate = this.distanceMatrix.getClosestExposedTarget(
            slot.index,
            validCandidates.map((v) => v.cell)
          );

          if (bestCandidate) {
            const chosen = validCandidates.find(
              (v) => v.cell.x === bestCandidate.x && v.cell.y === bestCandidate.y
            )!;

            // Reserva o bloco alvo
            this.reservedCells.add(`${bestCandidate.x},${bestCandidate.y}`);

            // Rota estritamente ortogonal:
            // 1. Sobe verticalmente da doca para o corredor inferior de trânsito
            // 2. Alinha horizontalmente até a entrada do grid deste slot
            // 3. Segue o caminho BFS ortogonal pelo grid até o bloco
            const corridorY = this.gridBounds.offsetY + this.level.height * this.gridBounds.cellPixelSize + this.gridBounds.cellPixelSize / 2;
            const gridEntry = this.gridToWorld(dockPos.x, dockPos.y);

            const worldWaypoints = [
              { x: dockWorld.x, y: corridorY },
              { x: gridEntry.x, y: corridorY },
              ...chosen.path.map((p) => this.gridToWorld(p.x, p.y)),
            ];

            const bot: MiniBot = {
              id: `bot_${this.botCounter++}`,
              slotIndex: slot.index,
              colorId: box.colorId,
              status: 'SEEKING',
              x: dockWorld.x,
              y: dockWorld.y,
              currentGridX: dockPos.x,
              currentGridY: dockPos.y,
              targetGridX: bestCandidate.x,
              targetGridY: bestCandidate.y,
              dockX: dockWorld.x,
              dockY: dockWorld.y,
              cargoColor: null,
              waypoints: worldWaypoints,
              waypointIndex: 0,
              actionTimer: 0,
              speed: 260, // Velocidade rápida e fluida de marcha ortogonal
              angle: -Math.PI / 2,
            };

            this.robots.push(bot);
            // Intervalo de 90ms entre spawns para criar uma fila/comboio visualmente organizado
            this.spawnCooldowns[slot.index] = 0.09;
          }
        }
      }
    }
  }

  /**
   * Atualiza a física e a navegação ortogonal dos robôs
   */
  private updateRobots(dt: number) {
    let gridDirty = false;
    let bufferDirty = false;

    for (let i = this.robots.length - 1; i >= 0; i--) {
      const bot = this.robots[i];
      const slot = this.bufferSlots[bot.slotIndex];
      const box = slot?.box;

      switch (bot.status) {
        case 'SEEKING': {
          // Segue os waypoints ortogonais até o bloco alvo
          if (bot.waypointIndex < bot.waypoints.length) {
            const wp = bot.waypoints[bot.waypointIndex];
            const dx = wp.x - bot.x;
            const dy = wp.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Ajusta o ângulo estritamente em eixos ortogonais (90 graus)
            if (Math.abs(dx) > Math.abs(dy)) {
              bot.angle = dx > 0 ? 0 : Math.PI;
            } else {
              bot.angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
            }

            const step = bot.speed * dt;
            if (dist <= step || dist < 3) {
              bot.x = wp.x;
              bot.y = wp.y;
              bot.waypointIndex++;
            } else {
              bot.x += (dx / dist) * step;
              bot.y += (dy / dist) * step;
            }
          } else {
            // Chegou à face livre do bloco! Inicia coleta
            bot.status = 'HARVESTING';
            bot.actionTimer = 0.08; // Pop satisfatório
          }
          break;
        }

        case 'HARVESTING': {
          bot.actionTimer -= dt;
          if (bot.actionTimer <= 0) {
            const targetColor = this.grid[bot.targetGridY]?.[bot.targetGridX];
            if (targetColor) {
              // 1. Remove o bloco do tabuleiro (agora a célula vira null e fica transitável!)
              this.grid[bot.targetGridY][bot.targetGridX] = null;
              this.reservedCells.delete(`${bot.targetGridX},${bot.targetGridY}`);

              // 2. Decrementa a caixa do slot
              if (box) {
                box.remaining = Math.max(0, box.remaining - 1);
                bufferDirty = true;
              }
              this.totalCollectedBlocks++;

              // 3. Efeitos de colheita
              const targetWorld = this.gridToWorld(bot.targetGridX, bot.targetGridY);
              this.spawnBlockParticles(targetWorld.x, targetWorld.y, targetColor);
              SoundManager.playHarvest(1 + (this.totalCollectedBlocks % 15) * 0.04);

              bot.cargoColor = targetColor;
              bot.currentGridX = bot.targetGridX;
              bot.currentGridY = bot.targetGridY;

              // 4. Calcula rota ortogonal até a PORTINHA LATERAL mais próxima!
              const exitPath = Pathfinder.findPathToSideExit(
                bot.currentGridX,
                bot.currentGridY,
                this.grid,
                this.level.width,
                this.level.height
              );

              // Converte caminho até a porta lateral direita em coordenadas do Canvas
              const exitWaypoints = exitPath.map((p) => {
                if (p.x >= this.level.width) return { x: this.rightDoor.x, y: this.rightDoor.y };
                return this.gridToWorld(p.x, p.y);
              });

              // Ponto final de penetração na porta para o robô sair da tela
              exitWaypoints.push({ x: this.rightDoor.x + 8, y: this.rightDoor.y });

              bot.waypoints = exitWaypoints;
              bot.waypointIndex = 0;
              bot.status = 'EXITING';
              gridDirty = true;
            } else {
              // Bloco já sumiu, libera
              this.reservedCells.delete(`${bot.targetGridX},${bot.targetGridY}`);
              this.robots.splice(i, 1);
            }
          }
          break;
        }

        case 'EXITING': {
          // Segue rota ortogonal até sair pela portinha lateral
          if (bot.waypointIndex < bot.waypoints.length) {
            const wp = bot.waypoints[bot.waypointIndex];
            const dx = wp.x - bot.x;
            const dy = wp.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (Math.abs(dx) > Math.abs(dy)) {
              bot.angle = dx > 0 ? 0 : Math.PI;
            } else {
              bot.angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
            }

            const step = bot.speed * dt;
            if (dist <= step || dist < 3) {
              bot.x = wp.x;
              bot.y = wp.y;
              bot.waypointIndex++;
            } else {
              bot.x += (dx / dist) * step;
              bot.y += (dy / dist) * step;
            }
          } else {
            // Saiu pela portinha lateral!
            SoundManager.playDeposit();
            this.spawnExitDoorParticles(bot.x, bot.y, bot.cargoColor || '#ffffff');

            // Remove o robô que concluiu sua entrega
            this.robots.splice(i, 1);

            // Se a caixa zerou e não há mais robôs desse slot na tela, libera a doca!
            if (box && box.remaining === 0) {
              const remainingBotsForSlot = this.robots.filter((r) => r.slotIndex === bot.slotIndex);
              if (remainingBotsForSlot.length === 0) {
                SoundManager.playBoxComplete();
                slot.box = null;
                bufferDirty = true;
              }
            }
          }
          break;
        }
      }
    }

    if (gridDirty) this.notifyGrid();
    if (bufferDirty) this.notifyBuffer();
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
    const count = 10;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color: hex,
        size: 3 + Math.random() * 3,
        alpha: 1,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
      });
    }
  }

  private spawnExitDoorParticles(x: number, y: number, colorHex: string) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: -20 - Math.random() * 30,
        color: colorHex,
        size: 2.5,
        alpha: 1,
        life: 0.25,
        maxLife: 0.25,
      });
    }
  }

  private checkGameCompletion() {
    // Vitória: Todos os blocos coletados e nenhum robô com carga pendente
    const remaining = EdgeDetector.countRemainingBlocks(this.grid);
    if (remaining === 0 && this.robots.length === 0) {
      this.status = 'WON';
      SoundManager.playVictory();
      this.notifyStatus();
      return;
    }

    // Derrota (Deadlock):
    // 5 slots ocupados, nenhum robô em trânsito e nenhuma das 5 caixas tem alvos expostos
    const emptySlots = this.bufferSlots.filter((s) => s.box === null);
    if (emptySlots.length === 0 && this.robots.length === 0) {
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

      if (!anyCanCollect) {
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
    this.spawnCooldowns = [0, 0, 0, 0, 0];

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
