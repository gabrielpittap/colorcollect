import React from 'react';
import { BufferSlot, ColorDef } from '../core/Types';
import { Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BufferViewProps {
  slots: BufferSlot[];
  palette: Record<string, ColorDef>;
  isDeadlocked: boolean;
}

export const BufferView: React.FC<BufferViewProps> = ({
  slots,
  palette,
  isDeadlocked,
}) => {
  return (
    <div className="flex flex-col items-center w-full p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between w-full mb-3 text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <Layers className="w-4 h-4 text-primary" />
          Fila de Espera (Buffer Limite: 5 Slots)
        </span>
        {isDeadlocked ? (
          <span className="flex items-center gap-1 text-rose-400 font-bold animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5" />
            BUFFER TRAVADO (DEADLOCK)!
          </span>
        ) : (
          <span className="text-slate-400">
            {slots.filter((s) => s.box === null).length} slots livres
          </span>
        )}
      </div>

      {/* 5 Slots Grid */}
      <div className="grid grid-cols-5 gap-2.5 w-full max-w-md">
        {slots.map((slot) => {
          const box = slot.box;
          const colorDef = box ? palette[box.colorId] : null;

          return (
            <div
              key={slot.index}
              className={`h-24 rounded-xl flex flex-col items-center justify-between p-2 transition-all duration-300 ${
                box
                  ? 'border-2 shadow-lg scale-100'
                  : 'border-2 border-dashed border-slate-800 bg-slate-950/40 text-slate-600'
              }`}
              style={{
                backgroundColor: box && colorDef ? `${colorDef.hex}22` : undefined,
                borderColor: box && colorDef ? colorDef.hex : undefined,
              }}
            >
              <div className="text-[10px] uppercase font-bold text-slate-400">
                Slot {slot.index + 1}
              </div>

              {box && colorDef ? (
                <>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shadow-md transition-transform"
                    style={{
                      backgroundColor: colorDef.hex,
                      color: colorDef.textHex,
                    }}
                  >
                    {colorDef.letter}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono font-black text-white px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700">
                      {box.remaining}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs font-medium">
                  Vazio
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
