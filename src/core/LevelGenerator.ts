import { BoardGrid, LevelData } from './Types';
import { DEFAULT_PALETTE } from './Colors';
import { LevelSolver } from './LevelSolver';
import { EdgeDetector } from './EdgeDetector';

export interface GeneratorOptions {
  name?: string;
  numColumns?: number; // Padrão: 4 colunas
  minBoxCapacity?: number; // Padrão: 2
  maxBoxCapacity?: number; // Padrão: 35
  bufferSize?: number; // Padrão: 5
  targetDifficulty?: 'Muito Fácil' | 'Fácil' | 'Médio' | 'Difícil' | 'Extremo';
  onProgress?: (status: string, percent: number) => void;
}

/**
 * Gerador Dinâmico de Fases.
 * Converte matrizes em fases desafiadoras, usando "Dynamic Peeling" (The Golden Path) 
 * e "Controlled Deep Insertion" para garantir que as caixas fiquem
 * misturadas nas colunas, exigindo que o jogador utilize o buffer de forma estratégica.
 */
export class LevelGenerator {
  static async generateLevel(
    grid: BoardGrid,
    options: GeneratorOptions = {}
  ): Promise<{ level: LevelData; solutionsCount: number; difficulty: string }> {
    const name = options.name || 'Nova Fase';
    const numColumns = options.numColumns || 4;
    const minCap = options.minBoxCapacity || 2;
    const maxCap = options.maxBoxCapacity || 35;
    const bufferSize = options.bufferSize || 5;
    const onProgress = options.onProgress || (() => {});

    onProgress("Iniciando varredura da imagem...", 5);

    const height = grid.length;
    const width = grid[0]?.length || 0;

    // 1. Contagem total de blocos por cor
    const colorCounts: Record<string, number> = {};
    let totalBlocks = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = grid[y][x];
        if (c !== null) {
          colorCounts[c] = (colorCounts[c] || 0) + 1;
          totalBlocks++;
        }
      }
    }

    // Passo 1: Dynamic Peeling (The Golden Path)
    interface UnplacedBox {
      colorId: string;
      capacity: number;
    }
    const playSequence: UnplacedBox[] = [];
    
    let peelGrid = grid.map((row) => [...row]);
    let blocksLeft = totalBlocks;
    let safeLoopGuard = 0;
    
    while (blocksLeft > 0 && safeLoopGuard < 10000) {
      safeLoopGuard++;
      
      // Permitir renderização no navegador a cada 10 ciclos
      if (safeLoopGuard % 10 === 0) {
        const pct = 5 + Math.floor(((totalBlocks - blocksLeft) / totalBlocks) * 45);
        onProgress(`Calculando caminho dourado: ${totalBlocks - blocksLeft} de ${totalBlocks}...`, pct);
        await new Promise(r => setTimeout(r, 0));
      }
      
      const exposedCounts = EdgeDetector.getExposedCounts(peelGrid);
      const exposedColors = Object.keys(exposedCounts);
      
      if (exposedColors.length === 0) {
        console.warn("Deadlock durante o peeling! O grid não pode ser completamente desmontado.");
        break;
      }
      
      // Escolher uma cor aleatória exposta
      const colorId = exposedColors[Math.floor(Math.random() * exposedColors.length)];
      
      // Contar quantos blocos dessa cor ainda existem no peelGrid (limite máximo para K)
      let remainingOfColor = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (peelGrid[y][x] === colorId) remainingOfColor++;
        }
      }
      
      // Escolher capacidade K aleatória
      let cap: number;
      const rand = Math.random();
      if (rand < 0.25) {
        cap = Math.floor(Math.random() * 4) + 2; // 2 a 5
      } else if (rand < 0.70) {
        cap = Math.floor(Math.random() * 10) + 6; // 6 a 15
      } else {
        cap = Math.floor(Math.random() * 20) + 16; // 16 a 35
      }
      
      cap = Math.max(minCap, Math.min(cap, remainingOfColor, maxCap));
      
      // Consumir até K blocos
      const { newGrid, removedCount } = EdgeDetector.consumeBlocks(peelGrid, colorId, cap);
      peelGrid = newGrid;
      
      if (removedCount > 0) {
        playSequence.push({ colorId, capacity: removedCount });
        blocksLeft -= removedCount;
      }
    }

    const targetDifficulty = options.targetDifficulty || 'Médio';
    const difficultyDepth: Record<string, number> = {
      'Muito Fácil': 0,
      'Fácil': 1,
      'Médio': 2,
      'Difícil': 3,
      'Extremo': 4,
    };
    const D = difficultyDepth[targetDifficulty] ?? 2;

    // Passo 2 e 3: Controlled Deep Insertion & Solver Validation
    let bestSupply: { colorId: string; capacity: number }[][] = Array.from(
      { length: numColumns },
      () => []
    );
    let isLevelSolvable = false;
    let finalResult: any = null;
    
    // Tentamos até 10 vezes gerar uma distribuição válida
    for (let attempt = 0; attempt < 10; attempt++) {
      onProgress(`Embaralhando caixas para a dificuldade ${targetDifficulty} (Tentativa ${attempt+1}/10)...`, 50 + (attempt * 4));
      await new Promise(r => setTimeout(r, 0));

      const supply: { colorId: string; capacity: number }[][] = Array.from(
        { length: numColumns },
        () => []
      );
      
      // Iterar DE TRÁS PARA FRENTE para criar a pilha de fornecimento
      for (let i = playSequence.length - 1; i >= 0; i--) {
        const box = playSequence[i];
        const col = Math.floor(Math.random() * numColumns);
        
        // Inserir em uma profundidade D aleatória
        const maxDepth = Math.min(supply[col].length, D);
        const depth = Math.floor(Math.random() * (maxDepth + 1));
        
        supply[col].splice(depth, 0, box);
      }
      
      // Validar com o solver (otimizado com returnOnFirstSolution = true)
      const res = LevelSolver.solve(grid, supply, bufferSize, 8000, true);
      
      if (res.isSolvable) {
        isLevelSolvable = true;
        bestSupply = supply;
        break;
      }
    }
    
    // Se ainda falhar, faz o fallback seguro
    let generatedDifficulty = targetDifficulty;
    if (!isLevelSolvable) {
      bestSupply = Array.from({ length: numColumns }, () => []);
      for (let i = playSequence.length - 1; i >= 0; i--) {
        const box = playSequence[i];
        const col = Math.floor(Math.random() * numColumns);
        bestSupply[col].unshift(box);
      }
      generatedDifficulty = 'Muito Fácil'; // Fallback is equivalent to D=0
    }
    
    // Análise Final Completa do nível
    onProgress("Calculando métricas finais da dificuldade...", 95);
    await new Promise(r => setTimeout(r, 0));
    finalResult = LevelSolver.solve(grid, bestSupply, bufferSize, 8000);
    onProgress("Pronto!", 100);

    const levelData: LevelData = {
      id: `level_${Date.now()}`,
      name,
      width,
      height,
      initialGrid: grid.map((r) => [...r]),
      initialSupply: bestSupply,
      palette: DEFAULT_PALETTE,
      bufferSize,
      metadata: {
        totalBlocks,
        totalBoxes: playSequence.length,
        colorCounts,
        solutionsCount: finalResult.totalSolutions,
        difficulty: generatedDifficulty,
      },
    };

    return {
      level: levelData,
      solutionsCount: finalResult.totalSolutions,
      difficulty: generatedDifficulty,
    };
  }
}
