import React, { useRef, useEffect } from 'react';
import { BoardGrid, ColorDef } from '../core/Types';
import { ContinuousGameEngine } from '../core/ContinuousGameEngine';
import { EdgeDetector } from '../core/EdgeDetector';

interface GameCanvasProps {
  engine: ContinuousGameEngine;
  grid: BoardGrid;
  palette: Record<string, ColorDef>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  palette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // Loop de animação contínuo (60/120 FPS)
    const render = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // limite de segurança para dt
      lastTime = currentTime;

      // 1. Atualizar simulação do motor
      engine.update(dt);

      // 2. Ajustar resolução High-DPI
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 3. Limpar fundo
      ctx.fillStyle = '#090d16'; // Dark sci-fi blue background
      ctx.fillRect(0, 0, width, height);

      // 4. Calcular métricas do Grid e das Docas
      const gridW = engine.level.width;
      const gridH = engine.level.height;

      // Área dedicada ao grid: 72% da altura superior
      const gridAreaHeight = height * 0.72;
      const gridAreaWidth = width - 32;

      const cellSize = Math.min(
        Math.floor(gridAreaWidth / gridW),
        Math.floor(gridAreaHeight / gridH),
        44 // tamanho máximo de célula
      );

      const boardPixelW = gridW * cellSize;
      const boardPixelH = gridH * cellSize;
      const offsetX = Math.floor((width - boardPixelW) / 2);
      const offsetY = Math.floor((gridAreaHeight - boardPixelH) / 2) + 16;

      // Posição vertical das 5 docas na base do Canvas
      const dockY = height - 36;
      const dockAreaW = width - 40;
      const dockSpacing = dockAreaW / 5;
      const dockPositions = Array.from({ length: 5 }, (_, i) => ({
        x: 20 + dockSpacing * i + dockSpacing / 2,
        y: dockY,
      }));

      // Notifica o motor das métricas espaciais para cálculo de caminhos e distâncias
      engine.updateLayoutMetrics(dockPositions, cellSize, offsetX, offsetY, width, height);

      // 5. Desenhar Grade de Fundo Sutil
      drawGridBackdrop(ctx, offsetX, offsetY, boardPixelW, boardPixelH, gridW, gridH, cellSize);

      // 6. Desenhar Blocos da Matriz
      drawMatrixBlocks(ctx, engine.grid, palette, offsetX, offsetY, cellSize);

      // 7. Desenhar Docas dos 5 Slots
      drawDocks(ctx, dockPositions, engine);

      // 8. Desenhar Portinha Lateral Direita (Saída Exclusiva de Todos os Robôs)
      drawRightExitDoor(ctx, width, engine.rightDoor.y, currentTime);

      // 9. Desenhar Partículas
      drawParticles(ctx, engine);

      // 10. Desenhar Mini-Bots (Robôs Organizadores)
      drawRobots(ctx, engine, palette, cellSize);

      // 11. Efeito de Celebração de Vitória
      if (engine.status === 'WON') {
        drawVictoryConfetti(ctx, width, height, currentTime);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, palette]);

  return (
    <div className="relative w-full h-[400px] sm:h-[460px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800/80 bg-slate-950">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

// ============================================================================
// Funções Auxiliares de Renderização do Canvas
// ============================================================================

function drawGridBackdrop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  gw: number,
  gh: number,
  cs: number
) {
  // Sombra e fundo da moldura do tabuleiro
  ctx.save();
  ctx.fillStyle = '#0f172a88';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 16);
  ctx.fill();
  ctx.stroke();

  // Grid pontilhado suave
  ctx.fillStyle = '#33415533';
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      ctx.beginPath();
      ctx.arc(x + gx * cs + cs / 2, y + gy * cs + cs / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawMatrixBlocks(
  ctx: CanvasRenderingContext2D,
  grid: BoardGrid,
  palette: Record<string, ColorDef>,
  ox: number,
  oy: number,
  cs: number
) {
  const pad = Math.max(1, Math.floor(cs * 0.08));
  const innerSize = cs - pad * 2;
  const radius = Math.max(3, Math.floor(innerSize * 0.22));

  for (let gy = 0; gy < grid.length; gy++) {
    for (let gx = 0; gx < (grid[gy]?.length || 0); gx++) {
      const colorId = grid[gy][gx];
      if (!colorId) continue;

      const colorDef = palette[colorId];
      const hex = colorDef?.hex || '#94a3b8';
      const bx = ox + gx * cs + pad;
      const by = oy + gy * cs + pad;

      const isExposed = EdgeDetector.isCellExposed(grid, gx, gy);

      ctx.save();

      // Sombra inferior do bloco (efeito 3D suave)
      ctx.fillStyle = '#00000066';
      ctx.beginPath();
      ctx.roundRect(bx, by + 3, innerSize, innerSize, radius);
      ctx.fill();

      // Corpo principal do cubo
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(bx, by, innerSize, innerSize, radius);
      ctx.fill();

      // Brilho chanfrado superior (top highlight)
      const grad = ctx.createLinearGradient(bx, by, bx, by + innerSize);
      grad.addColorStop(0, '#ffffff55');
      grad.addColorStop(0.3, '#ffffff11');
      grad.addColorStop(1, '#00000044');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(bx, by, innerSize, innerSize, radius);
      ctx.fill();

      // Contorno / Borda iluminada se for exposto (acessível pelo robô)
      if (isExposed) {
        ctx.strokeStyle = '#ffffffdd';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Ponto de pulso brilhante central
        ctx.fillStyle = '#ffffffaa';
        ctx.beginPath();
        ctx.arc(bx + innerSize / 2, by + innerSize / 2, Math.max(1.5, innerSize * 0.09), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Células bloqueadas no miolo: contorno sutil
        ctx.strokeStyle = '#00000044';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}

function drawDocks(
  ctx: CanvasRenderingContext2D,
  docks: { x: number; y: number }[],
  engine: ContinuousGameEngine
) {
  docks.forEach((dock, idx) => {
    const slot = engine.bufferSlots[idx];
    const isOccupied = slot?.box !== null;
    const colorDef = isOccupied ? engine.level.palette[slot.box!.colorId] : null;

    ctx.save();

    // Base da doca
    ctx.fillStyle = isOccupied && colorDef ? `${colorDef.hex}33` : '#1e293b55';
    ctx.strokeStyle = isOccupied && colorDef ? colorDef.hex : '#33415588';
    ctx.lineWidth = isOccupied ? 2 : 1.5;

    ctx.beginPath();
    ctx.ellipse(dock.x, dock.y, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Luz de status da doca
    if (isOccupied && colorDef) {
      ctx.fillStyle = colorDef.hex;
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

function drawRobots(
  ctx: CanvasRenderingContext2D,
  engine: ContinuousGameEngine,
  palette: Record<string, ColorDef>,
  cellSize: number
) {
  const botRadius = Math.max(9, Math.min(15, cellSize * 0.45));

  for (const bot of engine.robots) {
    const colorDef = palette[bot.colorId];
    const hex = colorDef ? colorDef.hex : '#06b6d4';

    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.angle);

    // Sombra do robô
    ctx.fillStyle = '#00000055';
    ctx.beginPath();
    ctx.ellipse(0, 3, botRadius, botRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Esteiras / Rodinhas metálicas nas laterais
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-botRadius * 0.8, -botRadius * 0.9, botRadius * 1.6, 3);
    ctx.fillRect(-botRadius * 0.8, botRadius * 0.9 - 3, botRadius * 1.6, 3);

    // Corpinho metálico arredondado
    const bodyGrad = ctx.createLinearGradient(-botRadius, 0, botRadius, 0);
    bodyGrad.addColorStop(0, '#e2e8f0');
    bodyGrad.addColorStop(0.5, '#ffffff');
    bodyGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-botRadius * 0.7, -botRadius * 0.7, botRadius * 1.4, botRadius * 1.4, botRadius * 0.35);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Visor LED frontal (cor correspondente da caixa)
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.roundRect(botRadius * 0.1, -botRadius * 0.45, botRadius * 0.5, botRadius * 0.9, 2);
    ctx.fill();
    // Brilho do visor
    ctx.fillStyle = '#ffffffcc';
    ctx.beginPath();
    ctx.arc(botRadius * 0.35, -botRadius * 0.15, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Carga carregada pelo robô (cubo sobre a cabeça ao retornar)
    if (bot.cargoColor) {
      const cargoDef = palette[bot.cargoColor];
      const cargoHex = cargoDef ? cargoDef.hex : '#ffffff';
      const cargoSize = botRadius * 0.9;

      ctx.save();
      // Desenha o cubo carregado
      ctx.fillStyle = cargoHex;
      ctx.beginPath();
      ctx.roundRect(-cargoSize / 2, -cargoSize / 2, cargoSize, cargoSize, 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, engine: ContinuousGameEngine) {
  for (const p of engine.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1);
    ctx.fill();
    ctx.restore();
  }
}

function drawVictoryConfetti(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const confettiCount = 50;
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  for (let i = 0; i < confettiCount; i++) {
    const seed = i * 1337;
    const x = ((seed + time * 0.1) % w);
    const speed = 60 + (seed % 90);
    const y = ((time * 0.001 * speed + seed) % h);
    const size = 5 + (seed % 6);
    const angle = (time * 0.003 + seed) % (Math.PI * 2);
    const color = colors[i % colors.length];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
}

/**
 * Desenha a Portinha Lateral Direita por onde todos os robôs da fábrica saem
 */
function drawRightExitDoor(
  ctx: CanvasRenderingContext2D,
  width: number,
  exitY: number,
  time: number
) {
  const doorW = 28;
  const doorH = 58;
  const doorX = width - doorW;
  const doorY = exitY - doorH / 2;

  ctx.save();

  // 1. Moldura metálica externa da porta com chanfro
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(doorX, doorY - 10, doorW + 4, doorH + 20, [8, 0, 0, 8]);
  ctx.fill();
  ctx.stroke();

  // 2. Abertura do portal / interior escuro onde os robôs entram
  const innerGrad = ctx.createLinearGradient(doorX + 4, doorY, doorX + doorW, doorY);
  innerGrad.addColorStop(0, '#090d16');
  innerGrad.addColorStop(1, '#020617');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.roundRect(doorX + 4, doorY, doorW, doorH, [6, 0, 0, 6]);
  ctx.fill();
  ctx.strokeStyle = '#06b6d4'; // Brilho neon ciano
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Faixas zebradas de aviso (amarelo e preto) no piso da soleira
  ctx.save();
  ctx.beginPath();
  ctx.rect(doorX + 4, doorY + doorH - 6, doorW - 4, 6);
  ctx.clip();
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = s % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(doorX + s * 6, doorY + doorH - 6, 6, 6);
  }
  ctx.restore();

  // 4. Painel superior com LED pulsante
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(doorX + 2, doorY - 10, doorW, 9);

  // LED verde esmeralda no topo indicando porta aberta e ativa
  const pulse = (Math.sin(time * 0.005) + 1) / 2;
  ctx.fillStyle = '#10b981';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 4 + pulse * 6;
  ctx.beginPath();
  ctx.arc(doorX + doorW / 2, doorY - 5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 5. Seta animada neon "▶" apontando para dentro da porta
  const arrowPulse = (time * 0.004) % 1;
  const arrowX = doorX + 8 + arrowPulse * 6;
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(arrowX, exitY - 6);
  ctx.lineTo(arrowX + 7, exitY);
  ctx.lineTo(arrowX, exitY + 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
