import React, { useRef, useEffect } from 'react';
import { BoardGrid, ColorDef, MiniBot } from '../core/Types';
import { ContinuousGameEngine } from '../core/ContinuousGameEngine';
import { EdgeDetector } from '../core/EdgeDetector';
import { getColorDef } from '../core/Colors';

interface GameCanvasProps {
  engine: ContinuousGameEngine;
  grid: BoardGrid;
  palette: Record<string, ColorDef>;
}

interface ConveyorBox {
  id: number;
  x: number;
  y: number;
  colorId: string;
  speed: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  palette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const conveyorBoxesRef = useRef<ConveyorBox[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    // Loop de animação contínuo (60/120 FPS)
    const render = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // 1. Atualizar simulação do motor
      engine.update(dt);

      // 2. Atualizar caixas na esteira rolante (viajam para cima até o portal de saída)
      const conveyorBoxes = conveyorBoxesRef.current;
      for (let i = conveyorBoxes.length - 1; i >= 0; i--) {
        const cb = conveyorBoxes[i];
        cb.y -= cb.speed * dt;
        // Se entrou no portal no topo da esteira, remove
        if (cb.y < 45) {
          conveyorBoxes.splice(i, 1);
        }
      }

      // 3. Atualizar caixas que foram depositadas na saída pelo robô
      while (engine.depositedBoxesQueue.length > 0) {
        const dep = engine.depositedBoxesQueue.shift()!;
        conveyorBoxes.push({
          id: dep.id,
          x: engine.rightDoor.x,
          y: Math.max(70, engine.rightDoor.y),
          colorId: dep.colorId,
          speed: 85,
        });
      }

      // 4. Ajustar resolução High-DPI
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 5. Métricas de Layout Industriais (adaptadas dinamicamente ao Canvas)
      const gridW = engine.level.width;
      const gridH = engine.level.height;

      // Larguras dos elementos de ambiente
      const leftWallW = Math.min(54, Math.max(36, Math.floor(width * 0.11)));
      const conveyorW = Math.min(52, Math.max(38, Math.floor(width * 0.12)));
      const topWallH = Math.min(46, Math.max(32, Math.floor(height * 0.08)));
      const dockConsoleH = Math.min(74, Math.max(52, Math.floor(height * 0.12)));

      // Espaço do tabuleiro no piso de concreto da fábrica
      const availableBoardW = Math.max(20, width - leftWallW - conveyorW - 20);
      const availableBoardH = Math.max(20, height - topWallH - dockConsoleH - 24);

      const cellSize = Math.min(
        availableBoardW / gridW,
        availableBoardH / gridH
      );

      const boardPixelW = Math.round(gridW * cellSize);
      const boardPixelH = Math.round(gridH * cellSize);
      const offsetX = Math.round(leftWallW + 8 + (availableBoardW - boardPixelW) / 2);
      const offsetY = Math.round(topWallH + 8 + (availableBoardH - boardPixelH) / 2);

      // Posições das 5 Docas no console industrial inferior
      const dockSpacing = (width - 16) / 5;
      const dockY = height - dockConsoleH / 2 - 2;
      const dockPositions = Array.from({ length: 5 }, (_, i) => ({
        x: Math.round(8 + dockSpacing * i + dockSpacing / 2),
        y: Math.round(dockY),
      }));

      // Notifica o motor das métricas espaciais
      engine.updateLayoutMetrics(dockPositions, cellSize, offsetX, offsetY, width, height);
      engine.rightDoor.x = width - conveyorW / 2 - 2;
      engine.rightDoor.y = offsetY + (gridH * cellSize) / 2;

      // 6. Renderizar Cenário da Fábrica (Piso de Concreto, Parede Superior, Parede Esquerda)
      drawFactoryEnvironment(
        ctx,
        width,
        height,
        topWallH,
        leftWallW,
        conveyorW,
        dockConsoleH,
        currentTime,
        offsetX,
        offsetY,
        boardPixelW,
        boardPixelH
      );

      // 7. Renderizar Esteira Rolante e Portal de Saída lateral ("SAÍDA >>")
      drawConveyorAndPortal(
        ctx,
        width,
        height,
        conveyorW,
        topWallH,
        dockConsoleH,
        currentTime,
        conveyorBoxes,
        palette
      );

      // 8. Renderização Z-Buffer Ordenada por Profundidade (Painter's Algorithm)
      // Combina caixas 3D e robôs AGVs ordenados pela coordenada Y para oclusão física perfeita!
      renderDepthSortedEntities(
        ctx,
        engine,
        palette,
        offsetX,
        offsetY,
        cellSize,
        gridW,
        gridH,
        currentTime
      );

      // 9. Renderizar Partículas de Impacto/Colheita
      drawParticles(ctx, engine);

      // 10. Renderizar Console Industrial das 5 Docas na Base
      drawDockConsole(
        ctx,
        dockPositions,
        dockConsoleH,
        height,
        width,
        engine,
        palette,
        currentTime
      );

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
    <div className="relative w-full h-full min-h-[160px] flex-1 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800 bg-slate-950 flex items-center justify-center select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
      />
    </div>
  );
};

// ============================================================================
// Funções Auxiliares de Shading & Cores Hexadecimais
// ============================================================================

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((ch) => ch + ch).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustBrightness(hex: string, factor: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((ch) => ch + ch).join('');
  }
  const num = parseInt(c, 16);
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ============================================================================
// 1. Cenário e Ambiente Industrial da Mini-Fábrica
// ============================================================================

function drawFactoryEnvironment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  topWallH: number,
  leftWallW: number,
  conveyorW: number,
  dockConsoleH: number,
  time: number,
  ox: number,
  oy: number,
  bw: number,
  bh: number
) {
  // A. Piso de Concreto Industrial da Fábrica
  const floorGrad = ctx.createLinearGradient(0, topWallH, 0, h - dockConsoleH);
  floorGrad.addColorStop(0, '#333b49');
  floorGrad.addColorStop(0.5, '#2b323f');
  floorGrad.addColorStop(1, '#242a35');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(leftWallW, topWallH, w - leftWallW - conveyorW, h - topWallH - dockConsoleH);

  // B. Juntas das Lajes Modulares de Concreto (Slabs)
  const slabSize = 56;
  ctx.save();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = leftWallW + slabSize; x < w - conveyorW; x += slabSize) {
    ctx.moveTo(x, topWallH);
    ctx.lineTo(x, h - dockConsoleH);
  }
  for (let y = topWallH + slabSize; y < h - dockConsoleH; y += slabSize) {
    ctx.moveTo(leftWallW, y);
    ctx.lineTo(w - conveyorW, y);
  }
  ctx.stroke();

  // C. Marcas de Frenagem / Curva de Pneu no Piso (Tire Skid Marks)
  ctx.strokeStyle = 'rgba(10, 14, 23, 0.22)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Curva de retorno perto da doca
  ctx.moveTo(ox + 20, h - dockConsoleH - 25);
  ctx.quadraticCurveTo(ox + 45, h - dockConsoleH - 45, ox + 80, h - dockConsoleH - 20);
  // Curva de entrada na esteira
  ctx.moveTo(w - conveyorW - 35, oy + bh / 2 + 30);
  ctx.quadraticCurveTo(w - conveyorW - 15, oy + bh / 2, w - conveyorW - 5, oy + bh / 2 - 20);
  ctx.stroke();

  // D. Setas Industriais Direcionais no Piso (>>>) apontando para a esteira
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  const arrowX = w - conveyorW - 24;
  const arrowY = h - dockConsoleH - 55;
  for (let s = 0; s < 2; s++) {
    const py = arrowY + s * 14;
    ctx.beginPath();
    ctx.moveTo(arrowX - 8, py - 5);
    ctx.lineTo(arrowX, py);
    ctx.lineTo(arrowX - 8, py + 5);
    ctx.lineTo(arrowX - 4, py);
    ctx.closePath();
    ctx.fill();
  }

  // E. Iluminação Projetada dos Refletores Superiores (Luz Suave no Piso)
  const spot1 = ctx.createRadialGradient(leftWallW + 80, topWallH + 60, 5, leftWallW + 80, topWallH + 60, 180);
  spot1.addColorStop(0, 'rgba(255, 247, 237, 0.08)');
  spot1.addColorStop(1, 'transparent');
  ctx.fillStyle = spot1;
  ctx.fillRect(leftWallW, topWallH, w - leftWallW - conveyorW, h - topWallH - dockConsoleH);

  ctx.restore();

  // F. Parede Superior (Bulkhead Industrial)
  ctx.save();
  // Viga metálica principal
  const beamGrad = ctx.createLinearGradient(0, 0, 0, topWallH);
  beamGrad.addColorStop(0, '#1e2532');
  beamGrad.addColorStop(0.7, '#283141');
  beamGrad.addColorStop(1, '#181e29');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, w, topWallH);

  // Rebites industriais na viga
  ctx.fillStyle = '#475569';
  for (let rx = 24; rx < w - 24; rx += 36) {
    ctx.beginPath();
    ctx.arc(rx, topWallH - 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tubulação amarela de segurança com braçadeiras pretas
  const pipeY = topWallH - 18;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, pipeY, w, 6);
  ctx.fillStyle = '#0f172a';
  for (let px = 40; px < w; px += 70) {
    ctx.fillRect(px, pipeY - 1.5, 5, 9);
  }

  // Refletores pendurados com cone sutil
  for (let lx = 90; lx < w - 60; lx += 140) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(lx - 5, topWallH - 10, 10, 8);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lx, topWallH - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Borda chanfrada inferior da parede
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, topWallH);
  ctx.lineTo(w, topWallH);
  ctx.stroke();
  ctx.restore();

  // G. Parede Lateral Esquerda (Placa Industrial, Faixas de Segurança, Tanques)
  ctx.save();
  const leftWallGrad = ctx.createLinearGradient(0, 0, leftWallW, 0);
  leftWallGrad.addColorStop(0, '#1a202c');
  leftWallGrad.addColorStop(0.85, '#222a38');
  leftWallGrad.addColorStop(1, '#141a24');
  ctx.fillStyle = leftWallGrad;
  ctx.fillRect(0, topWallH, leftWallW, h - topWallH - dockConsoleH);

  // Faixa zebrada amarela e preta de perigo na borda
  const stripeW = 5;
  for (let sy = topWallH; sy < h - dockConsoleH; sy += 10) {
    ctx.fillStyle = Math.floor(sy / 10) % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(leftWallW - stripeW, sy, stripeW, 10);
  }

  // Tanques de gás comprimido / cilindros industriais
  const tankW = Math.max(8, leftWallW * 0.32);
  const tankH = 34;
  const tankX = 6;
  const tankY = topWallH + 30;
  // Tanque 1
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.roundRect(tankX, tankY, tankW, tankH, [tankW / 2, tankW / 2, 2, 2]);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(tankX + 2, tankY + 4, 2, tankH - 8);
  // Tanque 2
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(tankX + tankW + 2, tankY + 6, tankW, tankH - 6, [tankW / 2, tankW / 2, 2, 2]);
  ctx.fill();

  // Placa Industrial: COLOR COLLECT / SMALL ROBOTS
  const plaqueX = 4;
  const plaqueY = tankY + tankH + 16;
  const plaqueW = leftWallW - stripeW - 8;
  const plaqueH = Math.min(68, Math.max(48, leftWallW * 1.3));

  if (plaqueW >= 22) {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 3);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4 Parafusos nos cantos da placa
    ctx.fillStyle = '#64748b';
    ctx.fillRect(plaqueX + 1.5, plaqueY + 1.5, 1.5, 1.5);
    ctx.fillRect(plaqueX + plaqueW - 3, plaqueY + 1.5, 1.5, 1.5);
    ctx.fillRect(plaqueX + 1.5, plaqueY + plaqueH - 3, 1.5, 1.5);
    ctx.fillRect(plaqueX + plaqueW - 3, plaqueY + plaqueH - 3, 1.5, 1.5);

    // Texto industrial elegante na placa (se espaço permitir)
    if (plaqueW >= 28) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 6.5px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COLOR', plaqueX + plaqueW / 2, plaqueY + 12);
      ctx.fillText('COLLECT', plaqueX + plaqueW / 2, plaqueY + 20);

      ctx.fillStyle = '#475569';
      ctx.font = '700 4px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('SMALL ROBOTS', plaqueX + plaqueW / 2, plaqueY + 30);
      ctx.fillText('BIG LOGISTICS', plaqueX + plaqueW / 2, plaqueY + 36);
    }
  }

  // Corrimão amarelo de segurança
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, h - dockConsoleH - 60);
  ctx.lineTo(leftWallW - 8, h - dockConsoleH - 60);
  ctx.moveTo(leftWallW - 8, h - dockConsoleH - 60);
  ctx.lineTo(leftWallW - 8, h - dockConsoleH - 12);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 2. Esteira Rolante e Portal de Saída Lateral ("SAÍDA >>")
// ============================================================================

function drawConveyorAndPortal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  conveyorW: number,
  topWallH: number,
  dockConsoleH: number,
  time: number,
  conveyorBoxes: ConveyorBox[],
  palette: Record<string, ColorDef>
) {
  const conveyorX = w - conveyorW;
  const conveyorY = topWallH;
  const conveyorH = h - topWallH - dockConsoleH;

  ctx.save();

  // A. Canal metálico da esteira
  const channelGrad = ctx.createLinearGradient(conveyorX, 0, w, 0);
  channelGrad.addColorStop(0, '#141a24');
  channelGrad.addColorStop(0.3, '#1f2735');
  channelGrad.addColorStop(0.8, '#18202d');
  channelGrad.addColorStop(1, '#0f141d');
  ctx.fillStyle = channelGrad;
  ctx.fillRect(conveyorX, conveyorY, conveyorW, conveyorH);

  // Faixas amarelas e pretas de segurança na guia esquerda da esteira
  const stripeW = 4;
  for (let sy = conveyorY; sy < conveyorY + conveyorH; sy += 10) {
    ctx.fillStyle = Math.floor(sy / 10) % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(conveyorX, sy, stripeW, 10);
  }

  // Trilho guia direito
  ctx.fillStyle = '#334155';
  ctx.fillRect(w - 3, conveyorY, 3, conveyorH);

  // B. Roletes Animados da Esteira (Roller Bed que gira continuamente)
  const rollerSpacing = 11;
  const scrollOffset = (time * 0.05) % rollerSpacing;
  const rollerX = conveyorX + stripeW + 2;
  const rollerW = conveyorW - stripeW - 5;

  ctx.lineWidth = 1;
  for (let ry = conveyorY + 50 - scrollOffset; ry < conveyorY + conveyorH; ry += rollerSpacing) {
    const rollerGrad = ctx.createLinearGradient(0, ry - 2, 0, ry + 2);
    rollerGrad.addColorStop(0, '#475569');
    rollerGrad.addColorStop(0.5, '#94a3b8');
    rollerGrad.addColorStop(1, '#334155');
    ctx.fillStyle = rollerGrad;
    ctx.beginPath();
    ctx.roundRect(rollerX, ry - 2, rollerW, 4, 1.5);
    ctx.fill();
  }

  // C. Caixas Físicas Transportadas na Esteira Rolante
  for (const box of conveyorBoxes) {
    const colorDef = getColorDef(palette, box.colorId);
    const boxSize = Math.min(24, Math.max(16, rollerW * 0.72));
    const bx = rollerX + (rollerW - boxSize) / 2;
    const by = box.y;

    // Sombra da caixa na esteira
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(bx + boxSize / 2, by + boxSize - 1, boxSize * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Frente da caixa
    const frontH = Math.round(boxSize * 0.35);
    ctx.fillStyle = adjustBrightness(colorDef.hex, 0.75);
    ctx.beginPath();
    ctx.roundRect(bx, by + boxSize - frontH, boxSize, frontH, [0, 0, 3, 3]);
    ctx.fill();

    // Topo da caixa
    ctx.fillStyle = colorDef.hex;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxSize, boxSize - frontH, [3, 3, 0, 0]);
    ctx.fill();

    // Fita adesiva da caixa
    ctx.fillStyle = 'rgba(217, 119, 6, 0.6)';
    ctx.fillRect(bx + boxSize * 0.38, by, boxSize * 0.24, boxSize - frontH);
  }

  // D. Portal Iluminado de Saída ("SAÍDA >>") no Topo da Esteira
  const portalH = 50;
  const portalY = topWallH - 4;

  // Abertura interna escura do túnel
  const tunnelGrad = ctx.createLinearGradient(0, portalY, 0, portalY + portalH);
  tunnelGrad.addColorStop(0, '#020617');
  tunnelGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = tunnelGrad;
  ctx.beginPath();
  ctx.roundRect(rollerX - 2, portalY + 8, rollerW + 4, portalH - 8, [6, 6, 0, 0]);
  ctx.fill();

  // Arco neon azul/ciano do portal
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(rollerX - 2, portalY + 8, rollerW + 4, portalH - 8, [6, 6, 0, 0]);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Placa superior com o letreiro neon: "SAÍDA >>"
  const plaqueH = 16;
  const plaqueW = conveyorW - 4;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(conveyorX + 2, portalY, plaqueW, plaqueH, 4);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Letras e setas iluminadas
  const pulse = (Math.sin(time * 0.006) + 1) / 2;
  ctx.fillStyle = pulse > 0.1 ? '#38bdf8' : '#e0f2fe';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 4 + pulse * 6;
  ctx.font = '900 8.5px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAÍDA >>', conveyorX + plaqueW / 2 + 2, portalY + plaqueH / 2);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ============================================================================
// 3. Renderização Z-Buffer Ordenada por Profundidade (Painter's Algorithm)
// ============================================================================

type RenderableEntity =
  | { type: 'BOX'; y: number; gx: number; gy: number; colorId: string }
  | { type: 'ROBOT'; y: number; bot: MiniBot };

function renderDepthSortedEntities(
  ctx: CanvasRenderingContext2D,
  engine: ContinuousGameEngine,
  palette: Record<string, ColorDef>,
  ox: number,
  oy: number,
  cs: number,
  gw: number,
  gh: number,
  time: number
) {
  const entities: RenderableEntity[] = [];

  // A. Coleta todas as caixas presentes no grid
  for (let gy = 0; gy < gh; gy++) {
    const row = engine.grid[gy];
    if (!row) continue;
    for (let gx = 0; gx < gw; gx++) {
      const colorId = row[gx];
      if (colorId) {
        entities.push({
          type: 'BOX',
          y: oy + (gy + 1) * cs,
          gx,
          gy,
          colorId,
        });
      }
    }
  }

  // B. Coleta todos os robôs organizadores ativos
  for (const bot of engine.robots) {
    entities.push({
      type: 'ROBOT',
      y: bot.y,
      bot,
    });
  }

  // C. Ordenação estrita do fundo para a frente (Painter's Algorithm)
  entities.sort((a, b) => a.y - b.y);

  // D. Renderiza cada entidade na ordem correta
  for (const ent of entities) {
    if (ent.type === 'BOX') {
      const isExposed = EdgeDetector.isCellExposed(engine.grid, ent.gx, ent.gy);
      const colorDef = getColorDef(palette, ent.colorId);
      draw3DPhysicalBox(ctx, ent.gx, ent.gy, ox, oy, cs, colorDef, isExposed);
    } else {
      drawAGVRobot(ctx, ent.bot, palette, cs, time);
    }
  }
}

// ============================================================================
// 4. Caixas Físicas 3D no Tabuleiro (Physically-Grounded 3D Boxes)
// ============================================================================

function draw3DPhysicalBox(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  ox: number,
  oy: number,
  cs: number,
  colorDef: ColorDef,
  isExposed: boolean
) {
  // Posições com pixel snapping contíguo (sem frestas subpixel)
  const x0 = Math.round(ox + gx * cs);
  const x1 = Math.round(ox + (gx + 1) * cs);
  const y0 = Math.round(oy + gy * cs);
  const y1 = Math.round(oy + (gy + 1) * cs);
  const cellW = x1 - x0;
  const cellH = y1 - y0;

  // Altura da extrusão 2.5D da caixa (chanfro vertical frontal)
  const hExtrude = Math.max(3, Math.round(cs * 0.28));
  const radius = Math.max(1, Math.round(cs * 0.08));

  ctx.save();

  // A. Sombra de Contato com o Piso (Occlusion Shadow suave sob a base da caixa)
  ctx.fillStyle = 'rgba(10, 14, 23, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x0 + cellW / 2, y1 - 1, cellW * 0.48, Math.max(2, cs * 0.12), 0, 0, Math.PI * 2);
  ctx.fill();

  // B. Face Frontal Vertical (Tonalidade mais escura para criar volume real)
  const frontY = y1 - hExtrude;
  const frontH = hExtrude;
  const frontColor = adjustBrightness(colorDef.hex, 0.72);
  const frontGrad = ctx.createLinearGradient(x0, frontY, x0, y1);
  frontGrad.addColorStop(0, frontColor);
  frontGrad.addColorStop(1, adjustBrightness(colorDef.hex, 0.58));

  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.roundRect(x0, frontY, cellW, frontH, [0, 0, radius, radius]);
  ctx.fill();

  // Fenda sutil da aba frontal de papelão
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + cellW / 2, frontY + 1);
  ctx.lineTo(x0 + cellW / 2, y1 - 1);
  ctx.stroke();

  // Mini etiqueta / código de barras na face frontal (detalhe realista de pacote de fábrica)
  if (cs >= 18) {
    const labelW = Math.max(7, Math.round(cellW * 0.28));
    const labelH = Math.max(3, Math.round(frontH * 0.55));
    const labelX = x0 + Math.round(cellW * 0.15);
    const labelY = frontY + Math.round((frontH - labelH) / 2);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(labelX, labelY, labelW, labelH);

    // Listras do código de barras
    ctx.fillStyle = '#1e293b';
    for (let bx = labelX + 1.5; bx < labelX + labelW - 1.5; bx += 2) {
      ctx.fillRect(bx, labelY + 0.8, 1, labelH - 1.6);
    }
  }

  // C. Face Superior Horizontal (Iluminada com o tom vibrante da cor da caixa)
  const topY = y0 - hExtrude;
  const topH = cellH;
  ctx.fillStyle = colorDef.hex;
  ctx.beginPath();
  ctx.roundRect(x0, topY, cellW, topH, [radius, radius, 0, 0]);
  ctx.fill();

  // Gradiente de reflexo e chanfro luminoso na face superior
  const topGrad = ctx.createLinearGradient(x0, topY, x0 + cellW, topY + topH);
  topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  topGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.roundRect(x0, topY, cellW, topH, [radius, radius, 0, 0]);
  ctx.fill();

  // Borda chanfrada de separação entre caixas grudadas
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // D. Fita Adesiva de Vedação na Face Superior (Packing Tape)
  const tapeW = Math.max(3, Math.round(cellW * 0.22));
  const tapeX = x0 + Math.round((cellW - tapeW) / 2);
  ctx.fillStyle = 'rgba(217, 119, 6, 0.48)'; // Fita adesiva ambar translúcida
  ctx.fillRect(tapeX, topY, tapeW, topH);

  // Filete de brilho na fita adesiva
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(tapeX + Math.round(tapeW / 2) - 0.5, topY, 1, topH);

  // E. Realce de Bloco Exposto (Pronto para Coleta pelo Robô)
  if (isExposed) {
    // 1. Contorno luminoso suave e nítido nas bordas da face superior
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(1.2, Math.min(2.2, cs * 0.08));
    ctx.beginPath();
    ctx.roundRect(x0 + 0.5, topY + 0.5, cellW - 1, topH - 1, [radius, radius, 0, 0]);
    ctx.stroke();

    // 2. Cantoneiras de precisão industrial nos 4 cantos da face superior
    const bLen = Math.max(3, Math.round(cellW * 0.22));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, Math.min(2.5, cs * 0.09));
    ctx.beginPath();
    // Canto Superior Esquerdo
    ctx.moveTo(x0 + 1, topY + 1 + bLen);
    ctx.lineTo(x0 + 1, topY + 1);
    ctx.lineTo(x0 + 1 + bLen, topY + 1);
    // Canto Superior Direito
    ctx.moveTo(x0 + cellW - 1 - bLen, topY + 1);
    ctx.lineTo(x0 + cellW - 1, topY + 1);
    ctx.lineTo(x0 + cellW - 1, topY + 1 + bLen);
    // Canto Inferior Esquerdo
    ctx.moveTo(x0 + 1, topY + topH - 1 - bLen);
    ctx.lineTo(x0 + 1, topY + topH - 1);
    ctx.lineTo(x0 + 1 + bLen, topY + topH - 1);
    // Canto Inferior Direito
    ctx.moveTo(x0 + cellW - 1 - bLen, topY + topH - 1);
    ctx.lineTo(x0 + cellW - 1, topY + topH - 1);
    ctx.lineTo(x0 + cellW - 1, topY + topH - 1 - bLen);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// 5. Robôs Organizadores (Mini-AGVs / Veículos Autônomos de Transporte 2.5D)
// ============================================================================

/**
 * Desenha uma caixa 3D isométrica/oblíqua física carregada nos garfos do AGV,
 * garantindo perspectiva, iluminação e gravidade estritamente consistentes com o mundo.
 */
function draw2DBoxOnForks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colorDef: ColorDef
) {
  const frontH = Math.max(3, Math.round(size * 0.34));
  const radius = Math.max(1, Math.round(size * 0.1));

  ctx.save();

  // Sombra de oclusão da caixinha sob a base
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size / 2, size * 0.46, Math.max(2, size * 0.14), 0, 0, Math.PI * 2);
  ctx.fill();

  const x0 = Math.round(cx - size / 2);
  const y0 = Math.round(cy - size / 2);

  // 1. Face Frontal (+Y, vertical, voltada para o jogador)
  const frontY = y0 + size - frontH;
  ctx.fillStyle = adjustBrightness(colorDef.hex, 0.72);
  ctx.beginPath();
  ctx.roundRect(x0, frontY, size, frontH, [0, 0, radius, radius]);
  ctx.fill();

  // Fenda de aba da caixa
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, frontY);
  ctx.lineTo(cx, y0 + size);
  ctx.stroke();

  // 2. Face Superior (-Y, horizontal, iluminada pelo teto)
  ctx.fillStyle = colorDef.hex;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, size - frontH, [radius, radius, 0, 0]);
  ctx.fill();

  // Gradiente de brilho superior
  const grad = ctx.createLinearGradient(x0, y0, x0 + size, y0 + size - frontH);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, size - frontH, [radius, radius, 0, 0]);
  ctx.fill();

  // 3. Fita adesiva ambar translúcida
  const tapeW = Math.max(2, Math.round(size * 0.24));
  ctx.fillStyle = 'rgba(217, 119, 6, 0.65)';
  ctx.fillRect(Math.round(cx - tapeW / 2), y0, tapeW, size - frontH);

  // Filete de contorno fino
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, size, radius);
  ctx.stroke();

  ctx.restore();
}

function drawAGVRobot(
  ctx: CanvasRenderingContext2D,
  bot: MiniBot,
  palette: Record<string, ColorDef>,
  cellSize: number,
  time: number
) {
  const botRadius = Math.max(5.5, Math.min(16, cellSize * 0.46));
  const targetColorDef = getColorDef(palette, bot.colorId);

  // Normaliza o ângulo ortogonal no intervalo [-PI, PI]
  let a = bot.angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;

  const isMovingDown = Math.abs(a - Math.PI / 2) < 0.4;
  const isMovingUp = Math.abs(a + Math.PI / 2) < 0.4;
  const isMovingLeft = Math.abs(Math.abs(a) - Math.PI) < 0.4;
  const isMovingRight = !isMovingDown && !isMovingUp && !isMovingLeft;

  // Efeito de suspensão na colheita
  const bounce = bot.status === 'HARVESTING' ? Math.sin(bot.actionTimer * 32) * 2.5 : 0;
  const bx = bot.x;
  const by = bot.y + bounce;

  const cargoDef = bot.cargoColor ? getColorDef(palette, bot.cargoColor) : null;
  const cargoSize = Math.max(8, Math.round(botRadius * 1.15));

  ctx.save();

  // A. Sombra de Contato do AGV no Piso de Concreto
  ctx.fillStyle = 'rgba(10, 14, 23, 0.44)';
  ctx.beginPath();
  ctx.ellipse(bx, bot.y + botRadius * 0.35, botRadius * 1.25, botRadius * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  // B. Se estiver indo para CIMA com carga, a carga fica atrás do robô em 2.5D: desenha antes!
  if (cargoDef && isMovingUp) {
    draw2DBoxOnForks(ctx, bx, by - botRadius * 0.9, cargoSize, cargoDef);
  }

  // Dimensões do chassi adaptadas à direção
  const isVertical = isMovingDown || isMovingUp;
  const bodyW = isVertical ? botRadius * 1.3 : botRadius * 1.48;
  const bodyH = isVertical ? botRadius * 1.48 : botRadius * 1.3;
  const bodyX = bx - bodyW / 2;
  const bodyY = by - bodyH / 2;
  const bodyRadius = Math.max(2, botRadius * 0.32);

  // C. Rodas Emborrachadas do AGV
  ctx.fillStyle = '#0f172a'; // Borracha preta
  const rimColor = '#94a3b8';

  if (!isVertical) {
    // Marcha horizontal (Direita ou Esquerda)
    const wheelW = botRadius * 0.58;
    const wheelH = Math.max(2, botRadius * 0.24);
    const xRear = bx - bodyW / 2 + 1;
    const xFront = bx + bodyW / 2 - wheelW - 1;
    const yTop = by - bodyH / 2 - wheelH * 0.35;
    const yBottom = by + bodyH / 2 - wheelH * 0.65;

    // 4 Rodas
    ctx.fillRect(xRear, yTop, wheelW, wheelH);
    ctx.fillRect(xFront, yTop, wheelW, wheelH);
    ctx.fillRect(xRear, yBottom, wheelW, wheelH);
    ctx.fillRect(xFront, yBottom, wheelW, wheelH);

    // Calotas metálicas
    ctx.fillStyle = rimColor;
    ctx.fillRect(xRear + wheelW * 0.3, yTop + 0.5, wheelW * 0.4, wheelH - 1);
    ctx.fillRect(xFront + wheelW * 0.3, yTop + 0.5, wheelW * 0.4, wheelH - 1);
    ctx.fillRect(xRear + wheelW * 0.3, yBottom + 0.5, wheelW * 0.4, wheelH - 1);
    ctx.fillRect(xFront + wheelW * 0.3, yBottom + 0.5, wheelW * 0.4, wheelH - 1);
  } else {
    // Marcha vertical (Baixo ou Cima)
    const wheelW = Math.max(2, botRadius * 0.24);
    const wheelH = botRadius * 0.58;
    const xLeft = bx - bodyW / 2 - wheelW * 0.35;
    const xRight = bx + bodyW / 2 - wheelW * 0.65;
    const yRear = by - bodyH / 2 + 1;
    const yFront = by + bodyH / 2 - wheelH - 1;

    // 4 Rodas
    ctx.fillRect(xLeft, yRear, wheelW, wheelH);
    ctx.fillRect(xRight, yRear, wheelW, wheelH);
    ctx.fillRect(xLeft, yFront, wheelW, wheelH);
    ctx.fillRect(xRight, yFront, wheelW, wheelH);

    // Calotas metálicas
    ctx.fillStyle = rimColor;
    ctx.fillRect(xLeft + 0.5, yRear + wheelH * 0.3, wheelW - 1, wheelH * 0.4);
    ctx.fillRect(xRight + 0.5, yRear + wheelH * 0.3, wheelW - 1, wheelH * 0.4);
    ctx.fillRect(xLeft + 0.5, yFront + wheelH * 0.3, wheelW - 1, wheelH * 0.4);
    ctx.fillRect(xRight + 0.5, yFront + wheelH * 0.3, wheelW - 1, wheelH * 0.4);
  }

  // D. Garfos Mecânicos Frontais de Elevação
  const forkThick = Math.max(1.8, botRadius * 0.16);
  const forkLen = botRadius * 0.5;
  ctx.fillStyle = '#64748b';

  if (isMovingRight) {
    const fx = bx + bodyW / 2 - 1;
    ctx.fillRect(fx, by - botRadius * 0.4, forkLen, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.4 - forkThick, forkLen, forkThick);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(fx + forkLen - 1.5, by - botRadius * 0.4, 1.5, forkThick);
    ctx.fillRect(fx + forkLen - 1.5, by + botRadius * 0.4 - forkThick, 1.5, forkThick);
  } else if (isMovingLeft) {
    const fx = bx - bodyW / 2 - forkLen + 1;
    ctx.fillRect(fx, by - botRadius * 0.4, forkLen, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.4 - forkThick, forkLen, forkThick);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(fx, by - botRadius * 0.4, 1.5, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.4 - forkThick, 1.5, forkThick);
  } else if (isMovingDown) {
    const fy = by + bodyH / 2 - 1;
    ctx.fillRect(bx - botRadius * 0.4, fy, forkThick, forkLen);
    ctx.fillRect(bx + botRadius * 0.4 - forkThick, fy, forkThick, forkLen);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bx - botRadius * 0.4, fy + forkLen - 1.5, forkThick, 1.5);
    ctx.fillRect(bx + botRadius * 0.4 - forkThick, fy + forkLen - 1.5, forkThick, 1.5);
  } else {
    // Up
    const fy = by - bodyH / 2 - forkLen + 1;
    ctx.fillRect(bx - botRadius * 0.4, fy, forkThick, forkLen);
    ctx.fillRect(bx + botRadius * 0.4 - forkThick, fy, forkThick, forkLen);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bx - botRadius * 0.4, fy, forkThick, 1.5);
    ctx.fillRect(bx + botRadius * 0.4 - forkThick, fy, forkThick, 1.5);
  }

  // E. Chassi Metálico Arredondado (Iluminação do Teto Consistente)
  const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  bodyGrad.addColorStop(0, '#ffffff'); // Luz do teto industrial
  bodyGrad.addColorStop(0.5, '#e2e8f0');
  bodyGrad.addColorStop(1, '#94a3b8'); // Sombra da base
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, bodyRadius);
  ctx.fill();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(0.8, botRadius * 0.09);
  ctx.stroke();

  // F. Visor Frontal LED & Olhos Digitais Expressivos
  const eyeColor = targetColorDef ? targetColorDef.hex : '#38bdf8';

  if (isMovingRight) {
    const vw = Math.max(2.5, botRadius * 0.35);
    const vh = botRadius * 0.8;
    const vx = bx + bodyW / 2 - vw - 1;
    const vy = by - vh / 2;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1, botRadius * 0.15));
    ctx.fill();

    // Olhos luminosos olhando para a direita
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(vx + vw * 0.55, by - botRadius * 0.2, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.55, by + botRadius * 0.2, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.fill();
  } else if (isMovingLeft) {
    const vw = Math.max(2.5, botRadius * 0.35);
    const vh = botRadius * 0.8;
    const vx = bx - bodyW / 2 + 1;
    const vy = by - vh / 2;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1, botRadius * 0.15));
    ctx.fill();

    // Olhos luminosos olhando para a esquerda
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(vx + vw * 0.45, by - botRadius * 0.2, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.45, by + botRadius * 0.2, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.fill();
  } else if (isMovingDown) {
    // Visor frontal voltado diretamente para o jogador!
    const vw = botRadius * 0.8;
    const vh = Math.max(2.5, botRadius * 0.35);
    const vx = bx - vw / 2;
    const vy = by + bodyH / 2 - vh - 1;

    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1, botRadius * 0.15));
    ctx.fill();

    // Olhos luminosos olhando para frente
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(bx - botRadius * 0.2, vy + vh * 0.55, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.arc(bx + botRadius * 0.2, vy + vh * 0.55, Math.max(1, botRadius * 0.13), 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Traseira do robô (lanterna indicadora traseira)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx - botRadius * 0.3, by + bodyH / 2 - 2, botRadius * 0.18, 1.5);
    ctx.fillRect(bx + botRadius * 0.12, by + bodyH / 2 - 2, botRadius * 0.18, 1.5);
  }

  // G. Cúpula / Sinalizador Superior Iluminado (Warm Amber Beacon)
  const domeRadius = Math.max(2, botRadius * 0.3);
  const domeX = bx;
  const domeY = by - (isMovingDown ? 1.5 : 0);
  const pulse = (Math.sin(time * 0.007) + 1) / 2;

  // Brilho quente âmbar pulsante
  const beaconGlow = ctx.createRadialGradient(domeX, domeY, 1, domeX, domeY, domeRadius * 2);
  beaconGlow.addColorStop(0, 'rgba(251, 191, 36, 0.95)');
  beaconGlow.addColorStop(0.5, `rgba(245, 158, 11, ${0.4 + pulse * 0.4})`);
  beaconGlow.addColorStop(1, 'rgba(217, 119, 6, 0)');
  ctx.fillStyle = beaconGlow;
  ctx.beginPath();
  ctx.arc(domeX, domeY, domeRadius * 2, 0, Math.PI * 2);
  ctx.fill();

  // Cúpula física
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(domeX, domeY, domeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reflexo na cúpula
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(domeX - domeRadius * 0.3, domeY - domeRadius * 0.3, domeRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // H. Carga nos Garfos Frontais (quando indo para Direita, Esquerda ou Baixo)
  if (cargoDef && !isMovingUp) {
    if (isMovingRight) {
      draw2DBoxOnForks(ctx, bx + botRadius * 0.92, by, cargoSize, cargoDef);
    } else if (isMovingLeft) {
      draw2DBoxOnForks(ctx, bx - botRadius * 0.92, by, cargoSize, cargoDef);
    } else if (isMovingDown) {
      draw2DBoxOnForks(ctx, bx, by + botRadius * 0.88, cargoSize, cargoDef);
    }
  }

  ctx.restore();
}

// ============================================================================
// 6. Console Industrial das 5 Docas na Base
// ============================================================================

function drawDockConsole(
  ctx: CanvasRenderingContext2D,
  docks: { x: number; y: number }[],
  dockConsoleH: number,
  h: number,
  w: number,
  engine: ContinuousGameEngine,
  palette: Record<string, ColorDef>,
  time: number
) {
  const consoleY = h - dockConsoleH;

  ctx.save();

  // A. Placa de Chassi Metálico Angular da Base
  const chassisGrad = ctx.createLinearGradient(0, consoleY, 0, h);
  chassisGrad.addColorStop(0, '#1a222e');
  chassisGrad.addColorStop(0.3, '#222d3d');
  chassisGrad.addColorStop(1, '#0e141d');
  ctx.fillStyle = chassisGrad;
  ctx.fillRect(0, consoleY, w, dockConsoleH);

  // Friso chanfrado superior metálico
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, consoleY);
  ctx.lineTo(w, consoleY);
  ctx.stroke();

  // Parafusos industriais aparentes nas extremidades do console
  ctx.fillStyle = '#64748b';
  ctx.fillRect(6, consoleY + 4, 3, 3);
  ctx.fillRect(w - 9, consoleY + 4, 3, 3);

  // Faixas amarelas de advertência nos cantos inferiores do console
  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(10 + s * 8, h - 4, 4, 4);
    ctx.fillRect(w - 30 + s * 8, h - 4, 4, 4);
  }

  // B. As 5 Baias Rebaixadas com Botões Táteis 3D
  const spacing = docks.length > 1 ? docks[1].x - docks[0].x : 54;
  const buttonSize = Math.min(52, Math.max(34, Math.floor(spacing * 0.78)));

  docks.forEach((dock, idx) => {
    const slot = engine.bufferSlots[idx];
    const isOccupied = slot?.box !== null;
    const box = slot?.box;
    const colorDef = isOccupied && box ? getColorDef(palette, box.colorId) : null;

    const bx = Math.round(dock.x - buttonSize / 2);
    const by = Math.round(dock.y - buttonSize / 2);
    const radius = Math.max(4, Math.floor(buttonSize * 0.2));

    ctx.save();

    // 1. Rebaixo da baia no chassi metálico (Baia Rebaixada)
    ctx.fillStyle = '#0b0f17';
    ctx.beginPath();
    ctx.roundRect(bx - 2, by - 2, buttonSize + 4, buttonSize + 4, radius + 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!isOccupied) {
      // Baia Livre / Standby: contorno pontilhado suave e ponto de espera
      ctx.strokeStyle = '#47556966';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 1, buttonSize - 2, buttonSize - 2, radius);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#33415544';
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (box && colorDef) {
      // 2. Baia Ocupada: Botão Elevado 3D com a Cor da Caixa (Estilo da Referência)
      // Sombra projetada do botão
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(bx, by + 3, buttonSize, buttonSize, radius);
      ctx.fill();

      // Corpo principal do botão da cor da caixa
      ctx.fillStyle = colorDef.hex;
      ctx.beginPath();
      ctx.roundRect(bx, by, buttonSize, buttonSize, radius);
      ctx.fill();

      // Chanfro e gradiente de volume superior do botão
      const btnGrad = ctx.createLinearGradient(bx, by, bx, by + buttonSize);
      btnGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      btnGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
      btnGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, buttonSize, buttonSize, radius);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Miniatura de Caixa 3D Isométrica no Topo do Botão (com fita adesiva)
      const iconSize = Math.max(10, Math.floor(buttonSize * 0.36));
      const iconX = dock.x - iconSize / 2;
      const iconY = by + Math.floor(buttonSize * 0.12);

      // Sombra da mini-caixa no botão
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(iconX, iconY + 1, iconSize, iconSize);

      // Frente da mini-caixa
      const miniFrontH = Math.round(iconSize * 0.35);
      ctx.fillStyle = adjustBrightness(colorDef.hex, 0.72);
      ctx.fillRect(iconX, iconY + iconSize - miniFrontH, iconSize, miniFrontH);

      // Topo da mini-caixa
      ctx.fillStyle = adjustBrightness(colorDef.hex, 1.15);
      ctx.fillRect(iconX, iconY, iconSize, iconSize - miniFrontH);

      // Fita adesiva na mini-caixa
      ctx.fillStyle = 'rgba(217, 119, 6, 0.75)';
      ctx.fillRect(iconX + Math.round(iconSize * 0.38), iconY, Math.max(2, Math.round(iconSize * 0.24)), iconSize - miniFrontH);

      // 4. CONTADOR NUMÉRICO GRANDE E NÍTIDO NA BASE (Sem Letras, Sem Códigos)
      const numStr = String(box.remaining);
      const scaleFactor = numStr.length >= 3 ? 0.32 : 0.42;
      const fontSize = Math.max(12, Math.min(22, Math.floor(buttonSize * scaleFactor)));

      ctx.font = `900 ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colorDef.textHex || '#0f172a';
      ctx.fillText(numStr, dock.x, by + Math.floor(buttonSize * 0.72));
    }

    ctx.restore();
  });

  ctx.restore();
}

// ============================================================================
// 7. Partículas e Efeito de Celebração de Vitória
// ============================================================================

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
  const confettiCount = 60;
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#fbbf24'];

  for (let i = 0; i < confettiCount; i++) {
    const seed = i * 1337;
    const x = ((seed + time * 0.12) % w);
    const speed = 70 + (seed % 100);
    const y = ((time * 0.001 * speed + seed) % h);
    const size = 6 + (seed % 6);
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
