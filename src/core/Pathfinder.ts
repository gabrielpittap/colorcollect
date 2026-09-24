import { BoardGrid } from './Types';

export interface GridPoint {
  x: number;
  y: number;
}

/**
 * ColorCollect Orthogonal Pathfinder
 * Algoritmo BFS para encontrar rotas ortogonais (N, S, L, O) em grade,
 * garantindo que os robôs NUNCA atravessem blocos sólidos na tela.
 */
export class Pathfinder {
  /**
   * Verifica se uma coordenada é transitável (célula nula ou corredor perimetral)
   */
  public static isWalkable(
    x: number,
    y: number,
    grid: BoardGrid,
    width: number,
    height: number
  ): boolean {
    // Corredores externos ao redor da matriz são sempre transitáveis
    if (x < 0 || x >= width || y < 0 || y >= height) {
      // Limite do perímetro virtual do canvas
      return x >= -2 && x <= width + 1 && y >= -2 && y <= height + 2;
    }

    // Dentro da matriz, só é transitável se a célula já foi coletada (null)
    return grid[y][x] === null;
  }

  /**
   * Encontra o caminho ortogonal mais curto de (startX, startY) até
   * uma das células vizinhas livres de (targetX, targetY).
   */
  public static findPathToBlockFace(
    startX: number,
    startY: number,
    targetBlockX: number,
    targetBlockY: number,
    grid: BoardGrid,
    width: number,
    height: number
  ): GridPoint[] | null {
    // 4 vizinhos ortogonais do bloco alvo
    const candidates: GridPoint[] = [
      { x: targetBlockX, y: targetBlockY + 1 }, // Baixo
      { x: targetBlockX, y: targetBlockY - 1 }, // Cima
      { x: targetBlockX - 1, y: targetBlockY }, // Esquerda
      { x: targetBlockX + 1, y: targetBlockY }, // Direita
    ].filter((p) => this.isWalkable(p.x, p.y, grid, width, height));

    if (candidates.length === 0) return null;

    // Se já estiver em um dos vizinhos
    for (const c of candidates) {
      if (c.x === startX && c.y === startY) {
        return [c];
      }
    }

    // BFS a partir de (startX, startY) até qualquer candidato
    const queue: GridPoint[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const parent = new Map<string, GridPoint>();
    const isTarget = new Set(candidates.map((c) => `${c.x},${c.y}`));

    let foundTarget: GridPoint | null = null;

    const dirs = [
      { x: 0, y: -1 }, // N
      { x: 0, y: 1 },  // S
      { x: -1, y: 0 }, // O
      { x: 1, y: 0 },  // L
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const key = `${curr.x},${curr.y}`;

      if (isTarget.has(key)) {
        foundTarget = curr;
        break;
      }

      for (const d of dirs) {
        const nx = curr.x + d.x;
        const ny = curr.y + d.y;
        const nkey = `${nx},${ny}`;

        if (!visited.has(nkey) && this.isWalkable(nx, ny, grid, width, height)) {
          visited.add(nkey);
          parent.set(nkey, curr);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    if (!foundTarget) return null;

    // Reconstrói caminho
    const path: GridPoint[] = [];
    let curr: GridPoint | undefined = foundTarget;

    while (curr && !(curr.x === startX && curr.y === startY)) {
      path.unshift(curr);
      curr = parent.get(`${curr.x},${curr.y}`);
    }

    return path;
  }

  /**
   * Encontra rota estritamente ortogonal (sem atalhos diagonais) da posição atual
   * até o corredor lateral direito (x = width).
   * Se o caminho direto para x = width estiver temporariamente ocluído por blocos,
   * encontra o perímetro mais próximo e contorna pelos corredores externos abertos.
   */
  public static findPathToSideExit(
    startX: number,
    startY: number,
    grid: BoardGrid,
    width: number,
    height: number
  ): GridPoint[] {
    // 1. BFS procurando a saída mais próxima para x >= width
    const queue: GridPoint[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const parent = new Map<string, GridPoint>();
    let targetExit: GridPoint | null = null;
    let anyPerimeterExit: GridPoint | null = null;

    const dirs = [
      { x: 1, y: 0 },  // Leste (prioridade: ir para a direita)
      { x: 0, y: 1 },  // Sul
      { x: 0, y: -1 }, // Norte
      { x: -1, y: 0 }, // Oeste
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;

      // Se atingiu o corredor lateral direito
      if (curr.x >= width) {
        targetExit = curr;
        break;
      }

      // Se atingiu qualquer perímetro aberto fora da matriz
      if (!anyPerimeterExit && (curr.x < 0 || curr.y < 0 || curr.y >= height)) {
        anyPerimeterExit = curr;
      }

      for (const d of dirs) {
        const nx = curr.x + d.x;
        const ny = curr.y + d.y;
        const nkey = `${nx},${ny}`;

        if (!visited.has(nkey) && this.isWalkable(nx, ny, grid, width, height)) {
          visited.add(nkey);
          parent.set(nkey, curr);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    const chosenExit = targetExit || anyPerimeterExit;
    const path: GridPoint[] = [];

    if (chosenExit) {
      let curr: GridPoint | undefined = chosenExit;
      while (curr && !(curr.x === startX && curr.y === startY)) {
        path.unshift(curr);
        curr = parent.get(`${curr.x},${curr.y}`);
      }

      // Se saiu por outro perímetro que não seja o lateral direito (ex: superior, inferior ou esquerdo),
      // contorna pelos corredores externos transitáveis até x = width usando passos ortogonais unitários
      let last = path.length > 0 ? path[path.length - 1] : { x: startX, y: startY };

      // Se saiu pela esquerda (x < 0), desce até o corredor inferior (y = height)
      while (last.x < 0) {
        if (last.y < height) {
          last = { x: last.x, y: last.y + 1 };
        } else {
          last = { x: last.x + 1, y: last.y };
        }
        path.push(last);
      }

      // Se saiu pelo topo (y < 0) ou fundo (y >= height), avança em X até x = width
      while (last.x < width) {
        last = { x: last.x + 1, y: last.y };
        path.push(last);
      }
    } else {
      // Fallback ortogonal estrito passo a passo (caso em que startX já está no grid)
      let curX = startX;
      let curY = startY;
      while (curX < width) {
        curX++;
        path.push({ x: curX, y: curY });
      }
    }

    return path;
  }
}
