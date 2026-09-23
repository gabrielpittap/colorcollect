import React from 'react';
import { ColorDef, SupplyBox } from '../core/Types';
import { ArrowUp, Lock, Package } from 'lucide-react';

interface SupplyViewProps {
  columns: SupplyBox[][];
  palette: Record<string, ColorDef>;
  onPullBox: (colIdx: number) => void;
  canPull: boolean;
}

export const SupplyView: React.FC<SupplyViewProps> = ({
  columns,
  palette,
  onPullBox,
  canPull,
}) => {
  return (
    <div className="flex flex-col items-center w-full px-2.5 sm:px-3 py-1.5 sm:py-2.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between w-full mb-1 sm:mb-2 text-xs font-semibold text-slate-300">
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          <span className="text-[11px] sm:text-xs">Depósito de Caixas</span>
        </span>
        <span className="text-[9px] sm:text-[10px] text-slate-400">
          Toque para lançar à doca
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full max-w-lg">
        {columns.map((column, colIdx) => {
          const topBox = column[0];
          const hasBoxes = column.length > 0;
          const topColor = topBox ? palette[topBox.colorId] : null;

          return (
            <div key={colIdx} className="flex flex-col items-center gap-1 sm:gap-1.5">
              {/* Caixa Frontal Liberada */}
              {hasBoxes && topColor ? (
                <button
                  type="button"
                  onClick={() => canPull && onPullBox(colIdx)}
                  disabled={!canPull}
                  className={`w-full group relative rounded-xl sm:rounded-2xl p-1 sm:p-2 flex flex-col items-center justify-between border-2 transition-all duration-150 select-none shadow-md ${
                    canPull
                      ? 'hover:-translate-y-1 active:translate-y-0.5 active:scale-95 cursor-pointer shadow-cyan-500/10'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: topColor.hex,
                    borderColor: '#ffffff66',
                    color: topColor.textHex,
                    boxShadow: canPull ? `0 6px 16px ${topColor.hex}30` : undefined,
                  }}
                  title={`Puxar caixa ${topColor.name} (${topBox.remaining} blocos)`}
                >
                  <div className="w-full flex justify-between items-center text-[8px] sm:text-[10px] font-black opacity-80">
                    <span className="tracking-wider">{topColor.letter}</span>
                    <ArrowUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <span className="text-base sm:text-xl font-black tracking-tight my-0 sm:my-0.5 drop-shadow-sm">
                    {topBox.remaining}
                  </span>

                  <span className="text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-xs">
                    Disponível
                  </span>
                </button>
              ) : (
                <div className="w-full h-[54px] sm:h-[76px] rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/30 flex items-center justify-center text-[10px] sm:text-xs text-slate-600 font-bold select-none">
                  Vazio
                </div>
              )}

              {/* Caixas de trás empilhadas */}
              <div className="w-full flex flex-col gap-0.5 sm:gap-1">
                {column.slice(1, 3).map((box) => {
                  const color = palette[box.colorId];
                  return (
                    <div
                      key={box.id}
                      className="w-full rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center justify-between text-[9px] sm:text-[11px] font-bold opacity-60 border border-slate-800/80 bg-slate-950/60"
                      style={{
                        borderColor: color?.hex ? `${color.hex}44` : '#334155',
                        color: color?.hex || '#94a3b8',
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Lock className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-slate-500" />
                        {color?.letter || box.colorId}
                      </span>
                      <span className="font-mono text-[9px] sm:text-[10px]">{box.totalCapacity}</span>
                    </div>
                  );
                })}
                {column.length > 3 && (
                  <span className="text-[8px] sm:text-[9px] text-center text-slate-500 font-medium">
                    +{column.length - 3} na fila
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
