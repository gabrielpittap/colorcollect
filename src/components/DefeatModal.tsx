import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface DefeatModalProps {
  isOpen: boolean;
  onRestart: () => void;
}

export const DefeatModal: React.FC<DefeatModalProps> = ({
  isOpen,
  onRestart,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl w-full max-w-sm p-6 shadow-2xl shadow-rose-500/20 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-3">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-black text-rose-300 tracking-tight">
          DOCAS BLOQUEADAS!
        </h2>
        <p className="text-xs text-rose-400/80 mt-1 max-w-[260px]">
          As 5 docas foram preenchidas com cores que não possuem caminho livre na borda da matriz.
        </p>

        <div className="w-full p-3 rounded-xl bg-slate-950/60 border border-slate-800 my-4 text-[11px] text-slate-400 text-left">
          <span className="font-bold text-slate-300 block mb-1">💡 Dica Tática:</span>
          Tente sempre manter pelo menos 1 ou 2 docas livres para permitir que a próxima camada se abra!
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    </div>
  );
};
