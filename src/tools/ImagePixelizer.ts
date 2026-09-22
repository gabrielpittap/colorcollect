import { BoardGrid, ColorDef } from '../core/Types';
import { COLOR_KEYS, DEFAULT_PALETTE } from '../core/Colors';

export interface PixelizeOptions {
  width?: number; // Padrão: 16
  height?: number; // Padrão: 16
  numColors?: number; // Padrão: 4 a 6 cores
}

export interface PixelizeResult {
  grid: BoardGrid;
  palette: Record<string, ColorDef>;
  previewDataUrl: string;
}

/**
 * Utilitário para converter qualquer foto ou imagem em uma matriz matricial
 * quantizada e pronta para ser transformada em uma fase jogável pelo LevelGenerator.
 */
export class ImagePixelizer {
  /**
   * Converte uma imagem HTML em uma matriz de cores categorizadas.
   */
  static processImage(
    img: HTMLImageElement,
    options: PixelizeOptions = {}
  ): PixelizeResult {
    const targetW = options.width || 16;
    const targetH = options.height || 16;
    const maxColors = Math.min(options.numColors || 5, COLOR_KEYS.length);

    // 1. Cria canvas temporário para redimensionar a imagem com interpolação
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Falha ao obter contexto 2D para pixelização');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    // 2. Coleta de pixels em formato RGB
    const pixels: [number, number, number][] = [];
    for (let i = 0; i < data.length; i += 4) {
      // Ignora transparência se alfa for muito baixo
      const a = data[i + 3];
      if (a < 50) {
        pixels.push([-1, -1, -1]); // Vazio
      } else {
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }

    // 3. Algoritmo K-Means Simplificado para Quantização de Cores
    const validPixels = pixels.filter((p) => p[0] !== -1);
    if (validPixels.length === 0) {
      // Fallback
      return this.createDummyMatrix(targetW, targetH);
    }

    // Inicializa centróides pegando amostras espaçadas
    const centroids: [number, number, number][] = [];
    const step = Math.max(1, Math.floor(validPixels.length / maxColors));
    for (let i = 0; i < maxColors; i++) {
      centroids.push([...validPixels[(i * step) % validPixels.length]]);
    }

    // 4 iterações de convergência K-Means
    for (let iter = 0; iter < 4; iter++) {
      const clusters: [number, number, number][][] = Array.from(
        { length: maxColors },
        () => []
      );

      for (const p of validPixels) {
        let minDist = Infinity;
        let bestC = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dist = this.colorDistance(p, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestC = c;
          }
        }
        clusters[bestC].push(p);
      }

      // Recalcula centróides
      for (let c = 0; c < maxColors; c++) {
        if (clusters[c].length > 0) {
          const sum = clusters[c].reduce(
            (acc, curr) => [acc[0] + curr[0], acc[1] + curr[1], acc[2] + curr[2]],
            [0, 0, 0]
          );
          centroids[c] = [
            Math.round(sum[0] / clusters[c].length),
            Math.round(sum[1] / clusters[c].length),
            Math.round(sum[2] / clusters[c].length),
          ];
        }
      }
    }

    // 4. Mapeia centróides para a Paleta do Jogo (IDs 'A', 'B', 'C'...)
    const customPalette: Record<string, ColorDef> = {};
    for (let c = 0; c < centroids.length; c++) {
      const key = COLOR_KEYS[c];
      const rgb = centroids[c];
      const hex = this.rgbToHex(rgb[0], rgb[1], rgb[2]);
      const isDark = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 128;

      customPalette[key] = {
        id: key,
        letter: key,
        name: DEFAULT_PALETTE[key]?.name || `Cor ${key}`,
        hex,
        textHex: isDark ? '#ffffff' : '#0f172a',
      };
    }

    // 5. Monta a matriz final
    const grid: BoardGrid = Array.from({ length: targetH }, () =>
      Array(targetW).fill(null)
    );

    let idx = 0;
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        const p = pixels[idx++];
        if (p[0] === -1) {
          grid[y][x] = null;
        } else {
          // Acha centróide mais próximo
          let minDist = Infinity;
          let bestC = 0;
          for (let c = 0; c < centroids.length; c++) {
            const dist = this.colorDistance(p, centroids[c]);
            if (dist < minDist) {
              minDist = dist;
              bestC = c;
            }
          }
          grid[y][x] = COLOR_KEYS[bestC];
        }
      }
    }

    return {
      grid,
      palette: customPalette,
      previewDataUrl: canvas.toDataURL(),
    };
  }

  private static colorDistance(
    c1: [number, number, number],
    c2: [number, number, number]
  ): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return dr * dr + dg * dg + db * db;
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }

  private static createDummyMatrix(w: number, h: number): PixelizeResult {
    const grid: BoardGrid = Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => {
        if (y === 0 || y === h - 1 || x === 0 || x === w - 1) return 'A';
        return 'B';
      })
    );
    return {
      grid,
      palette: DEFAULT_PALETTE,
      previewDataUrl: '',
    };
  }
}
