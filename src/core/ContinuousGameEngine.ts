import {
  BoardGrid,
  BufferSlot,
  CanvasParticle,
  LevelData,
  MiniBot,
  SupplyBox,
  GlobalTuningSettings,
  DEFAULT_GLOBAL_TUNING,
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
  onBoxDeposited?: (colorId: string) => void;
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
  public depositedBoxesQueue: { id: number; colorId: string }[] = [];
  private depositCounter: number = 1;
  public tuning: GlobalTuningSettings;

  // Tabela de distâncias pré-calculada para seleção de alvo
  public distanceMatrix: DistanceMatrix;

  // Células atualmente reservadas por robôs a caminho
  private reservedCells = new Set<string>();

  // Coordenadas mundiais das docas dos slots
  private dockPositions: { x: number; y: number }[] = [];

  // Fila de robôs organizadores na esteira (IDs na ordem de atendimento)
  public conveyorQueue: string[] = [];

  // Posição de descarregamento na ponta da esteira
  public conveyorTip = {
    x: 375,
    y: 280,
    dropX: 375,
    dropY: 315,
    safeAisleX: 335,
    conveyorW: 46,
  };

  // Coordenadas da porta lateral direita de saída
  public rightDoor = {
    x: 390,
    y: 200,
    width: 24,
    height: 54,
  };

  // Cooldown de spawn por slot para manter robôs em fila ritmada
  private spawnCooldowns: number[] = [];

  // Dimensões do grid e do canvas
  public gridBounds = {
    cellPixelSize: 32,
    offsetX: 0,
    offsetY: 0,
  };

  private listeners: ContinuousEngineListener = {};
  public elapsedSeconds: number = 0;
  private botCounter = 1;

  constructor(
    level: LevelData,
    listener?: ContinuousEngineListener,
    tuning?: GlobalTuningSettings
  ) {
    this.level = level;
    if (listener) this.listeners = listener;
    this.tuning = tuning ? { ...tuning } : { ...DEFAULT_GLOBAL_TUNING };

    const bufferCount = level.bufferSize || 5;

    this.grid = level.initialGrid.map((row) => [...row]);
    this.bufferSlots = Array.from({ length: bufferCount }, (_, index) => ({
      index,
      box: null,
    }));
    this.spawnCooldowns = Array.from({ length: bufferCount }, () => 0);

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
    this.distanceMatrix = new DistanceMatrix(level.width, level.height, bufferCount);

    this.dockPositions = Array.from({ length: bufferCount }, (_, i) => ({
      x: 60 + i * 70,
      y: 420,
    }));
  }

  /**
   * Atualiza as configurações de tuning em tempo real
   */
  public updateTuning(newTuning: GlobalTuningSettings): void {
    this.tuning = { ...newTuning };
    for (const bot of this.robots) {
      bot.speed = this.tuning.robotSpeed;
    }
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
    canvasHeight: number,
    conveyorTip?: { x: number; y: number; dropX: number; dropY: number; safeAisleX?: number; conveyorW?: number }
  ) {
    this.dockPositions = docks;
    this.gridBounds.cellPixelSize = cellPixelSize;
    this.gridBounds.offsetX = offsetX;
    this.gridBounds.offsetY = offsetY;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    if (conveyorTip) {
      const cW = conveyorTip.conveyorW ?? 46;
      const safeAisle = conveyorTip.safeAisleX ?? Math.round(conveyorTip.dropX - cW / 2 - 14);
      this.conveyorTip = {
        x: conveyorTip.x,
        y: conveyorTip.y,
        dropX: conveyorTip.dropX,
        dropY: conveyorTip.dropY,
        safeAisleX: safeAisle,
        conveyorW: cW,
      };
    } else {
      const topWallH = Math.min(48, Math.max(32, Math.floor(canvasHeight * 0.08)));
      const dockConsoleH = Math.min(76, Math.max(54, Math.floor(canvasHeight * 0.125)));
      const conveyorW = Math.min(54, Math.max(38, Math.floor(canvasWidth * 0.125)));
      const conveyorH = Math.round((canvasHeight - topWallH - dockConsoleH) * 0.5);
      const tipX = canvasWidth - conveyorW / 2 - 2;
      const tipY = topWallH + conveyorH;
      const botRadius = Math.max(9.5, Math.min(23, cellPixelSize * 0.60));
      const safeAisle = Math.round(canvasWidth - conveyorW - botRadius - 6);
      this.conveyorTip = {
        x: tipX,
        y: tipY,
        dropX: tipX,
        dropY: Math.round(tipY + botRadius * 1.5 + 8),
        safeAisleX: safeAisle,
        conveyorW: conveyorW,
      };
    }

    this.rightDoor.x = canvasWidth - 14;
    this.rightDoor.y = this.conveyorTip.dropY;
  }

  /**
   * Retorna a coordenada mundial do slot k da fila de espera da esteira.
   * Os robôs se enfileiram verticalmente abaixo da ponta da esteira,
   * com espaçamento físico generoso para nunca se encavalarem ou subirem na esteira.
   */
  public getQueueSlotWorld(queueIndex: number): { x: number; y: number } {
    const botRadius = Math.max(9.5, Math.min(23, this.gridBounds.cellPixelSize * 0.60));
    // Espaçamento generoso entre centros para garantir gap visível de 10-14px
    const queueSpacing = Math.round(botRadius * 2.2 + 8);
    const maxVertical = 4;

    if (queueIndex <= maxVertical) {
      return {
        x: this.conveyorTip.dropX,
        y: this.conveyorTip.dropY + queueIndex * queueSpacing,
      };
    } else {
      // Se acumular mais de 5 robôs na fila, contorna em L para a esquerda no corredor inferior
      const extra = queueIndex - maxVertical;
      return {
        x: Math.max(20, this.conveyorTip.dropX - extra * queueSpacing),
        y: this.conveyorTip.dropY + maxVertical * queueSpacing,
      };
    }
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
    const totalSlots = this.level.bufferSize || 5;
    const normX = totalSlots > 1 ? slotIndex / (totalSlots - 1) : 0.5;
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

      // Se ainda precisamos despachar robôs desta caixa e o cooldown permitiu
      if (this.spawnCooldowns[slot.index] <= 0) {
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
              boxId: box.id,
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
              speed: this.tuning.robotSpeed, // Velocidade configurável
              angle: -Math.PI / 2,
            };

            this.robots.push(bot);
            // Intervalo configurável entre spawns para ritmo dinâmico
            this.spawnCooldowns[slot.index] = this.tuning.spawnCooldown;

            // Subtrai imediatamente o número da dock buffer
            box.remaining = Math.max(0, box.remaining - 1);

            // Ao chegar em zero (todos estão em trânsito), a dock buffer já libera!
            if (box.remaining === 0) {
              SoundManager.playBoxComplete();
              slot.box = null;
            }
            this.notifyBuffer();
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

    for (let i = this.robots.length - 1; i >= 0; i--) {
      const bot = this.robots[i];

      switch (bot.status) {
        case 'SEEKING': {
          // Segue os waypoints ortogonais até o bloco alvo
          if (bot.waypointIndex < bot.waypoints.length) {
            const wp = bot.waypoints[bot.waypointIndex];
            const dx = wp.x - bot.x;
            const dy = wp.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Ajusta o ângulo e movimento estritamente em eixos ortogonais (Manhattan)
            if (Math.abs(dx) > Math.abs(dy)) {
              bot.angle = dx > 0 ? 0 : Math.PI;
              const step = Math.min(Math.abs(dx), bot.speed * dt);
              bot.x += Math.sign(dx) * step;
            } else if (Math.abs(dy) > 0.001) {
              bot.angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
              const step = Math.min(Math.abs(dy), bot.speed * dt);
              bot.y += Math.sign(dy) * step;
            }

            if (dist < 2 || (Math.abs(wp.x - bot.x) < 1.5 && Math.abs(wp.y - bot.y) < 1.5)) {
              bot.x = wp.x;
              bot.y = wp.y;
              bot.waypointIndex++;
            }
          } else {
            // Chegou à face livre do bloco! Inicia coleta
            bot.status = 'HARVESTING';
            bot.actionTimer = this.tuning.harvestTime; // Pop satisfatório configurável
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
              this.totalCollectedBlocks++;

              // 2. Efeitos de colheita
              const targetWorld = this.gridToWorld(bot.targetGridX, bot.targetGridY);
              this.spawnBlockParticles(targetWorld.x, targetWorld.y, targetColor);
              SoundManager.playHarvest(1 + (this.totalCollectedBlocks % 15) * 0.04);

              bot.cargoColor = targetColor;
              bot.currentGridX = bot.targetGridX;
              bot.currentGridY = bot.targetGridY;

              // 3. Adiciona o robô à fila de descarregamento da esteira
              this.conveyorQueue.push(bot.id);
              const queueIndex = this.conveyorQueue.length - 1;
              bot.queueIndex = queueIndex;
              const targetSlot = this.getQueueSlotWorld(queueIndex);

              // 4. Calcula rota estritamente ortogonal (Manhattan) até o slot da fila:
              // - BFS ortogonal do bloco até a borda lateral direita (x = width)
              const exitPath = Pathfinder.findPathToSideExit(
                bot.currentGridX,
                bot.currentGridY,
                this.grid,
                this.level.width,
                this.level.height
              );

              // Converte caminho do grid para coordenadas reais do Canvas
              const gridWorldPoints = exitPath.map((p) => this.gridToWorld(p.x, p.y));
              const lastGridPoint = gridWorldPoints.length > 0
                ? gridWorldPoints[gridWorldPoints.length - 1]
                : targetWorld;

              // Rota Manhattan estritamente ortogonal e segura contra a esteira:
              // 1. Segue o grid até o corredor lateral direito (lastGridPoint.x, lastGridPoint.y)
              // 2. Alinha horizontalmente até o corredor seguro à esquerda da esteira (safeAisleX)
              // 3. Desce verticalmente pelo safeAisleX até a altura do slot da fila (targetSlot.y)
              // 4. Alinha horizontalmente para a direita até o slot da fila (targetSlot.x)
              const safeAisleX = this.conveyorTip.safeAisleX;
              const worldWaypoints = [...gridWorldPoints];

              if (Math.abs(lastGridPoint.x - safeAisleX) > 1) {
                worldWaypoints.push({ x: safeAisleX, y: lastGridPoint.y });
              }
              if (Math.abs(lastGridPoint.y - targetSlot.y) > 1) {
                worldWaypoints.push({ x: safeAisleX, y: targetSlot.y });
              }
              worldWaypoints.push({ x: targetSlot.x, y: targetSlot.y });

              bot.waypoints = worldWaypoints;
              bot.waypointIndex = 0;
              bot.status = 'WAITING_IN_QUEUE';
              gridDirty = true;
            } else {
              // Bloco já sumiu, libera
              this.reservedCells.delete(`${bot.targetGridX},${bot.targetGridY}`);
              this.robots.splice(i, 1);
            }
          }
          break;
        }

        case 'WAITING_IN_QUEUE': {
          // Segue os waypoints ortogonais até o seu slot na fila
          if (bot.waypointIndex < bot.waypoints.length) {
            const wp = bot.waypoints[bot.waypointIndex];
            const dx = wp.x - bot.x;
            const dy = wp.y - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Ajusta o ângulo e movimento estritamente em eixos ortogonais (Manhattan)
            if (Math.abs(dx) > Math.abs(dy)) {
              bot.angle = dx > 0 ? 0 : Math.PI;
              const step = Math.min(Math.abs(dx), bot.speed * dt);
              bot.x += Math.sign(dx) * step;
            } else if (Math.abs(dy) > 0.001) {
              bot.angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
              const step = Math.min(Math.abs(dy), bot.speed * dt);
              bot.y += Math.sign(dy) * step;
            }

            if (dist < 2 || (Math.abs(wp.x - bot.x) < 1.5 && Math.abs(wp.y - bot.y) < 1.5)) {
              bot.x = wp.x;
              bot.y = wp.y;
              bot.waypointIndex++;
            }
          } else {
            // Chegou ao seu slot na fila!
            // Se for o primeiro da fila (posição 0, na ponta da esteira):
            if (this.conveyorQueue[0] === bot.id) {
              bot.status = 'DEPOSITING';
              bot.actionTimer = this.tuning.harvestTime; // Demora o mesmo tempo para deixar a caixa que levou para colher
              bot.angle = -Math.PI / 2; // Voltado para cima, em direção à ponta da esteira
            } else {
              // Permanece aguardando na fila, voltado para cima (em direção à esteira)
              bot.angle = -Math.PI / 2;
            }
          }
          break;
        }

        case 'DEPOSITING': {
          bot.angle = -Math.PI / 2; // Apontado para cima (ponta da esteira)
          bot.actionTimer -= dt;
          if (bot.actionTimer <= 0) {
            // Deixou a caixa na ponta da esteira!
            SoundManager.playDeposit();
            const cargoColor = bot.cargoColor || '#ffffff';
            this.spawnExitDoorParticles(this.conveyorTip.x, this.conveyorTip.y, cargoColor);
            this.depositedBoxesQueue.push({
              id: this.depositCounter++,
              colorId: cargoColor,
            });
            this.listeners.onBoxDeposited?.(cargoColor);

            bot.cargoColor = null;

            // Remove o robô da frente da fila
            if (this.conveyorQueue[0] === bot.id) {
              this.conveyorQueue.shift();
            }

            // Atualiza todos os robôs restantes na fila para avançarem de slot ordenadamente
            for (let q = 0; q < this.conveyorQueue.length; q++) {
              const qBotId = this.conveyorQueue[q];
              const qBot = this.robots.find((r) => r.id === qBotId);
              if (qBot) {
                qBot.queueIndex = q;
                const nextSlot = this.getQueueSlotWorld(q);

                if (qBot.waypointIndex >= qBot.waypoints.length) {
                  // O robô já estava esperando parado na fila: dá um passo ortogonal à frente
                  qBot.waypoints = [{ x: nextSlot.x, y: nextSlot.y }];
                  qBot.waypointIndex = 0;
                } else {
                  // O robô ainda está em trânsito vindo da matriz/corredor:
                  // Atualiza apenas os waypoints finais do slot sem descartar a rota em andamento (evita drift diagonal!)
                  const wpLen = qBot.waypoints.length;
                  if (wpLen >= 2) {
                    qBot.waypoints[wpLen - 2].y = nextSlot.y;
                    qBot.waypoints[wpLen - 1].x = nextSlot.x;
                    qBot.waypoints[wpLen - 1].y = nextSlot.y;
                  } else if (wpLen === 1) {
                    qBot.waypoints[0] = { x: nextSlot.x, y: nextSlot.y };
                  }
                }
              }
            }

            // "Deixou a caixa aí sim ele vira e sai pela lateral direita (não desaparece, vai andando pra direita até sumir)"
            bot.status = 'EXITING';
            bot.angle = 0; // Vira para a direita
          }
          break;
        }

        case 'EXITING': {
          bot.angle = 0; // Anda para a direita
          bot.x += bot.speed * dt;

          // Só desaparece quando sair completamente pela lateral direita
          if (bot.x >= this.canvasWidth + 28) {
            this.robots.splice(i, 1);
          }
          break;
        }
      }
    }

    if (gridDirty) this.notifyGrid();
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
    this.conveyorQueue = [];
    this.depositedBoxesQueue = [];
    const bufferCount = this.level.bufferSize || 5;
    this.spawnCooldowns = Array.from({ length: bufferCount }, () => 0);

    this.grid = this.level.initialGrid.map((row) => [...row]);
    this.bufferSlots = Array.from({ length: bufferCount }, (_, index) => ({
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
