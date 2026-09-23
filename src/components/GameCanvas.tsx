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

      // 4. Calcular métricas do Grid e das Docas Integradas
      const gridW = engine.level.width;
      const gridH = engine.level.height;

      // Posição vertical e dimensões das 5 docas na base do Canvas
      const dockAreaH = Math.min(50, Math.max(36, Math.floor(height * 0.088)));
      const dockY = height - dockAreaH / 2 - 3;
      const dockSideMargin = 14;
      const dockAvailableW = width - dockSideMargin * 2;
      const dockSpacing = dockAvailableW / 5;
      const dockPositions = Array.from({ length: 5 }, (_, i) => ({
        x: Math.round(dockSideMargin + dockSpacing * i + dockSpacing / 2),
        y: Math.round(dockY),
      }));

      // Espaço máximo dedicado ao tabuleiro central:
      // O desenho sempre ocupa a maior área possível da tela, sem limites arbitrários
      const marginTop = 10;
      const bottomReserved = dockAreaH + 14; // Altura da doca + corredor inferior de trânsito
      const availableBoardH = Math.max(20, height - marginTop - bottomReserved);

      const marginLeft = 16;
      const marginRight = 32; // Espaço para a porta lateral direita (26px) e corredor
      const availableBoardW = Math.max(20, width - marginLeft - marginRight);

      // A escala da célula é adaptativa para preencher a área máxima
      // Se for 10x10, 20x20 ou 40x40, as medidas totais do tabuleiro são mantidas e as células encolhem
      const cellSize = Math.min(
        availableBoardW / gridW,
        availableBoardH / gridH
      );

      const boardPixelW = Math.round(gridW * cellSize);
      const boardPixelH = Math.round(gridH * cellSize);
      const offsetX = Math.round(marginLeft + (availableBoardW - boardPixelW) / 2);
      const offsetY = Math.round(marginTop + (availableBoardH - boardPixelH) / 2);

      // Notifica o motor das métricas espaciais para cálculo de caminhos e distâncias
      engine.updateLayoutMetrics(dockPositions, cellSize, offsetX, offsetY, width, height);

      // 5. Desenhar Grade de Fundo Sutil
      drawGridBackdrop(ctx, offsetX, offsetY, boardPixelW, boardPixelH, gridW, gridH, cellSize);

      // 6. Desenhar Blocos da Matriz (100% grudados sem gap)
      drawMatrixBlocks(ctx, engine.grid, palette, offsetX, offsetY, cellSize);

      // 7. Desenhar Docas dos 5 Slots (Círculos com quadrados e números apenas)
      drawDocks(ctx, dockPositions, engine);

      // 8. Desenhar Portinha Lateral Direita (Saída Exclusiva de Todos os Robôs)
      drawRightExitDoor(ctx, width, engine.rightDoor.y, currentTime);

      // 9. Desenhar Partículas
      drawParticles(ctx, engine);

      // 10. Desenhar Mini-Bots (Robôs Organizadores adaptados ao tamanho da célula)
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
    <div className="relative w-full h-full min-h-[160px] flex-1 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800/80 bg-slate-950 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
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
  // Moldura e fundo sutil do tabuleiro central
  ctx.save();
  ctx.fillStyle = '#0a101f';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fill();
  ctx.stroke();

  // Grid pontilhado suave de fundo (quando células são legíveis)
  if (cs >= 14) {
    ctx.fillStyle = '#33415533';
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        ctx.beginPath();
        ctx.arc(x + gx * cs + cs / 2, y + gy * cs + cs / 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/**
 * Desenha os blocos da matriz contíguos (100% grudados sem gap)
 * com contornos iluminados para peças expostas
 */
function drawMatrixBlocks(
  ctx: CanvasRenderingContext2D,
  grid: BoardGrid,
  palette: Record<string, ColorDef>,
  ox: number,
  oy: number,
  cs: number
) {
  const gh = grid.length;
  for (let gy = 0; gy < gh; gy++) {
    const row = grid[gy];
    if (!row) continue;
    const gw = row.length;
    for (let gx = 0; gx < gw; gx++) {
      const colorId = row[gx];
      if (!colorId) continue;

      const colorDef = palette[colorId];
      const hex = colorDef?.hex || '#94a3b8';

      // Pixel-snapping contíguo para garantir 0 gap sem frestas subpixel
      const x0 = Math.round(ox + gx * cs);
      const x1 = Math.round(ox + (gx + 1) * cs);
      const y0 = Math.round(oy + gy * cs);
      const y1 = Math.round(oy + (gy + 1) * cs);
      const cellW = x1 - x0;
      const cellH = y1 - y0;

      const isExposed = EdgeDetector.isCellExposed(grid, gx, gy);

      ctx.save();

      // Corpo principal do cubo da cor correspondente
      ctx.fillStyle = hex;
      ctx.fillRect(x0, y0, cellW, cellH);

      // Chanfro e gradiente de iluminação superior
      const grad = ctx.createLinearGradient(x0, y0, x0, y1);
      grad.addColorStop(0, '#ffffff30');
      grad.addColorStop(0.3, '#ffffff08');
      grad.addColorStop(1, '#00000028');
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y0, cellW, cellH);

      // Traço de divisão sutil entre blocos grudados (quando as células forem legíveis)
      if (cs >= 12) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, cellW - 1, cellH - 1);
      }

      // Contorno iluminado e ponto central nos blocos expostos (coletáveis)
      if (isExposed) {
        ctx.strokeStyle = '#ffffffdd';
        ctx.lineWidth = Math.max(1, Math.min(2.2, cs * 0.09));
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, cellW - 1, cellH - 1);

        // Ponto de destaque central
        const dotRadius = Math.max(1.2, Math.min(3.5, cellW * 0.12));
        ctx.fillStyle = '#ffffffcc';
        ctx.beginPath();
        ctx.arc(x0 + cellW / 2, y0 + cellH / 2, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

/**
 * Desenha as 5 Docas na base do Canvas.
 * Leva as cores direto para os círculos, mantendo quadrados com números apenas.
 * Sem pisca-pisca azul — apenas o número decrementando.
 */
function drawDocks(
  ctx: CanvasRenderingContext2D,
  docks: { x: number; y: number }[],
  engine: ContinuousGameEngine
) {
  docks.forEach((dock, idx) => {
    const slot = engine.bufferSlots[idx];
    const isOccupied = slot?.box !== null;
    const box = slot?.box;
    const colorDef = isOccupied && box ? engine.level.palette[box.colorId] : null;

    ctx.save();

    const spacing = docks.length > 1 ? docks[1].x - docks[0].x : 44;
    const baseRadius = Math.min(22, Math.max(13, Math.floor(spacing * 0.36)));

    // 1. Círculo base da doca receptora
    ctx.beginPath();
    ctx.arc(dock.x, dock.y, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = isOccupied && colorDef ? `${colorDef.hex}22` : '#0f172a99';
    ctx.fill();
    ctx.strokeStyle = isOccupied && colorDef ? `${colorDef.hex}66` : '#33415588';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Detalhe sutil no centro de doca livre
    if (!isOccupied) {
      ctx.fillStyle = '#33415566';
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Se ocupado por uma caixa: quadrado colorido com apenas o número restante
    if (isOccupied && box && colorDef) {
      const sqSize = Math.min(38, Math.max(24, Math.floor(spacing * 0.72)));
      const sqX = dock.x - sqSize / 2;
      const sqY = dock.y - sqSize / 2;
      const radius = Math.max(4, Math.floor(sqSize * 0.18));

      // Sombra projetada
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(sqX, sqY + 2, sqSize, sqSize, radius);
      ctx.fill();

      // Quadrado da cor da caixa
      ctx.fillStyle = colorDef.hex;
      ctx.beginPath();
      ctx.roundRect(sqX, sqY, sqSize, sqSize, radius);
      ctx.fill();

      // Chanfro e gradiente de volume sutil
      const grad = ctx.createLinearGradient(sqX, sqY, sqX, sqY + sqSize);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(sqX, sqY, sqSize, sqSize, radius);
      ctx.fill();

      // Borda nítida de contraste
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // APENAS O NÚMERO RESTANTE (reduzindo conforme os robôs coletam)
      const numStr = String(box.remaining);
      const scaleByLen = numStr.length >= 3 ? 0.38 : 0.52;
      const fontSize = Math.max(11, Math.min(20, Math.floor(sqSize * scaleByLen)));
      ctx.font = `900 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colorDef.textHex || '#ffffff';
      ctx.fillText(numStr, dock.x, dock.y);
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
  // O tamanho do robô se adapta suavemente à densidade da grade (10x10 até 40x40)
  const botRadius = Math.max(4.5, Math.min(14, cellSize * 0.45));

  for (const bot of engine.robots) {
    const colorDef = palette[bot.colorId];
    const hex = colorDef ? colorDef.hex : '#06b6d4';

    ctx.save();
    ctx.translate(bot.x, bot.y);
    ctx.rotate(bot.angle);

    // Sombra do robô
    ctx.fillStyle = '#00000055';
    ctx.beginPath();
    ctx.ellipse(0, Math.max(1, botRadius * 0.2), botRadius, botRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Esteiras / Rodinhas metálicas nas laterais
    ctx.fillStyle = '#1e293b';
    const wheelThick = Math.max(1.2, botRadius * 0.22);
    ctx.fillRect(-botRadius * 0.8, -botRadius * 0.9, botRadius * 1.6, wheelThick);
    ctx.fillRect(-botRadius * 0.8, botRadius * 0.9 - wheelThick, botRadius * 1.6, wheelThick);

    // Corpinho metálico arredondado
    const bodyGrad = ctx.createLinearGradient(-botRadius, 0, botRadius, 0);
    bodyGrad.addColorStop(0, '#e2e8f0');
    bodyGrad.addColorStop(0.5, '#ffffff');
    bodyGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-botRadius * 0.7, -botRadius * 0.7, botRadius * 1.4, botRadius * 1.4, Math.max(1, botRadius * 0.35));
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(0.8, botRadius * 0.1);
    ctx.stroke();

    // Visor LED frontal (cor correspondente da caixa)
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.roundRect(botRadius * 0.1, -botRadius * 0.45, botRadius * 0.5, botRadius * 0.9, Math.max(0.8, botRadius * 0.18));
    ctx.fill();

    // Brilho do visor (se tamanho permitir)
    if (botRadius >= 7) {
      ctx.fillStyle = '#ffffffcc';
      ctx.beginPath();
      ctx.arc(botRadius * 0.35, -botRadius * 0.15, Math.max(1, botRadius * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }

    // Carga carregada pelo robô (cubo sobre a cabeça ao retornar)
    if (bot.cargoColor) {
      const cargoDef = palette[bot.cargoColor];
      const cargoHex = cargoDef ? cargoDef.hex : '#ffffff';
      const cargoSize = botRadius * 0.9;

      ctx.save();
      ctx.fillStyle = cargoHex;
      ctx.beginPath();
      ctx.roundRect(-cargoSize / 2, -cargoSize / 2, cargoSize, cargoSize, Math.max(0.5, cargoSize * 0.18));
      ctx.fill();
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = Math.max(0.6, botRadius * 0.08);
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
