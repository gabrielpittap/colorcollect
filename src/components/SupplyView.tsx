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
    <div className="flex flex-col items-center w-full px-2.5 sm:px-3 py-2 sm:py-2.5 bg-slate-900/95 rounded-2xl border border-slate-800/90 shadow-2xl backdrop-blur-md">
      {/* Cabeçalho Industrial do Alimentador */}
      <div className="flex items-center justify-between w-full mb-1.5 sm:mb-2 text-xs font-semibold text-slate-300">
        <span className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Package className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-200 uppercase tracking-wide">
            Alimentador de Caixas
          </span>
        </span>
        <span
          className={`text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
            canPull
              ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/60'
              : 'text-amber-400 bg-amber-950/60 border border-amber-800/60 font-bold'
          }`}
        >
          {canPull ? 'Toque na caixa pronta' : 'Docas ocupadas'}
        </span>
      </div>

      {/* As 4 Colunas de Suprimento */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full max-w-lg">
        {columns.map((column, colIdx) => {
          const topBox = column[0];
          const hasBoxes = column.length > 0;
          const topColor = topBox ? palette[topBox.colorId] : null;
          const extraCount = Math.max(0, column.length - 4);

          return (
            <div key={colIdx} className="flex flex-col items-center gap-1 w-full min-w-0">
              {/* Caixa Frontal Liberada / Pronta para Despacho */}
              {hasBoxes && topColor ? (
                <button
                  type="button"
                  onClick={() => canPull && onPullBox(colIdx)}
                  disabled={!canPull}
                  className={`w-full h-[56px] sm:h-[64px] group relative rounded-xl p-1.5 flex flex-col items-center justify-between border-2 transition-all duration-150 select-none shadow-lg overflow-hidden ${
                    canPull
                      ? 'hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95 cursor-pointer ring-1 ring-white/30'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{
                    backgroundColor: topColor.hex,
                    borderColor: 'rgba(255, 255, 255, 0.55)',
                    color: topColor.textHex,
                    boxShadow: canPull
                      ? `0 6px 16px ${topColor.hex}40, inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.3)`
                      : undefined,
                  }}
                  title={`Puxar caixa (${topBox.remaining} blocos)`}
                >
                  {/* Topo do botão: Mini caixa 3D isométrica + seta */}
                  <div className="w-full flex justify-between items-center opacity-90">
                    <svg className="w-3.5 h-3.5 drop-shadow-sm" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L21 7.5L12 13L3 7.5L12 2Z" fill="white" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M3 7.5L12 13V22L3 16.5V7.5Z" fill="black" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M12 13L21 7.5V16.5L12 22V13Z" fill="black" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M10.5 3L13.5 4.8V13.5L10.5 11.8V3Z" fill="#d97706" fillOpacity="0.8" />
                    </svg>
                    <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform drop-shadow-xs" />
                  </div>

                  {/* Número Central em Destaque */}
                  <span className="text-lg sm:text-2xl font-black tracking-tight leading-none drop-shadow-md">
                    {topBox.remaining}
                  </span>

                  {/* Tag "Pronta" */}
                  <span className="text-[7px] sm:text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-black/30 leading-none backdrop-blur-xs">
                    Pronta
                  </span>
                </button>
              ) : (
                <div className="w-full h-[56px] sm:h-[64px] rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-[10px] text-slate-600 font-bold select-none gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-800" />
                  <span>Vazio</span>
                </div>
              )}

              {/* Próximas caixas na fila com suas CORES visíveis (Sem Letras e Sem Códigos) */}
              <div className="w-full flex flex-col gap-1">
                {[0, 1, 2].map((queueIdx) => {
                  const box = column[queueIdx + 1];
                  if (box) {
                    const color = palette[box.colorId];
                    const hex = color?.hex || '#64748b';
                    const textHex = color?.textHex || '#ffffff';

                    return (
                      <div
                        key={box.id}
                        className="w-full h-5 sm:h-5.5 rounded-lg px-1.5 flex items-center justify-between text-[9px] sm:text-[10px] font-bold border transition-colors shadow-xs"
                        style={{
                          backgroundColor: hex,
                          borderColor: 'rgba(255, 255, 255, 0.45)',
                          color: textHex,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                        }}
                        title={`Próxima (${box.totalCapacity} blocos)`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          <Lock className="w-2.5 h-2.5 opacity-80 shrink-0" />
                          <svg className="w-2.5 h-2.5 opacity-80 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L21 7.5L12 13L3 7.5L12 2Z" fill="white" fillOpacity="0.5" />
                            <path d="M3 7.5L12 13V22L3 16.5V7.5Z" fill="black" fillOpacity="0.3" />
                            <path d="M12 13L21 7.5V16.5L12 22V13Z" fill="black" fillOpacity="0.15" />
                          </svg>
                        </span>
                        <span className="font-mono text-[9px] sm:text-[10px] font-black leading-none drop-shadow-xs">
                          {box.totalCapacity}
                        </span>
                      </div>
                    );
                  }

                  // Placeholder vazio para manter as 4 colunas perfeitamente alinhadas
                  return (
                    <div
                      key={`empty-slot-${queueIdx}`}
                      className="w-full h-5 sm:h-5.5 rounded-lg border border-dashed border-slate-800/60 bg-slate-950/20 flex items-center justify-center text-[10px] text-slate-700 select-none font-bold"
                    >
                      ·
                    </div>
                  );
                })}
              </div>

              {/* Indicador de excedente na fila (+N na fila) */}
              <div className="w-full h-3.5 flex items-center justify-center">
                {extraCount > 0 ? (
                  <span className="text-[8px] sm:text-[9px] text-cyan-400 font-extrabold truncate">
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
