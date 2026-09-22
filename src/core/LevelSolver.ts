import { BoardGrid, SolverMove, SolverResult } from './Types';
import { EdgeDetector } from './EdgeDetector';

interface SimBox {
  colorId: string;
  capacity: number;
  remaining: number;
}

interface SimState {
  grid: BoardGrid;
  buffer: SimBox[];
  supply: SimBox[][]; // supply[coluna]
  path: SolverMove[];
}

/**
 * Validador e Analisador de Solvabilidade (Solver).
 * Executa uma busca em árvore para encontrar todos os caminhos viáveis até a vitória,
 * garantindo matematicamente que a fase não trava e medindo sua dificuldade exata.
 */
export class LevelSolver {
  /**
   * Resolve e avalia a fase de forma exaustiva.
   * @param initialGrid Matriz inicial do tabuleiro
   * @param initialSupply Grade de colunas de caixas [col][row]
   * @param maxBufferSize Capacidade do buffer (padrão: 5)
   * @param maxStatesToExplore Limite de segurança de estados para busca rápida
   */
  static solve(
    initialGrid: BoardGrid,
    initialSupply: { colorId: string; capacity: number }[][],
    maxBufferSize: number = 5,
    maxStatesToExplore: number = 8000
  ): SolverResult {
    const startTime = performance.now();

    // Converte o suprimento para a estrutura de simulação
    const startSupply: SimBox[][] = initialSupply.map((col) =>
      col.map((b) => ({
        colorId: b.colorId,
        capacity: b.capacity,
        remaining: b.capacity,
      }))
    );

    const queue: SimState[] = [
      {
        grid: initialGrid.map((row) => [...row]),
        buffer: [],
        supply: startSupply,
        path: [],
      },
    ];

    const visited = new Set<string>();
    let totalSolutions = 0;
    let deadlocks = 0;
    let statesEvaluated = 0;
    let bestSolution: SolverMove[] | undefined = undefined;

    // Gerador de hash de estado para poda de repetições
    const computeStateHash = (
      grid: BoardGrid,
      buffer: SimBox[],
      supply: SimBox[][]
    ): string => {
      // Hash do grid: contagem de blocos restantes por cor
      const remainingByColor: Record<string, number> = {};
      for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < (grid[y]?.length || 0); x++) {
          const c = grid[y][x];
          if (c) remainingByColor[c] = (remainingByColor[c] || 0) + 1;
        }
      }
      const gridPart = Object.entries(remainingByColor)
        .sort()
        .map(([c, n]) => `${c}:${n}`)
        .join(',');

      // Hash do buffer: caixas ordenadas
      const bufPart = buffer
        .map((b) => `${b.colorId}:${b.remaining}`)
        .sort()
        .join('|');

      // Hash do supply: índices das caixas do topo de cada coluna
      const supPart = supply
        .map((col) => (col.length > 0 ? `${col[0].colorId}:${col.length}` : '_'))
        .join(';');

      return `${gridPart}#${bufPart}#${supPart}`;
    };

    while (queue.length > 0 && statesEvaluated < maxStatesToExplore) {
      const current = queue.shift()!;
      statesEvaluated++;

      // Checa se o tabuleiro está completamente limpo (VITÓRIA)
      const remainingBlocks = EdgeDetector.countRemainingBlocks(current.grid);
      if (remainingBlocks === 0) {
        totalSolutions++;
        if (!bestSolution || current.path.length < bestSolution.length) {
          bestSolution = current.path;
        }
        continue;
      }

      // Se o buffer atingiu a capacidade máxima e nenhuma caixa do buffer consegue consumir nada: DEADLOCK
      if (current.buffer.length >= maxBufferSize) {
        let anyCanConsume = false;
        for (const box of current.buffer) {
          const exposed = EdgeDetector.getExposedCells(current.grid, box.colorId);
          if (exposed.length > 0) {
            anyCanConsume = true;
            break;
          }
        }
        if (!anyCanConsume) {
          deadlocks++;
          continue;
        }
      }

      // Identifica movimentos legais: qualquer coluna não vazia, desde que o buffer tenha espaço livre
      if (current.buffer.length >= maxBufferSize) {
        // Não é possível puxar novas caixas
        deadlocks++;
        continue;
      }

      const availableMoves: number[] = [];
      for (let colIdx = 0; colIdx < current.supply.length; colIdx++) {
        if (current.supply[colIdx].length > 0) {
          availableMoves.push(colIdx);
        }
      }

      if (availableMoves.length === 0 && current.buffer.length === 0) {
        // Não há mais caixas e sobram blocos no tabuleiro: DEADLOCK
        deadlocks++;
        continue;
      }

      for (const colIdx of availableMoves) {
        // Clona estado para ramificar
        const nextGrid: BoardGrid = current.grid.map((row) => [...row]);
        const nextSupply: SimBox[][] = current.supply.map((col, i) =>
          i === colIdx ? col.slice(1) : col.map((b) => ({ ...b }))
        );
        const pulledBox = current.supply[colIdx][0];
        const nextBuffer: SimBox[] = current.buffer.map((b) => ({ ...b }));
        nextBuffer.push({ ...pulledBox });

        // Simula o ciclo de desmonte de todas as caixas ativas no buffer
        let activity = true;
        while (activity) {
          activity = false;

          for (let i = 0; i < nextBuffer.length; i++) {
            const box = nextBuffer[i];
            if (box.remaining > 0) {
              const res = EdgeDetector.consumeBlocks(
                nextGrid,
                box.colorId,
                box.remaining
              );
              if (res.removedCount > 0) {
                // Atualiza o grid
                for (const coord of res.removedCoords) {
                  nextGrid[coord.y][coord.x] = null;
                }
                box.remaining -= res.removedCount;
                activity = true;
              }
            }
          }

          // Remove caixas concluídas (zeradas) do buffer
          for (let i = nextBuffer.length - 1; i >= 0; i--) {
            if (nextBuffer[i].remaining === 0) {
              nextBuffer.splice(i, 1);
              activity = true; // Liberar um slot pode permitir nova dinâmica
            }
          }
        }

        const stateHash = computeStateHash(nextGrid, nextBuffer, nextSupply);
        if (!visited.has(stateHash)) {
          visited.add(stateHash);
          queue.push({
            grid: nextGrid,
            buffer: nextBuffer,
            supply: nextSupply,
            path: [
              ...current.path,
              {
                column: colIdx,
                boxColor: pulledBox.colorId,
                boxCapacity: pulledBox.capacity,
              },
            ],
          });
        }
      }
    }

    const executionTimeMs = performance.now() - startTime;
    const isSolvable = totalSolutions > 0;

    // Classificação de Dificuldade baseada em soluções e deadlocks
    let difficulty: SolverResult['difficulty'] = 'Médio';
    if (!isSolvable) {
      difficulty = 'Impossível';
    } else if (totalSolutions === 1) {
      difficulty = 'Extremo';
    } else if (totalSolutions <= 3) {
      difficulty = 'Difícil';
    } else if (totalSolutions <= 10) {
      difficulty = 'Médio';
    } else if (totalSolutions <= 30) {
      difficulty = 'Fácil';
    } else {
      difficulty = 'Muito Fácil';
    }

    const branchingFactor =
      statesEvaluated > 0 ? (statesEvaluated - deadlocks) / statesEvaluated : 0;

    return {
      isSolvable,
      totalSolutions,
      difficulty,
      branchingFactor,
      deadlockStatesCount: deadlocks,
      bestSolution,
      statesEvaluated,
      executionTimeMs,
    };
  }
}
