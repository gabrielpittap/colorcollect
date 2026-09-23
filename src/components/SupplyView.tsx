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
      <div className="flex items-center justify-between w-full mb-1 sm:mb-1.5 text-xs font-semibold text-slate-300">
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          <span className="text-[11px] sm:text-xs">Depósito de Caixas</span>
        </span>
        <span
          className={`text-[9px] sm:text-[10px] transition-colors ${
            canPull ? 'text-slate-400' : 'text-amber-400 font-bold'
          }`}
        >
          {canPull ? 'Toque para lançar à doca' : 'Docas ocupadas (0 livres)'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full max-w-lg">
        {columns.map((column, colIdx) => {
          const topBox = column[0];
          const hasBoxes = column.length > 0;
          const topColor = topBox ? palette[topBox.colorId] : null;
          const extraCount = Math.max(0, column.length - 4);

          return (
            <div key={colIdx} className="flex flex-col items-center gap-1 w-full min-w-0">
              {/* Linha 1: Caixa Frontal Liberada / Disponível */}
              {hasBoxes && topColor ? (
                <button
                  type="button"
                  onClick={() => canPull && onPullBox(colIdx)}
                  disabled={!canPull}
                  className={`w-full h-[52px] sm:h-[60px] group relative rounded-xl p-1 sm:p-1.5 flex flex-col items-center justify-between border-2 transition-all duration-150 select-none shadow-md ${
                    canPull
                      ? 'hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 cursor-pointer shadow-cyan-500/10'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: topColor.hex,
                    borderColor: '#ffffff88',
                    color: topColor.textHex,
                    boxShadow: canPull ? `0 4px 12px ${topColor.hex}35` : undefined,
                  }}
                  title={`Puxar caixa ${topColor.name} (${topBox.remaining} blocos)`}
                >
                  <div className="w-full flex justify-between items-center text-[8px] sm:text-[9px] font-black opacity-85 leading-none">
                    <span className="tracking-wider">{topColor.letter}</span>
                    <ArrowUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <span className="text-base sm:text-xl font-black tracking-tight leading-none drop-shadow-sm">
                    {topBox.remaining}
                  </span>

                  <span className="text-[7px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/25 leading-none backdrop-blur-xs">
                    Disponível
                  </span>
                </button>
              ) : (
                <div className="w-full h-[52px] sm:h-[60px] rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/30 flex items-center justify-center text-[10px] sm:text-xs text-slate-600 font-bold select-none">
                  Vazio
                </div>
              )}

              {/* Linhas 2, 3 e 4: Próximas 3 caixas enfileiradas com suas CORES visíveis */}
              <div className="w-full flex flex-col gap-0.5 sm:gap-1">
                {[0, 1, 2].map((queueIdx) => {
                  const box = column[queueIdx + 1];
                  if (box) {
                    const color = palette[box.colorId];
                    const hex = color?.hex || '#64748b';
                    const textHex = color?.textHex || '#ffffff';

                    return (
                      <div
                        key={box.id}
                        className="w-full h-5 sm:h-5.5 rounded-md sm:rounded-lg px-1.5 flex items-center justify-between text-[9px] sm:text-[10px] font-bold border transition-colors shadow-xs"
                        style={{
                          backgroundColor: hex,
                          borderColor: 'rgba(255, 255, 255, 0.4)',
                          color: textHex,
                        }}
                        title={`Próxima: ${color?.name || box.colorId} (${box.totalCapacity} blocos)`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          <Lock className="w-2.5 h-2.5 opacity-75 shrink-0" />
                          <span className="truncate leading-none">{color?.letter || box.colorId}</span>
                        </span>
                        <span className="font-mono text-[9px] sm:text-[10px] font-extrabold leading-none">
                          {box.totalCapacity}
                        </span>
                      </div>
                    );
                  }

                  // Placeholder vazio para manter as 4 colunas perfeitamente alinhadas
                  return (
                    <div
                      key={`empty-slot-${queueIdx}`}
                      className="w-full h-5 sm:h-5.5 rounded-md sm:rounded-lg border border-dashed border-slate-800/60 bg-slate-950/30 flex items-center justify-center text-[10px] text-slate-700 select-none font-bold"
                    >
                      ·
                    </div>
                  );
                })}
              </div>

              {/* Indicador de excedente na fila (+N na fila) */}
              <div className="w-full h-3.5 flex items-center justify-center">
                {extraCount > 0 ? (
                  <span className="text-[8px] sm:text-[9px] text-cyan-400 font-bold truncate">
                    +{extraCount} na fila
                  </span>
                ) : (
                  <span className="text-[8px] opacity-0 select-none">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
