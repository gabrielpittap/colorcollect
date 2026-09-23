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
   * Encontra rota ortogonal mais curta da posição atual até a portinha lateral direita.
   * Todos os robôs da fábrica saem sempre pela mesma porta na lateral direita.
   */
  public static findPathToSideExit(
    startX: number,
    startY: number,
    grid: BoardGrid,
    width: number,
    height: number
  ): GridPoint[] {
    const exitY = Math.floor(height / 2);
    // Porta lateral direita (fora da matriz em x = width)
    const targetDoor: GridPoint = { x: width, y: exitY };

    // BFS até a porta
    const queue: GridPoint[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const parent = new Map<string, GridPoint>();
    let found = false;

    const dirs = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;

      if (curr.x === targetDoor.x && curr.y === targetDoor.y) {
        found = true;
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

    const path: GridPoint[] = [];
    if (found) {
      let curr: GridPoint | undefined = targetDoor;
      while (curr && !(curr.x === startX && curr.y === startY)) {
        path.unshift(curr);
        curr = parent.get(`${curr.x},${curr.y}`);
      }
    } else {
      // Fallback direto se o caminho fechou
      path.push(targetDoor);
    }

    return path;
  }
}
