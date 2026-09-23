import React from 'react';
import { BoardGrid, ColorDef } from '../core/Types';
import { EdgeDetector } from '../core/EdgeDetector';

interface BoardViewProps {
  grid: BoardGrid;
  palette: Record<string, ColorDef>;
}

export const BoardView: React.FC<BoardViewProps> = ({ grid, palette }) => {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Matriz do Tabuleiro ({width}x{height})
        </span>
        <span className="text-slate-500">
          Células com anel branco = <strong>Borda Exposta (Acessível)</strong>
        </span>
      </div>

      {/* Grid Canvas Container */}
      <div
        className="grid gap-0.5 p-2 bg-slate-950 rounded-xl border border-slate-800/80 shadow-inner w-full max-w-[600px] mx-auto"
        style={{
          gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
          aspectRatio: width && height ? `${width} / ${height}` : '1 / 1',
        }}
      >
        {grid.map((row, y) =>
          row.map((cell, x) => {
            if (cell === null) {
              return (
                <div
                  key={`${x}-${y}`}
                  className="w-full h-full rounded-sm bg-slate-900/30 transition-all duration-300"
                />
              );
            }

            const colorDef = palette[cell];
            const isExposed = EdgeDetector.isCellExposed(grid, x, y);

            // Calcula um tamanho de fonte menor para grades maiores
            const fontSize = width > 20 ? 'text-[8px]' : 'text-xs';

            return (
              <div
                key={`${x}-${y}`}
                className={`w-full h-full rounded-sm flex items-center justify-center ${fontSize} font-black shadow-sm transition-all duration-200 select-none ${
                  isExposed
                    ? 'ring-[1.5px] ring-white/90 scale-[1.05] shadow-cyan-500/20 z-10'
                    : 'opacity-85'
                }`}
                style={{
                  backgroundColor: colorDef?.hex || '#64748b',
                  color: colorDef?.textHex || '#ffffff',
                }}
                title={`(${x}, ${y}) Cor: ${colorDef?.name || ''} ${
                  isExposed ? '[Borda Exposta]' : '[Oculto no Miolo]'
                }`}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
