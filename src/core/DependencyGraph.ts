import { BoardGrid, DependencyEdge } from './Types';
import { EdgeDetector } from './EdgeDetector';

export interface ColorLayerAnalysis {
  colorId: string;
  minLayer: number; // A camada mais externa onde essa cor aparece (0 = borda externa)
  maxLayer: number; // A camada mais interna onde essa cor aparece
  totalCount: number;
}

/**
 * Constrói o Grafo de Dependência (DAG) de cores a partir da imagem matricial.
 * Identifica quais cores atuam como "casca" externa e quais estão "enclausuradas" no miolo.
 */
export class DependencyGraph {
  /**
   * Calcula a distância de camada (casca) de cada célula até a borda externa.
   * Camada 0: borda externa imediata.
   * Camada 1: requer remoção da camada 0 para ser alcançada, etc.
   */
  static computeLayerMatrix(grid: BoardGrid): number[][] {
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const layers: number[][] = Array.from({ length: height }, () =>
      Array(width).fill(-1)
    );

    // Cria uma cópia de trabalho do grid
    const simGrid: BoardGrid = grid.map((row) => [...row]);
    let currentLayer = 0;
    let hasRemaining = true;

    while (hasRemaining) {
      const exposed = EdgeDetector.getExposedCells(simGrid);
      if (exposed.length === 0) {
        break;
      }

      for (const cell of exposed) {
        layers[cell.y][cell.x] = currentLayer;
        simGrid[cell.y][cell.x] = null;
      }

      currentLayer++;
      hasRemaining = EdgeDetector.countRemainingBlocks(simGrid) > 0;
    }

    return layers;
  }

  /**
   * Analisa a distribuição de camadas para cada cor existente no tabuleiro.
   */
  static analyzeColorLayers(grid: BoardGrid): ColorLayerAnalysis[] {
    const layerMatrix = this.computeLayerMatrix(grid);
    const analysisMap: Record<
      string,
      { minLayer: number; maxLayer: number; totalCount: number }
    > = {};

    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < (grid[y]?.length || 0); x++) {
        const color = grid[y][x];
        if (color !== null) {
          const layer = layerMatrix[y][x];
          if (!analysisMap[color]) {
            analysisMap[color] = {
              minLayer: layer,
              maxLayer: layer,
              totalCount: 0,
            };
          } else {
            if (layer < analysisMap[color].minLayer) analysisMap[color].minLayer = layer;
            if (layer > analysisMap[color].maxLayer) analysisMap[color].maxLayer = layer;
          }
          analysisMap[color].totalCount++;
        }
      }
    }

    return Object.entries(analysisMap)
      .map(([colorId, data]) => ({
        colorId,
        minLayer: data.minLayer,
        maxLayer: data.maxLayer,
        totalCount: data.totalCount,
      }))
      .sort((a, b) => a.minLayer - b.minLayer);
  }

  /**
   * Constrói arestas de dependência direta entre cores.
   * Se a cor A precisa ser removida para desbloquear blocos adjacentes da cor B,
   * existe uma aresta A -> B.
   */
  static buildDependencyEdges(grid: BoardGrid): DependencyEdge[] {
    const layerMatrix = this.computeLayerMatrix(grid);
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const edgeCounts: Record<string, number> = {};

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = grid[y][x];
        if (!color) continue;
        const myLayer = layerMatrix[y][x];

        // Checa vizinhos
        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nColor = grid[n.y][n.x];
            if (nColor && nColor !== color) {
              const nLayer = layerMatrix[n.y][n.x];
              // Se meu vizinho está em camada mais externa que eu, ele me bloqueia!
              if (nLayer < myLayer) {
                const key = `${nColor}->${color}`;
                edgeCounts[key] = (edgeCounts[key] || 0) + 1;
              }
            }
          }
        }
      }
    }

    return Object.entries(edgeCounts).map(([key, count]) => {
      const [fromColor, toColor] = key.split('->');
      return {
        fromColor,
        toColor,
        blockingCount: count,
      };
    });
  }
}
