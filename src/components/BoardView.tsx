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
        className="grid gap-1 p-2 bg-slate-950 rounded-xl border border-slate-800/80 shadow-inner"
        style={{
          gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
          maxWidth: '100%',
        }}
      >
        {grid.map((row, y) =>
          row.map((cell, x) => {
            if (cell === null) {
              return (
                <div
                  key={`${x}-${y}`}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-slate-900/30 border border-slate-800/20 transition-all duration-300"
                />
              );
            }

            const colorDef = palette[cell];
            const isExposed = EdgeDetector.isCellExposed(grid, x, y);

            return (
              <div
                key={`${x}-${y}`}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-xs font-black shadow-md transition-all duration-200 select-none ${
                  isExposed
                    ? 'ring-2 ring-white/90 scale-[1.02] shadow-cyan-500/20'
                    : 'opacity-85'
                }`}
                style={{
                  backgroundColor: colorDef?.hex || '#64748b',
                  color: colorDef?.textHex || '#ffffff',
                }}
                title={`(${x}, ${y}) Cor: ${colorDef?.name || cell} ${
                  isExposed ? '[Borda Exposta]' : '[Oculto no Miolo]'
                }`}
              >
                {colorDef?.letter || cell}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
