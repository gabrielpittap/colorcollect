import React from 'react';
import { BufferSlot, ColorDef, MiniBot } from '../core/Types';
import { Bot, AlertTriangle } from 'lucide-react';

interface BufferViewProps {
  slots: BufferSlot[];
  palette: Record<string, ColorDef>;
  isDeadlocked: boolean;
  robots?: MiniBot[];
}

export const BufferView: React.FC<BufferViewProps> = ({
  slots,
  palette,
  isDeadlocked,
  robots = [],
}) => {
  const freeSlotsCount = slots.filter((s) => s.box === null).length;

  return (
    <div className="flex flex-col items-center w-full px-2.5 sm:px-3 py-1.5 sm:py-2.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Barra de Status da Fila */}
      <div className="flex items-center justify-between w-full mb-1 sm:mb-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-slate-200">
          <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
          <span className="text-[11px] sm:text-xs">Docas de Espera</span>
          <span className="text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {freeSlotsCount} / {slots.length} livres
          </span>
        </span>

        {isDeadlocked && (
          <span className="flex items-center gap-1 text-rose-400 font-extrabold animate-pulse text-[10px] sm:text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            DOCAS TRAVADAS!
          </span>
        )}
      </div>

      {/* Grid das 5 Docas */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full max-w-lg">
        {slots.map((slot) => {
          const box = slot.box;
          const colorDef = box ? palette[box.colorId] : null;
          const bot = robots.find((r) => r.slotIndex === slot.index);

          return (
            <div
              key={slot.index}
              className={`relative h-16 sm:h-20 rounded-xl flex flex-col items-center justify-between p-1 sm:p-1.5 transition-all duration-200 select-none ${
                box && colorDef
                  ? 'border-2 shadow-lg scale-[1.02]'
                  : 'border-2 border-dashed border-slate-800/80 bg-slate-950/40 text-slate-600'
              }`}
              style={{
                backgroundColor: box && colorDef ? `${colorDef.hex}18` : undefined,
                borderColor: box && colorDef ? colorDef.hex : undefined,
                boxShadow: box && colorDef ? `0 4px 14px ${colorDef.hex}25` : undefined,
              }}
            >
              {/* Número do Slot */}
              <div className="w-full flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase text-slate-400">
                <span>D{slot.index + 1}</span>
                {bot && bot.cargoColor && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                )}
              </div>

              {box && colorDef ? (
                <>
                  {/* Ícone / Mini Cubo da Cor */}
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-black text-[11px] sm:text-xs shadow-md border border-white/40"
                    style={{
                      backgroundColor: colorDef.hex,
                      color: colorDef.textHex,
                    }}
                  >
                    {colorDef.letter}
                  </div>

                  {/* Contador Restante */}
                  <div className="w-full text-center">
                    <span className="text-[10px] sm:text-[11px] font-mono font-black text-white px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-700/80 shadow-inner">
                      {box.remaining}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-slate-600">
                  Livre
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
