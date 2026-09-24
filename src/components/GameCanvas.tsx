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

      // 2. Atualizar caixas na esteira rolante (viajam para cima até entrar no túnel)
      const conveyorBoxes = conveyorBoxesRef.current;
      const currentConveyorSpeed = engine.tuning.conveyorSpeed;
      for (let i = conveyorBoxes.length - 1; i >= 0; i--) {
        const cb = conveyorBoxes[i];
        cb.speed = currentConveyorSpeed;
        cb.y -= cb.speed * dt;
        // Se entrou completamente no túnel da saída, remove
        if (cb.y < 34) {
          conveyorBoxes.splice(i, 1);
        }
      }

      // 3. Atualizar caixas que foram depositadas na esteira pelo robô
      while (engine.depositedBoxesQueue.length > 0) {
        const dep = engine.depositedBoxesQueue.shift()!;
        conveyorBoxes.push({
          id: dep.id,
          x: engine.conveyorTip.x,
          y: engine.conveyorTip.y - 4,
          colorId: dep.colorId,
          speed: currentConveyorSpeed,
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
      const leftWallW = Math.min(54, Math.max(34, Math.floor(width * 0.11)));
      const conveyorW = Math.min(54, Math.max(38, Math.floor(width * 0.125)));
      const topWallH = Math.min(48, Math.max(32, Math.floor(height * 0.08)));
      const dockConsoleH = Math.min(76, Math.max(54, Math.floor(height * 0.125)));

      // Redução da esteira pela metade!
      const totalFloorH = height - topWallH - dockConsoleH;
      const conveyorH = Math.round(totalFloorH * 0.5);
      const conveyorTipY = topWallH + conveyorH;
      const conveyorCenterX = Math.round(width - conveyorW / 2 - 2);

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

      const botRadius = Math.max(9.5, Math.min(23, cellSize * 0.60));
      const dropStationX = conveyorCenterX;
      const dropStationY = Math.round(conveyorTipY + botRadius + 4);

      // Posições das Docas no console industrial inferior
      const dockCount = engine.bufferSlots.length || 5;
      const dockSpacing = (width - 16) / dockCount;
      const dockY = height - dockConsoleH / 2 - 2;
      const dockPositions = Array.from({ length: dockCount }, (_, i) => ({
        x: Math.round(8 + dockSpacing * i + dockSpacing / 2),
        y: Math.round(dockY),
      }));

      // Notifica o motor das métricas espaciais
      engine.updateLayoutMetrics(
        dockPositions,
        cellSize,
        offsetX,
        offsetY,
        width,
        height,
        {
          x: conveyorCenterX,
          y: conveyorTipY,
          dropX: dropStationX,
          dropY: dropStationY,
        }
      );

      // Ponto de fuga / centro horizontal da câmera
      const cameraCenterX = width * 0.48;

      // 6. Renderizar Cenário da Fábrica (Piso de Concreto, Parede Superior, Parede Esquerda)
      drawFactoryEnvironment(
        ctx,
        width,
        height,
        topWallH,
        leftWallW,
        conveyorW,
        conveyorH,
        dockConsoleH,
        currentTime,
        offsetX,
        offsetY,
        boardPixelW,
        boardPixelH,
        dropStationY
      );

      // 7. Sombra de Contato Global do Aglomerado de Caixas no Piso
      drawClusterFloorShadow(
        ctx,
        engine.grid,
        offsetX,
        offsetY,
        cellSize,
        gridW,
        gridH,
        cameraCenterX
      );

      // 8. Renderizar Esteira Rolante e Portal de Saída lateral ("SAÍDA >>")
      drawConveyorAndPortal(
        ctx,
        width,
        height,
        conveyorW,
        conveyorH,
        topWallH,
        dockConsoleH,
        currentTime,
        conveyorBoxes,
        palette,
        cameraCenterX
      );

      // 9. Renderização Z-Buffer Ordenada por Profundidade (Painter's Algorithm)
      // Caixas 3D e robôs AGVs ordenados pela coordenada Y para oclusão física perfeita!
      renderDepthSortedEntities(
        ctx,
        engine,
        palette,
        offsetX,
        offsetY,
        cellSize,
        gridW,
        gridH,
        cameraCenterX,
        currentTime
      );

      // 10. Renderizar Partículas de Impacto/Colheita
      drawParticles(ctx, engine);

      // 11. Renderizar Console Industrial das 5 Docas na Base
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

      // 12. Efeito de Celebração de Vitória
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
// 1. Cenário e Ambiente Industrial da Mini-Fábrica (Piso, Paredes, Iluminação)
// ============================================================================

// ============================================================================
// 1. Cenário e Ambiente Industrial da Mini-Fábrica (Piso, Paredes, Iluminação)
// ============================================================================

function drawFactoryEnvironment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  topWallH: number,
  leftWallW: number,
  conveyorW: number,
  conveyorH: number,
  dockConsoleH: number,
  time: number,
  ox: number,
  oy: number,
  bw: number,
  bh: number,
  dropStationY: number
) {
  const floorX = leftWallW;
  const floorY = topWallH;
  const floorH = h - topWallH - dockConsoleH;

  // A. Piso de Concreto Industrial da Fábrica (Piso estendido para toda a fábrica)
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, floorY + floorH);
  floorGrad.addColorStop(0, '#2e3745'); // Sombra projetada da parede superior
  floorGrad.addColorStop(0.3, '#262e3b');
  floorGrad.addColorStop(0.7, '#202733');
  floorGrad.addColorStop(1, '#171c26'); // Sombra perto do console
  ctx.fillStyle = floorGrad;
  ctx.fillRect(floorX, floorY, w - floorX, floorH);

  // B. Juntas de Lajes Modulares de Concreto (Slabs em proporção industrial harmoniosa)
  const floorW = w - leftWallW - conveyorW;
  const slabCols = 4;
  const slabRows = 5;
  const slabW = floorW / slabCols;
  const slabH = floorH / slabRows;

  ctx.save();
  // Ranhura profunda da junta de concreto
  ctx.strokeStyle = 'rgba(8, 12, 18, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let c = 1; c < slabCols; c++) {
    const x = Math.round(floorX + c * slabW);
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, floorY + floorH);
  }
  for (let r = 1; r < slabRows; r++) {
    const y = Math.round(floorY + r * slabH);
    ctx.moveTo(floorX, y);
    ctx.lineTo(floorX + floorW, y);
  }
  ctx.stroke();

  // Filete sutil de luz na quina da laje (micro-relevo)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  for (let c = 1; c < slabCols; c++) {
    const x = Math.round(floorX + c * slabW) + 1;
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, floorY + floorH);
  }
  for (let r = 1; r < slabRows; r++) {
    const y = Math.round(floorY + r * slabH) + 1;
    ctx.moveTo(floorX, y);
    ctx.lineTo(floorX + floorW, y);
  }
  ctx.stroke();

  // C. Iluminação Projetada dos Refletores Superiores (Luzes Difusas Quentes no Piso)
  const spotPositions = [
    { x: floorX + floorW * 0.28, y: floorY + floorH * 0.35, r: 170 },
    { x: floorX + floorW * 0.72, y: floorY + floorH * 0.45, r: 180 },
    { x: floorX + floorW * 0.45, y: floorY + floorH * 0.78, r: 150 },
  ];
  for (const sp of spotPositions) {
    const spot = ctx.createRadialGradient(sp.x, sp.y, 10, sp.x, sp.y, sp.r);
    spot.addColorStop(0, 'rgba(255, 246, 225, 0.065)');
    spot.addColorStop(0.55, 'rgba(255, 246, 225, 0.02)');
    spot.addColorStop(1, 'transparent');
    ctx.fillStyle = spot;
    ctx.fillRect(floorX, floorY, w - floorX, floorH);
  }

  // D. Faixa Guia da Fila de Espera (Vertical abaixo da esteira)
  const queueX = w - conveyorW / 2 - 2;
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.16)'; // Amarelo industrial sutil
  ctx.lineWidth = 1.8;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  // Linha da fila de espera vertical que sobe até a ponta da esteira
  ctx.moveTo(queueX, dropStationY + 14);
  ctx.lineTo(queueX, floorY + floorH - 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // Chevrons apontando para cima (^^) em direção à ponta da esteira
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let s = 1; s <= 2; s++) {
    const py = dropStationY + s * 34;
    ctx.beginPath();
    ctx.moveTo(queueX - 5, py + 4);
    ctx.lineTo(queueX, py - 2);
    ctx.lineTo(queueX + 5, py + 4);
    ctx.lineTo(queueX, py + 1);
    ctx.closePath();
    ctx.fill();
  }

  // E. Setas Industriais Direcionais no Piso (>>>) apontando para a saída lateral direita
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  const arrowX = w - 12;
  const arrowY = dropStationY;
  for (let s = 0; s < 2; s++) {
    const px = arrowX - s * 14;
    ctx.beginPath();
    ctx.moveTo(px - 6, arrowY - 5);
    ctx.lineTo(px + 2, arrowY);
    ctx.lineTo(px - 6, arrowY + 5);
    ctx.lineTo(px - 2, arrowY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // F. Parede Superior (Viga Industrial Bulkhead com Tubulação e Refletores)
  ctx.save();
  const beamGrad = ctx.createLinearGradient(0, 0, 0, topWallH);
  beamGrad.addColorStop(0, '#151b24');
  beamGrad.addColorStop(0.55, '#1e2634');
  beamGrad.addColorStop(0.9, '#121721');
  beamGrad.addColorStop(1, '#0b0f15');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, w, topWallH);

  // Faixa de advertência zebrada amarela/preta no topo
  const stripeH = 4;
  for (let sx = 0; sx < w; sx += 12) {
    ctx.fillStyle = Math.floor(sx / 12) % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(sx, 0, 12, stripeH);
  }

  // Tubulação amarela de segurança com braçadeiras pretas
  const pipeY = topWallH - 16;
  const pipeH = 6;
  const pipeGrad = ctx.createLinearGradient(0, pipeY, 0, pipeY + pipeH);
  pipeGrad.addColorStop(0, '#fef08a');
  pipeGrad.addColorStop(0.4, '#eab308');
  pipeGrad.addColorStop(1, '#a16207');
  ctx.fillStyle = pipeGrad;
  ctx.fillRect(0, pipeY, w, pipeH);

  // Braçadeiras pretas de fixação do cano
  ctx.fillStyle = '#0f172a';
  for (let px = 28; px < w; px += 56) {
    ctx.fillRect(px, pipeY - 1.5, 5, pipeH + 3);
  }

  // Refletores de teto embutidos com cone de iluminação suave
  for (let lx = 64; lx < w - 50; lx += 110) {
    ctx.fillStyle = '#334155';
    ctx.fillRect(lx - 5, topWallH - 8, 10, 6);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lx, topWallH - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Friso de contato da parede superior com o piso
  ctx.strokeStyle = '#070b10';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, topWallH);
  ctx.lineTo(w, topWallH);
  ctx.stroke();
  ctx.restore();

  // G. Parede Lateral Esquerda (Estrutura Industrial Sólida com Placa e Tanques)
  ctx.save();
  const leftWallGrad = ctx.createLinearGradient(0, 0, leftWallW, 0);
  leftWallGrad.addColorStop(0, '#131822');
  leftWallGrad.addColorStop(0.85, '#1c2432');
  leftWallGrad.addColorStop(1, '#0e121a');
  ctx.fillStyle = leftWallGrad;
  ctx.fillRect(0, topWallH, leftWallW, floorH);

  // Faixa zebrada amarela de segurança na junção com o piso
  const edgeStripeW = 4;
  for (let sy = topWallH; sy < topWallH + floorH; sy += 9) {
    ctx.fillStyle = Math.floor(sy / 9) % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(leftWallW - edgeStripeW, sy, edgeStripeW, 9);
  }

  // Cilindros Metálicos / Tanques de Gás Comprimido
  const tankW = Math.max(7, Math.round(leftWallW * 0.32));
  const tankH = 34;
  const tankX = 4;
  const tankY = topWallH + 24;

  // Sombra dos tanques no piso/parede
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(tankX + 1, tankY + tankH - 1, tankW * 2 + 3, 3);

  // Tanque 1 (Aço Escovado)
  const tank1Grad = ctx.createLinearGradient(tankX, 0, tankX + tankW, 0);
  tank1Grad.addColorStop(0, '#334155');
  tank1Grad.addColorStop(0.35, '#94a3b8');
  tank1Grad.addColorStop(0.7, '#cbd5e1');
  tank1Grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = tank1Grad;
  ctx.beginPath();
  ctx.roundRect(tankX, tankY, tankW, tankH, [tankW / 2, tankW / 2, 2, 2]);
  ctx.fill();

  // Tanque 2 (Grafite Escuro)
  const tank2Grad = ctx.createLinearGradient(tankX + tankW + 2, 0, tankX + tankW * 2 + 2, 0);
  tank2Grad.addColorStop(0, '#1e293b');
  tank2Grad.addColorStop(0.4, '#64748b');
  tank2Grad.addColorStop(0.8, '#475569');
  tank2Grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = tank2Grad;
  ctx.beginPath();
  ctx.roundRect(tankX + tankW + 2, tankY + 4, tankW, tankH - 4, [tankW / 2, tankW / 2, 2, 2]);
  ctx.fill();

  // Braçadeiras metálicas pretas com parafusos
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(tankX - 1, tankY + 8, tankW * 2 + 4, 3);
  ctx.fillRect(tankX - 1, tankY + tankH - 10, tankW * 2 + 4, 3);

  // Placa Industrial Metálica com Letreiro: COLOR COLLECT
  const plaqueX = 4;
  const plaqueY = tankY + tankH + 14;
  const plaqueW = leftWallW - edgeStripeW - 6;
  const plaqueH = Math.min(68, Math.max(46, leftWallW * 1.3));

  if (plaqueW >= 20) {
    // Sombra da placa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(plaqueX + 1, plaqueY + 1, plaqueW, plaqueH);

    // Corpo metálico esmaltado bege/cinza claro da placa
    const plqGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX + plaqueW, plaqueY + plaqueH);
    plqGrad.addColorStop(0, '#e2e8f0');
    plqGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = plqGrad;
    ctx.beginPath();
    ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 3);
    ctx.fill();

    // Moldura chanfrada
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4 Parafusos / Rebites nos cantos
    ctx.fillStyle = '#334155';
    ctx.fillRect(plaqueX + 2, plaqueY + 2, 1.6, 1.6);
    ctx.fillRect(plaqueX + plaqueW - 3.6, plaqueY + 2, 1.6, 1.6);
    ctx.fillRect(plaqueX + 2, plaqueY + plaqueH - 3.6, 1.6, 1.6);
    ctx.fillRect(plaqueX + plaqueW - 3.6, plaqueY + plaqueH - 3.6, 1.6, 1.6);

    // Mini-luminária direcionada no topo da placa
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(plaqueX + plaqueW / 2 - 3, plaqueY - 4, 6, 3);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(plaqueX + plaqueW / 2, plaqueY - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    if (plaqueW >= 24) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 6.5px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COLOR', plaqueX + plaqueW / 2, plaqueY + 12);
      ctx.fillText('COLLECT', plaqueX + plaqueW / 2, plaqueY + 20);

      ctx.fillStyle = '#475569';
      ctx.font = '700 3.6px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('SMALL ROBOTS', plaqueX + plaqueW / 2, plaqueY + 31);
      ctx.fillText('BIG LOGISTICS', plaqueX + plaqueW / 2, plaqueY + 37);
    }
  }

  // Corrimão tubular amarelo fixado no chão
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(5, floorY + floorH - 60);
  ctx.lineTo(leftWallW - 6, floorY + floorH - 60);
  ctx.moveTo(leftWallW - 6, floorY + floorH - 60);
  ctx.lineTo(leftWallW - 6, floorY + floorH - 10);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(leftWallW - 8, floorY + floorH - 11, 4, 3);
  ctx.restore();
}

// ============================================================================
// 2. Sombra de Contato Global do Aglomerado de Caixas (Ambient Floor Shadow)
// ============================================================================

function drawClusterFloorShadow(
  ctx: CanvasRenderingContext2D,
  grid: BoardGrid,
  ox: number,
  oy: number,
  cs: number,
  gw: number,
  gh: number,
  cameraCenterX: number
) {
  ctx.save();

  // 1. Projeção de sombras de contato individuais e direcionais no piso
  for (let gy = 0; gy < gh; gy++) {
    const row = grid[gy];
    if (!row) continue;
    for (let gx = 0; gx < gw; gx++) {
      if (!row[gx]) continue;

      const cellX = ox + gx * cs;
      const cellY = oy + gy * cs;

      const hasSouth = gy + 1 < gh && grid[gy + 1] && grid[gy + 1][gx] !== null;
      const hasEast = gx + 1 < gw && grid[gy][gx + 1] !== null;

      // Se a face Sul está exposta ao piso de concreto:
      if (!hasSouth) {
        const topH = Math.round(cs * 0.74);
        const frontH = Math.round(cs * 0.32);
        const groundY = cellY + topH + frontH;

        // A. Sombra de contato escura imediata
        ctx.fillStyle = 'rgba(8, 12, 18, 0.65)';
        ctx.beginPath();
        ctx.ellipse(cellX + cs / 2, groundY, cs * 0.50, Math.max(2.5, cs * 0.12), 0, 0, Math.PI * 2);
        ctx.fill();

        // B. Sombra direcional difusa suave projetada para o sul (luz vem do topo)
        const dropGrad = ctx.createLinearGradient(0, groundY, 0, groundY + cs * 0.38);
        dropGrad.addColorStop(0, 'rgba(8, 12, 18, 0.40)');
        dropGrad.addColorStop(1, 'rgba(8, 12, 18, 0)');
        ctx.fillStyle = dropGrad;
        ctx.fillRect(cellX - cs * 0.05, groundY, cs * 1.1, cs * 0.38);
      }

      // Se a face Leste está exposta ao piso (luz vem do topo-esquerdo):
      if (!hasEast) {
        const shadowX = cellX + cs;
        const topH = Math.round(cs * 0.74);
        const sideGrad = ctx.createLinearGradient(shadowX, 0, shadowX + cs * 0.20, 0);
        sideGrad.addColorStop(0, 'rgba(8, 12, 18, 0.28)');
        sideGrad.addColorStop(1, 'rgba(8, 12, 18, 0)');
        ctx.fillStyle = sideGrad;
        ctx.fillRect(shadowX, cellY + 2, cs * 0.20, topH);
      }
    }
  }

  ctx.restore();
}

// ============================================================================
// 3. Esteira Rolante e Portal Físico de Saída Recessado ("SAÍDA >>")
// ============================================================================

function drawConveyorAndPortal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  conveyorW: number,
  conveyorH: number,
  topWallH: number,
  dockConsoleH: number,
  time: number,
  conveyorBoxes: ConveyorBox[],
  palette: Record<string, ColorDef>,
  cameraCenterX: number
) {
  const conveyorX = w - conveyorW;
  const conveyorY = topWallH;

  ctx.save();

  // A. Canal Metálico Estrutural da Esteira
  const channelGrad = ctx.createLinearGradient(conveyorX, 0, w, 0);
  channelGrad.addColorStop(0, '#0d121a');
  channelGrad.addColorStop(0.2, '#161e2a');
  channelGrad.addColorStop(0.8, '#131822');
  channelGrad.addColorStop(1, '#090d14');
  ctx.fillStyle = channelGrad;
  ctx.fillRect(conveyorX, conveyorY, conveyorW, conveyorH);

  // B. Guardrails Industriais Amarelos com Faixas Zebradas em AMBOS os Lados
  const railW = 4.5;
  for (let sy = conveyorY; sy < conveyorY + conveyorH; sy += 10) {
    const isStripe = Math.floor(sy / 10) % 2 === 0;
    // Guardrail esquerdo
    ctx.fillStyle = isStripe ? '#eab308' : '#1e293b';
    ctx.fillRect(conveyorX, sy, railW, 10);
    // Guardrail direito
    ctx.fillStyle = isStripe ? '#eab308' : '#1e293b';
    ctx.fillRect(w - railW, sy, railW, 10);
  }

  // Filete metálico superior nos guardrails
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(conveyorX, conveyorY, railW, 1.5);
  ctx.fillRect(w - railW, conveyorY, railW, 1.5);

  // C. Roletes Cilíndricos da Esteira Mecanizada
  const rollerSpacing = 12;
  const scrollOffset = (time * 0.06) % rollerSpacing;
  const rollerX = conveyorX + railW + 1.5;
  const rollerW = conveyorW - railW * 2 - 3;

  for (let ry = conveyorY + 36 - scrollOffset; ry < conveyorY + conveyorH; ry += rollerSpacing) {
    const rollerGrad = ctx.createLinearGradient(0, ry - 2, 0, ry + 3.5);
    rollerGrad.addColorStop(0, '#334155');
    rollerGrad.addColorStop(0.35, '#94a3b8');
    rollerGrad.addColorStop(0.7, '#475569');
    rollerGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rollerGrad;
    ctx.beginPath();
    ctx.roundRect(rollerX, ry - 2, rollerW, 5, 1.5);
    ctx.fill();
  }

  // Terminal mecânico chanfrado na ponta da esteira (placa de entrada e mancais)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(conveyorX - 1, conveyorY + conveyorH - 4, conveyorW + 2, 6);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(conveyorX, conveyorY + conveyorH - 2, conveyorW, 2.5);

  // D. Caixas Transportadas na Esteira (3D com acabamento de brinquedo)
  for (const box of conveyorBoxes) {
    if (box.y > conveyorY + conveyorH + 8) continue;
    const colorDef = getColorDef(palette, box.colorId);
    const boxSize = Math.min(26, Math.max(18, Math.round(rollerW * 0.82)));
    const bx = Math.round(rollerX + (rollerW - boxSize) / 2);
    const by = Math.round(box.y);

    // Sombra de contato nos roletes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(bx + boxSize / 2, by + boxSize * 0.75, boxSize * 0.46, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const topH = Math.round(boxSize * 0.72);
    const frontH = Math.round(boxSize * 0.30);
    const radius = 2.5;

    // Face Frontal da caixa na esteira
    const frontGrad = ctx.createLinearGradient(bx, by + topH, bx, by + topH + frontH);
    frontGrad.addColorStop(0, adjustBrightness(colorDef.hex, 0.78));
    frontGrad.addColorStop(1, adjustBrightness(colorDef.hex, 0.60));
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by + topH, boxSize, frontH, [0, 0, radius, radius]);
    ctx.fill();

    // Seam central da caixa
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx + boxSize / 2, by + topH);
    ctx.lineTo(bx + boxSize / 2, by + topH + frontH);
    ctx.stroke();

    // Face Superior da caixa
    ctx.fillStyle = colorDef.hex;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxSize, topH, [radius, radius, 0, 0]);
    ctx.fill();

    const tGrad = ctx.createLinearGradient(bx, by, bx + boxSize, by + topH);
    tGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    tGrad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxSize, topH, [radius, radius, 0, 0]);
    ctx.fill();

    // Fita adesiva translúcida
    const isWhite = colorDef.hex.toLowerCase() === '#fff' || colorDef.hex.toLowerCase() === '#ffffff' || colorDef.hex.toLowerCase() === '#f8fafc';
    const tapeColor = isWhite ? 'rgba(203, 213, 225, 0.65)' : 'rgba(217, 119, 6, 0.55)';
    const tapeW = Math.max(3, Math.round(boxSize * 0.22));
    ctx.fillStyle = tapeColor;
    ctx.fillRect(Math.round(bx + (boxSize - tapeW) / 2), by, tapeW, topH + Math.min(frontH * 0.6, 4));
  }

  // E. PORTAL FÍSICO RECESSADO DE SAÍDA (Túnel Arqueado com Arco Neon Ciano)
  // Desenhado após as caixas para que elas deslizem para DENTRO da escuridão do portal!
  const portalH = 54;
  const portalY = topWallH - 2;
  const portalX = rollerX - 3.5;
  const portalWidth = rollerW + 7;
  const archRadius = Math.round(portalWidth / 2);

  // 1. Cavidade profunda escura do túnel (com gradiente de profundidade)
  const tunnelGrad = ctx.createLinearGradient(0, portalY, 0, portalY + portalH);
  tunnelGrad.addColorStop(0, '#000204');
  tunnelGrad.addColorStop(0.55, '#04070e');
  tunnelGrad.addColorStop(1, '#090e17');
  ctx.fillStyle = tunnelGrad;
  ctx.beginPath();
  ctx.roundRect(portalX, portalY, portalWidth, portalH, [archRadius, archRadius, 0, 0]);
  ctx.fill();

  // 2. Moldura metálica chanfrada do portal embutida na parede
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(portalX, portalY, portalWidth, portalH, [archRadius, archRadius, 0, 0]);
  ctx.stroke();

  // 3. Arco neon ciano luminoso contornando o arco do portal
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.4;
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(portalX + 1.2, portalY + 1.2, portalWidth - 2.4, portalH - 1.2, [archRadius - 1, archRadius - 1, 0, 0]);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Letreiro neon na viga bulkhead superior: "SAÍDA" e chevrons ">>"
  const pulse = (Math.sin(time * 0.006) + 1) / 2;
  const signCenterX = conveyorX + conveyorW / 2;

  // Texto SAÍDA
  ctx.fillStyle = '#bae6fd';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 4 + pulse * 4;
  ctx.font = '900 8px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAÍDA', signCenterX, portalY - 14);

  // Chevrons >> brilhantes
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 6 + pulse * 6;
  ctx.font = '900 12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('>>', signCenterX, portalY - 5);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ============================================================================
// 4. Renderização Z-Buffer Ordenada por Profundidade (Painter's Algorithm)
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
  cameraCenterX: number,
  time: number
) {
  const entities: RenderableEntity[] = [];

  // A. Coleta todas as caixas presentes no grid (ordenadas pela base no chão)
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

  // D. Renderiza cada entidade na ordem de profundidade correta
  for (const ent of entities) {
    if (ent.type === 'BOX') {
      const isExposed = EdgeDetector.isCellExposed(engine.grid, ent.gx, ent.gy);
      const colorDef = getColorDef(palette, ent.colorId);
      draw3DPhysicalBox(
        ctx,
        ent.gx,
        ent.gy,
        ox,
        oy,
        cs,
        gw,
        gh,
        colorDef,
        isExposed,
        engine.grid,
        cameraCenterX,
        time
      );
    } else {
      drawAGVRobot(ctx, ent.bot, palette, cs, cameraCenterX, time);
    }
  }
}

// ============================================================================
// 5. Caixas Físicas 3D de Brinquedo (Volumetric 2.5D Toy Box Pipeline)
// ============================================================================

function draw3DPhysicalBox(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  ox: number,
  oy: number,
  cs: number,
  gw: number,
  gh: number,
  colorDef: ColorDef,
  isExposed: boolean,
  grid: BoardGrid,
  cameraCenterX: number,
  time: number
) {
  const cellX = ox + gx * cs;
  const cellY = oy + gy * cs;

  // Verificação de vizinhos
  const hasSouth = gy + 1 < gh && grid[gy + 1] && grid[gy + 1][gx] !== null;
  const hasEast = gx + 1 < gw && grid[gy][gx + 1] !== null;
  const hasWest = gx - 1 >= 0 && grid[gy][gx - 1] !== null;

  // Geometria estrutural 2.5D uniforme e contínua
  const margin = Math.max(0.5, Math.round(cs * 0.025));
  const boxW = cs - margin * 2;
  const topH = Math.round(cs * 0.74);
  const frontH = Math.round(cs * 0.32);
  const radius = Math.max(2.5, Math.round(cs * 0.09));

  const topX = Math.round(cellX + margin);
  const topY = Math.round(cellY + margin);

  ctx.save();

  // A. FACE FRONTAL (Vertical voltada diretamente para o jogador)
  const frontY = topY + topH - 1;

  if (!hasSouth) {
    // Face frontal exposta ao chão: desce até a base do bloco
    const frontGrad = ctx.createLinearGradient(topX, frontY, topX, frontY + frontH);
    frontGrad.addColorStop(0, adjustBrightness(colorDef.hex, 0.80));
    frontGrad.addColorStop(0.55, adjustBrightness(colorDef.hex, 0.68));
    frontGrad.addColorStop(1, adjustBrightness(colorDef.hex, 0.54));
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.roundRect(topX, frontY, boxW, frontH, [0, 0, radius, radius]);
    ctx.fill();

    // Fenda vertical central da dobra de papelão
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topX + boxW / 2, frontY);
    ctx.lineTo(topX + boxW / 2, frontY + frontH);
    ctx.stroke();

    // Sombra de contato escurecida rente à base com o piso
    ctx.fillStyle = 'rgba(8, 12, 18, 0.45)';
    ctx.fillRect(topX, frontY + frontH - 1.5, boxW, 1.5);
  } else {
    // Face frontal interna: preenche o vão até o topo do bloco ao sul, garantindo escultura contínua!
    const nextTopY = Math.round(cellY + cs + margin);
    const innerH = Math.max(2, nextTopY - frontY);
    const innerGrad = ctx.createLinearGradient(topX, frontY, topX, frontY + innerH);
    innerGrad.addColorStop(0, adjustBrightness(colorDef.hex, 0.78));
    innerGrad.addColorStop(1, adjustBrightness(colorDef.hex, 0.62));
    ctx.fillStyle = innerGrad;
    ctx.fillRect(topX, frontY, boxW, innerH);

    // Fenda vertical central da dobra de papelão
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(topX + boxW / 2, frontY);
    ctx.lineTo(topX + boxW / 2, frontY + innerH);
    ctx.stroke();

    // Vinco de sombra na junção com o bloco abaixo
    ctx.fillStyle = 'rgba(8, 12, 18, 0.35)';
    ctx.fillRect(topX, frontY + innerH - 1.2, boxW, 1.2);
  }

  // B. BORDAS LATERAIS (Definição de volume 3D e junção lateral perfeita)
  if (!hasEast) {
    // Borda leste externa na penumbra
    ctx.fillStyle = adjustBrightness(colorDef.hex, 0.62);
    ctx.beginPath();
    ctx.roundRect(topX + boxW - 1.6, topY + radius, 1.6, topH - radius, 0.8);
    ctx.fill();
  } else {
    // Vinco limpo entre blocos adjacentes a leste
    ctx.fillStyle = 'rgba(8, 12, 18, 0.35)';
    ctx.fillRect(topX + boxW - 0.5, topY, 1.2, topH);
  }
  if (!hasWest) {
    // Borda oeste externa capturando luz suave
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(topX, topY + radius, 1.2, topH - radius, 0.8);
    ctx.fill();
  }

  // C. FACE SUPERIOR (Iluminada e vibrante com acabamento de brinquedo)
  ctx.fillStyle = colorDef.hex;
  ctx.beginPath();
  ctx.roundRect(topX, topY, boxW, topH, [radius, radius, hasSouth ? 0 : 1, hasSouth ? 0 : 1]);
  ctx.fill();

  // Gradiente suave de iluminação direcional vinda do topo-esquerdo
  const topGrad = ctx.createLinearGradient(topX, topY, topX + boxW, topY + topH);
  topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
  topGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.roundRect(topX, topY, boxW, topH, [radius, radius, hasSouth ? 0 : 1, hasSouth ? 0 : 1]);
  ctx.fill();

  // Chanfro sutil no contorno superior
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(topX + 0.4, topY + 0.4, boxW - 0.8, topH - 0.8, [radius, radius, 0, 0]);
  ctx.stroke();

  // D. Fita Adesiva de Vedação na Face Superior (Packing Tape)
  const isWhite = colorDef.hex.toLowerCase() === '#fff' || colorDef.hex.toLowerCase() === '#ffffff' || colorDef.hex.toLowerCase() === '#f8fafc';
  const tapeColor = isWhite ? 'rgba(203, 213, 225, 0.65)' : 'rgba(217, 119, 6, 0.52)';
  const tapeW = Math.max(3, Math.round(boxW * 0.22));
  const tapeX = Math.round(topX + (boxW - tapeW) / 2);

  // Corpo da fita
  ctx.fillStyle = tapeColor;
  ctx.fillRect(tapeX, topY, tapeW, topH);

  // Filete de reflexo especular vítreo na fita adesiva
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fillRect(tapeX + Math.round(tapeW * 0.35), topY, Math.max(1, tapeW * 0.25), topH);

  // A fita dobra e desce sobre a face frontal
  const foldH = !hasSouth ? Math.min(frontH * 0.65, 5) : Math.min((cs - topH) * 0.65, 4);
  ctx.fillStyle = tapeColor;
  ctx.fillRect(tapeX, frontY, tapeW, foldH);

  // E. Realce Físico de Bloco Exposto (Pulsando suavemente para indicar jogabilidade)
  if (isExposed) {
    const pulse = (Math.sin(time * 0.005) + 1) / 2;
    // Borda superior suave iluminada
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + pulse * 0.40})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(topX + 0.6, topY + 0.6, boxW - 1.2, topH - 1.2, [radius, radius, 0, 0]);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================================================================
// 6. Caixa Transportada pelos Garfos do Robô (3D Consistent Cargo)
// ============================================================================

function draw2DBoxOnForks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colorDef: ColorDef,
  cameraCenterX: number
) {
  const topH = Math.round(size * 0.72);
  const frontH = Math.round(size * 0.30);
  const radius = Math.max(1.8, Math.round(size * 0.10));

  const x0 = Math.round(cx - size / 2);
  const y0 = Math.round(cy - size / 2);

  ctx.save();

  // Sombra de oclusão da caixinha nos garfos/chão
  ctx.fillStyle = 'rgba(8, 12, 18, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, y0 + topH + frontH, size * 0.48, Math.max(2.5, size * 0.14), 0, 0, Math.PI * 2);
  ctx.fill();

  // Face Frontal
  const frontY = y0 + topH - 1;
  const frontGrad = ctx.createLinearGradient(x0, frontY, x0, frontY + frontH);
  frontGrad.addColorStop(0, adjustBrightness(colorDef.hex, 0.80));
  frontGrad.addColorStop(1, adjustBrightness(colorDef.hex, 0.58));
  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.roundRect(x0, frontY, size, frontH, [0, 0, radius, radius]);
  ctx.fill();

  // Fenda de papelão
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, frontY);
  ctx.lineTo(cx, frontY + frontH);
  ctx.stroke();

  // Face Superior
  ctx.fillStyle = colorDef.hex;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, topH, [radius, radius, 0, 0]);
  ctx.fill();

  // Brilho superior
  const grad = ctx.createLinearGradient(x0, y0, x0 + size, y0 + topH);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x0, y0, size, topH, [radius, radius, 0, 0]);
  ctx.fill();

  // Fita adesiva
  const isWhite = colorDef.hex.toLowerCase() === '#fff' || colorDef.hex.toLowerCase() === '#ffffff' || colorDef.hex.toLowerCase() === '#f8fafc';
  const tapeColor = isWhite ? 'rgba(203, 213, 225, 0.65)' : 'rgba(217, 119, 6, 0.58)';
  const tapeW = Math.max(2.5, Math.round(size * 0.22));
  const tapeX = Math.round(cx - tapeW / 2);
  ctx.fillStyle = tapeColor;
  ctx.fillRect(tapeX, y0, tapeW, topH + Math.min(frontH * 0.6, 4));

  ctx.restore();
}

// ============================================================================
// 7. Robôs Organizadores (Mini-AGVs Robustos, Cabine Branca, Cúpula Âmbar)
// ============================================================================

function drawAGVRobot(
  ctx: CanvasRenderingContext2D,
  bot: MiniBot,
  palette: Record<string, ColorDef>,
  cellSize: number,
  cameraCenterX: number,
  time: number
) {
  // Escala visual aumentada (~30% mais encorpado para presença de mini-empilhadeira industrial)
  const botRadius = Math.max(9.5, Math.min(23, cellSize * 0.60));
  const targetColorDef = getColorDef(palette, bot.colorId);

  // Normaliza o ângulo ortogonal no intervalo [-PI, PI]
  let a = bot.angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;

  const isMovingDown = Math.abs(a - Math.PI / 2) < 0.4;
  const isMovingUp = Math.abs(a + Math.PI / 2) < 0.4;
  const isMovingLeft = Math.abs(Math.abs(a) - Math.PI) < 0.4;
  const isMovingRight = !isMovingDown && !isMovingUp && !isMovingLeft;

  // Efeito de suspensão na colheita e no descarregamento
  const bounce = (bot.status === 'HARVESTING' || bot.status === 'DEPOSITING') ? Math.sin(bot.actionTimer * 28) * 2.2 : 0;
  const bx = bot.x;
  const by = bot.y + bounce;

  const cargoDef = bot.cargoColor ? getColorDef(palette, bot.cargoColor) : null;
  const cargoSize = Math.max(13, Math.round(botRadius * 1.30));

  ctx.save();

  // A. Sombra de Contato em Dupla Camada (Apoiada firmemente no Piso de Concreto)
  ctx.fillStyle = 'rgba(8, 12, 18, 0.26)';
  ctx.beginPath();
  ctx.ellipse(bx + 1, by + botRadius * 0.50, botRadius * 1.45, botRadius * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(8, 12, 18, 0.58)';
  ctx.beginPath();
  ctx.ellipse(bx, by + botRadius * 0.44, botRadius * 1.15, botRadius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // B. Se estiver indo para CIMA com carga: a carga fica na frente (acima), desenha antes
  if (cargoDef && isMovingUp) {
    draw2DBoxOnForks(ctx, bx, by - botRadius * 0.88, cargoSize, cargoDef, cameraCenterX);
  }

  // Dimensões do chassi 2.5D (formato robusto e equilibrado em todas as direções)
  const bodyW = botRadius * 1.38;
  const bodyH = botRadius * 1.38;
  const bodyX = bx - bodyW / 2;
  const bodyY = by - bodyH / 2;
  const bodyRadius = Math.max(3.5, botRadius * 0.32);

  // C. 4 Rodas Emborrachadas Industriais com Calotas Metálicas
  const tireColor = '#111827';
  const rimColor = '#94a3b8';
  const isVertical = isMovingDown || isMovingUp;

  if (!isVertical) {
    // Marcha horizontal (Direita ou Esquerda)
    const wheelW = botRadius * 0.56;
    const wheelH = Math.max(3.2, botRadius * 0.28);
    const xRear = bx - bodyW / 2 + 1;
    const xFront = bx + bodyW / 2 - wheelW - 1;
    const yTop = by - bodyH / 2 - wheelH * 0.35;
    const yBottom = by + bodyH / 2 - wheelH * 0.65;

    ctx.fillStyle = tireColor;
    ctx.beginPath();
    ctx.roundRect(xRear, yTop, wheelW, wheelH, 1.8);
    ctx.roundRect(xFront, yTop, wheelW, wheelH, 1.8);
    ctx.roundRect(xRear, yBottom, wheelW, wheelH, 1.8);
    ctx.roundRect(xFront, yBottom, wheelW, wheelH, 1.8);
    ctx.fill();

    ctx.fillStyle = rimColor;
    ctx.fillRect(xRear + wheelW * 0.28, yTop + 0.8, wheelW * 0.44, wheelH - 1.6);
    ctx.fillRect(xFront + wheelW * 0.28, yTop + 0.8, wheelW * 0.44, wheelH - 1.6);
    ctx.fillRect(xRear + wheelW * 0.28, yBottom + 0.8, wheelW * 0.44, wheelH - 1.6);
    ctx.fillRect(xFront + wheelW * 0.28, yBottom + 0.8, wheelW * 0.44, wheelH - 1.6);
  } else {
    // Marcha vertical (Baixo ou Cima)
    const wheelW = Math.max(3.2, botRadius * 0.28);
    const wheelH = botRadius * 0.56;
    const xLeft = bx - bodyW / 2 - wheelW * 0.35;
    const xRight = bx + bodyW / 2 - wheelW * 0.65;
    const yRear = by - bodyH / 2 + 1;
    const yFront = by + bodyH / 2 - wheelH - 1;

    ctx.fillStyle = tireColor;
    ctx.beginPath();
    ctx.roundRect(xLeft, yRear, wheelW, wheelH, 1.8);
    ctx.roundRect(xRight, yRear, wheelW, wheelH, 1.8);
    ctx.roundRect(xLeft, yFront, wheelW, wheelH, 1.8);
    ctx.roundRect(xRight, yFront, wheelW, wheelH, 1.8);
    ctx.fill();

    ctx.fillStyle = rimColor;
    ctx.fillRect(xLeft + 0.8, yRear + wheelH * 0.28, wheelW - 1.6, wheelH * 0.44);
    ctx.fillRect(xRight + 0.8, yRear + wheelH * 0.28, wheelW - 1.6, wheelH * 0.44);
    ctx.fillRect(xLeft + 0.8, yFront + wheelH * 0.28, wheelW - 1.6, wheelH * 0.44);
    ctx.fillRect(xRight + 0.8, yFront + wheelH * 0.28, wheelW - 1.6, wheelH * 0.44);
  }

  // D. Garfos Mecânicos Frontais de Elevação
  const forkThick = Math.max(2.2, botRadius * 0.16);
  const forkLen = botRadius * 0.55;
  ctx.fillStyle = '#475569';

  if (isMovingRight) {
    const fx = bx + bodyW / 2 - 1;
    ctx.fillRect(fx, by - botRadius * 0.42, forkLen, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.42 - forkThick, forkLen, forkThick);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(fx + forkLen - 2, by - botRadius * 0.42, 2, forkThick);
    ctx.fillRect(fx + forkLen - 2, by + botRadius * 0.42 - forkThick, 2, forkThick);
  } else if (isMovingLeft) {
    const fx = bx - bodyW / 2 - forkLen + 1;
    ctx.fillRect(fx, by - botRadius * 0.42, forkLen, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.42 - forkThick, forkLen, forkThick);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(fx, by - botRadius * 0.42, 2, forkThick);
    ctx.fillRect(fx, by + botRadius * 0.42 - forkThick, 2, forkThick);
  } else if (isMovingDown) {
    const fy = by + bodyH / 2 - 1;
    ctx.fillRect(bx - botRadius * 0.42, fy, forkThick, forkLen);
    ctx.fillRect(bx + botRadius * 0.42 - forkThick, fy, forkThick, forkLen);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bx - botRadius * 0.42, fy + forkLen - 2, forkThick, 2);
    ctx.fillRect(bx + botRadius * 0.42 - forkThick, fy + forkLen - 2, forkThick, 2);
  } else {
    // Up
    const fy = by - bodyH / 2 - forkLen + 1;
    ctx.fillRect(bx - botRadius * 0.42, fy, forkThick, forkLen);
    ctx.fillRect(bx + botRadius * 0.42 - forkThick, fy, forkThick, forkLen);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(bx - botRadius * 0.42, fy, forkThick, 2);
    ctx.fillRect(bx + botRadius * 0.42 - forkThick, fy, forkThick, 2);
  }

  // E. Chassi Metálico Esmaltado Branco/Grafite (Iluminação Consistente)
  // Saia mecânica inferior escura
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, bodyRadius);
  ctx.fill();

  // Carroceria superior branca esmaltada elevada
  const cabMargin = Math.max(1.2, botRadius * 0.10);
  const cabW = bodyW - cabMargin * 2;
  const cabH = bodyH - cabMargin * 2;
  const cabX = bodyX + cabMargin;
  const cabY = bodyY + cabMargin - 1.5;

  const cabGrad = ctx.createLinearGradient(0, cabY, 0, cabY + cabH);
  cabGrad.addColorStop(0, '#ffffff');
  cabGrad.addColorStop(0.55, '#f1f5f9');
  cabGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = cabGrad;
  ctx.beginPath();
  ctx.roundRect(cabX, cabY, cabW, cabH, Math.max(2, bodyRadius - 1));
  ctx.fill();

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // F. Visor Frontal Glossy & Olhos LED Expressivos
  const eyeColor = targetColorDef ? targetColorDef.hex : '#38bdf8';
  const eyeR = Math.max(1.5, botRadius * 0.16);

  if (isMovingRight) {
    const vw = Math.max(3.5, botRadius * 0.38);
    const vh = botRadius * 0.82;
    const vx = bx + bodyW / 2 - vw - cabMargin;
    const vy = by - vh / 2;

    ctx.fillStyle = '#080c14';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1.5, botRadius * 0.16));
    ctx.fill();

    // Olhos digitais LED voltados para a direita
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(vx + vw * 0.55, by - botRadius * 0.22, eyeR, 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.55, by + botRadius * 0.22, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(vx + vw * 0.55, by - botRadius * 0.22, eyeR * 0.45, 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.55, by + botRadius * 0.22, eyeR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (isMovingLeft) {
    const vw = Math.max(3.5, botRadius * 0.38);
    const vh = botRadius * 0.82;
    const vx = bx - bodyW / 2 + cabMargin;
    const vy = by - vh / 2;

    ctx.fillStyle = '#080c14';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1.5, botRadius * 0.16));
    ctx.fill();

    // Olhos digitais LED voltados para a esquerda
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(vx + vw * 0.45, by - botRadius * 0.22, eyeR, 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.45, by + botRadius * 0.22, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(vx + vw * 0.45, by - botRadius * 0.22, eyeR * 0.45, 0, Math.PI * 2);
    ctx.arc(vx + vw * 0.45, by + botRadius * 0.22, eyeR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (isMovingDown) {
    // Visor frontal voltado diretamente para a câmera
    const vw = botRadius * 0.82;
    const vh = Math.max(3.5, botRadius * 0.38);
    const vx = bx - vw / 2;
    const vy = by + bodyH / 2 - vh - cabMargin;

    ctx.fillStyle = '#080c14';
    ctx.beginPath();
    ctx.roundRect(vx, vy, vw, vh, Math.max(1.5, botRadius * 0.16));
    ctx.fill();

    // Olhos digitais LED voltados para frente
    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(bx - botRadius * 0.22, vy + vh * 0.52, eyeR, 0, Math.PI * 2);
    ctx.arc(bx + botRadius * 0.22, vy + vh * 0.52, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - botRadius * 0.22, vy + vh * 0.52, eyeR * 0.45, 0, Math.PI * 2);
    ctx.arc(bx + botRadius * 0.22, vy + vh * 0.52, eyeR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Traseira do robô (lanternas de sinalização)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx - botRadius * 0.32, by + bodyH / 2 - 3, botRadius * 0.2, 2);
    ctx.fillRect(bx + botRadius * 0.12, by + bodyH / 2 - 3, botRadius * 0.2, 2);
  }

  // G. Cúpula / Sinalizador Superior Iluminado (Cor dinâmica da caixa que o robô está buscando)
  const domeSize = Math.max(5.5, Math.round(botRadius * 0.48));
  const domeX = Math.round(bx - domeSize / 2);
  const domeY = Math.round(by - domeSize / 2 - (isMovingDown ? 2.5 : 1));
  const pulse = (Math.sin(time * 0.0075) + 1) / 2;
  const beaconColorHex = targetColorDef?.hex || '#f59e0b';

  // Brilho suave contido na cor do alvo que o robô está buscando/transportando
  const beaconGlow = ctx.createRadialGradient(bx, domeY + domeSize / 2, 1, bx, domeY + domeSize / 2, domeSize * 1.4);
  beaconGlow.addColorStop(0, hexToRgba(beaconColorHex, 0.85));
  beaconGlow.addColorStop(0.5, hexToRgba(beaconColorHex, 0.35 + pulse * 0.30));
  beaconGlow.addColorStop(1, hexToRgba(beaconColorHex, 0));
  ctx.fillStyle = beaconGlow;
  ctx.beginPath();
  ctx.arc(bx, domeY + domeSize / 2, domeSize * 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Moldura metálica da almofada do teto (mantém alto contraste mesmo para cores claras/brancas)
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(domeX - 0.8, domeY - 0.8, domeSize + 1.6, domeSize + 1.6, 2.5);
  ctx.fill();

  // Almofada iluminada na cor que o robô está buscando
  ctx.fillStyle = beaconColorHex;
  ctx.beginPath();
  ctx.roundRect(domeX, domeY, domeSize, domeSize, 2);
  ctx.fill();

  // Ponto central de reflexo especular vítreo superior
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(domeX + 1, domeY + 1, domeSize * 0.35, domeSize * 0.35);

  // H. Carga nos Garfos Frontais (quando indo para Direita, Esquerda ou Baixo)
  if (cargoDef && !isMovingUp) {
    if (isMovingRight) {
      draw2DBoxOnForks(ctx, bx + botRadius * 0.90, by, cargoSize, cargoDef, cameraCenterX);
    } else if (isMovingLeft) {
      draw2DBoxOnForks(ctx, bx - botRadius * 0.90, by, cargoSize, cargoDef, cameraCenterX);
    } else if (isMovingDown) {
      draw2DBoxOnForks(ctx, bx, by + botRadius * 0.88, cargoSize, cargoDef, cameraCenterX);
    }
  }

  ctx.restore();
}

// ============================================================================
// 8. Console Industrial das 5 Docas na Base (Push-Buttons Táteis 3D)
// ============================================================================

function draw3DIsoMiniBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colorDef: ColorDef
) {
  const halfW = size * 0.52;
  const halfH = size * 0.28;
  const extrude = size * 0.44;

  ctx.save();

  // Sombra suave sob a mini caixa
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + extrude + halfH * 0.5, halfW * 1.1, halfH * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1. Face Esquerda (Sombreada intermediária)
  ctx.fillStyle = adjustBrightness(colorDef.hex, 0.72);
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx, cy + halfH + extrude);
  ctx.lineTo(cx - halfW, cy + extrude);
  ctx.closePath();
  ctx.fill();

  // 2. Face Direita (Mais escura / sombra)
  ctx.fillStyle = adjustBrightness(colorDef.hex, 0.58);
  ctx.beginPath();
  ctx.moveTo(cx, cy + halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx + halfW, cy + extrude);
  ctx.lineTo(cx, cy + halfH + extrude);
  ctx.closePath();
  ctx.fill();

  // 3. Face Superior (Iluminada e vibrante)
  ctx.fillStyle = adjustBrightness(colorDef.hex, 1.08);
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  ctx.fill();

  // Filete de chanfro superior
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // 4. Fita adesiva isométrica no topo
  const isWhite = colorDef.hex.toLowerCase() === '#fff' || colorDef.hex.toLowerCase() === '#ffffff' || colorDef.hex.toLowerCase() === '#f8fafc';
  ctx.fillStyle = isWhite ? 'rgba(203, 213, 225, 0.75)' : 'rgba(217, 119, 6, 0.65)';
  const tw = halfW * 0.30;
  ctx.beginPath();
  ctx.moveTo(cx - tw * 0.5, cy - halfH * 0.5);
  ctx.lineTo(cx + tw * 0.5, cy - halfH * 0.5);
  ctx.lineTo(cx + tw * 0.5, cy + halfH * 0.5 + extrude * 0.3);
  ctx.lineTo(cx - tw * 0.5, cy + halfH * 0.5 + extrude * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

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
  chassisGrad.addColorStop(0, '#151c27');
  chassisGrad.addColorStop(0.35, '#1e2736');
  chassisGrad.addColorStop(1, '#0c1118');
  ctx.fillStyle = chassisGrad;
  ctx.fillRect(0, consoleY, w, dockConsoleH);

  // Faixa zebrada amarela de advertência no topo do console
  const stripeH = 3.5;
  for (let sx = 0; sx < w; sx += 12) {
    ctx.fillStyle = Math.floor(sx / 12) % 2 === 0 ? '#eab308' : '#1e293b';
    ctx.fillRect(sx, consoleY, 12, stripeH);
  }

  // Friso chanfrado metálico em relevo
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, consoleY + stripeH);
  ctx.lineTo(w, consoleY + stripeH);
  ctx.stroke();

  // Parafusos industriais aparentes nas extremidades do console
  ctx.fillStyle = '#64748b';
  ctx.fillRect(6, consoleY + stripeH + 5, 3, 3);
  ctx.fillRect(w - 9, consoleY + stripeH + 5, 3, 3);

  // B. As Baias com Botões Táteis 3D (Estilo Idêntico à Referência)
  const spacing = docks.length > 1 ? docks[1].x - docks[0].x : 54;
  const buttonSize = Math.min(52, Math.max(24, Math.floor(spacing * 0.80)));

  docks.forEach((dock, idx) => {
    const slot = engine.bufferSlots[idx];
    const isOccupied = slot?.box !== null;
    const box = slot?.box;
    const colorDef = isOccupied && box ? getColorDef(palette, box.colorId) : null;

    const bx = Math.round(dock.x - buttonSize / 2);
    const by = Math.round(dock.y - buttonSize / 2);
    const radius = Math.max(4, Math.floor(buttonSize * 0.22));

    ctx.save();

    // 1. Rebaixo da baia no chassi metálico (Poço rebaixado escuro)
    ctx.fillStyle = '#080c12';
    ctx.beginPath();
    ctx.roundRect(bx - 2, by - 2, buttonSize + 4, buttonSize + 4, radius + 2);
    ctx.fill();
    ctx.strokeStyle = '#273444';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!isOccupied) {
      // Baia Livre / Standby: contorno pontilhado suave
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 1, buttonSize - 2, buttonSize - 2, radius);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.beginPath();
      ctx.arc(dock.x, dock.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (box && colorDef) {
      // 2. Baia Ocupada: Botão Elevado Tátil 3D com a Cor da Caixa (Referência Exata)
      // Sombra projetada do botão
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(bx, by + 3.5, buttonSize, buttonSize, radius);
      ctx.fill();

      // Corpo principal do botão da cor da caixa
      ctx.fillStyle = colorDef.hex;
      ctx.beginPath();
      ctx.roundRect(bx, by, buttonSize, buttonSize, radius);
      ctx.fill();

      // Gradiente de chanfro de relevo superior do botão
      const btnGrad = ctx.createLinearGradient(bx, by, bx, by + buttonSize);
      btnGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      btnGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
      btnGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, buttonSize, buttonSize, radius);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 3. Miniatura de Caixa Isométrica 3D no Topo do Botão (com faces e fita)
      const miniBoxSize = Math.max(9, Math.floor(buttonSize * 0.30));
      draw3DIsoMiniBox(ctx, dock.x, by + Math.floor(buttonSize * 0.24), miniBoxSize, colorDef);

      // 4. CONTADOR NUMÉRICO GRANDE E NÍTIDO NA BASE
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
// 9. Partículas e Efeito de Celebração de Vitória
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
