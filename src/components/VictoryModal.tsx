import React from 'react';
import { Trophy, Star, ArrowRight, RotateCcw } from 'lucide-react';

interface VictoryModalProps {
  isOpen: boolean;
  onRestart: () => void;
  onNextLevel?: () => void;
  hasNextLevel: boolean;
  timeSeconds: number;
  totalBlocks: number;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isOpen,
  onRestart,
  onNextLevel,
  hasNextLevel,
  timeSeconds,
  totalBlocks,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-3xl w-full max-w-sm p-6 shadow-2xl shadow-emerald-500/20 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Ícone de Troféu com Brilho */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/30 mb-4 animate-bounce">
          <Trophy className="w-8 h-8 fill-current" />
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          FASE CONCLUÍDA!
        </h2>
        <p className="text-xs text-emerald-400 font-medium mt-1">
          Todos os blocos foram organizados com sucesso!
        </p>

        {/* 3 Estrelas */}
        <div className="flex items-center gap-1.5 my-4">
          {[1, 2, 3].map((star) => (
            <Star
              key={star}
              className="w-7 h-7 text-amber-400 fill-amber-400 drop-shadow-md animate-in zoom-in duration-300"
              style={{ animationDelay: `${star * 150}ms` }}
            />
          ))}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-2 w-full p-3 rounded-2xl bg-slate-950/60 border border-slate-800 my-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block">Tempo</span>
            <span className="font-mono font-black text-slate-200">
              {Math.floor(timeSeconds)}s
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Blocos</span>
            <span className="font-mono font-black text-emerald-400">
              {totalBlocks}
            </span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-2 w-full mt-4">
          {hasNextLevel && onNextLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="w-full py-3 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <span>Próxima Fase</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Jogar Novamente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
