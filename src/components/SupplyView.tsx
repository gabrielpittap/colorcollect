import React from 'react';
import { ColorDef, SupplyBox } from '../core/Types';
import { ArrowUp, Lock } from 'lucide-react';

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
    <div className="flex flex-col items-center w-full p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-medium">
        <span className="font-bold text-slate-200">
          Pilha Inferior de Caixas (Supply Deck)
        </span>
        <span className="text-slate-500">
          Apenas a <strong>caixa da frente</strong> de cada coluna pode ser puxada
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full max-w-md">
        {columns.map((column, colIdx) => {
          const topBox = column[0];
          const hasBoxes = column.length > 0;
          const topColor = topBox ? palette[topBox.colorId] : null;

          return (
            <div key={colIdx} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">
                Col {colIdx + 1} ({column.length})
              </span>

              {/* Caixa Frontal (Clicável se liberada) */}
              {hasBoxes && topColor ? (
                <button
                  type="button"
                  onClick={() => canPull && onPullBox(colIdx)}
                  disabled={!canPull}
                  className={`w-full group relative rounded-xl p-2.5 flex flex-col items-center justify-between border-2 transition-all duration-200 cursor-pointer ${
                    canPull
                      ? 'hover:-translate-y-1 hover:shadow-lg active:scale-95'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: topColor.hex,
                    borderColor: '#ffffff55',
                    color: topColor.textHex,
                  }}
                  title={`Puxar caixa ${topColor.letter} (${topBox.remaining} blocos) para o buffer`}
                >
                  <div className="w-full flex justify-between items-center text-[10px] font-black opacity-80">
                    <span>{topColor.letter}</span>
                    <ArrowUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <span className="text-lg font-black tracking-tight my-1">
                    {topBox.remaining}
                  </span>

                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/20">
                    Livre
                  </span>
                </button>
              ) : (
                <div className="w-full h-20 rounded-xl border border-dashed border-slate-800 bg-slate-950/20 flex items-center justify-center text-xs text-slate-600">
                  Vazio
                </div>
              )}

              {/* Caixas de trás empilhadas (Bloqueadas) */}
              <div className="w-full flex flex-col gap-1 mt-1">
                {column.slice(1, 4).map((box, depth) => {
                  const color = palette[box.colorId];
                  return (
                    <div
                      key={box.id}
                      className="w-full rounded-lg px-2 py-1 flex items-center justify-between text-[11px] font-bold opacity-40 border border-slate-800"
                      style={{
                        backgroundColor: color?.hex ? `${color.hex}33` : '#1e293b',
                        color: color?.hex || '#94a3b8',
                      }}
                    >
                      <span className="flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        {color?.letter || box.colorId}
                      </span>
                      <span>{box.totalCapacity}</span>
                    </div>
                  );
                })}
                {column.length > 4 && (
                  <span className="text-[9px] text-center text-slate-500">
                    +{column.length - 4} atrás
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
