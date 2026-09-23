import React from 'react';
import { LevelData, LevelProgress } from '../core/Types';
import { X, Trophy, Star, CheckCircle, RotateCcw } from 'lucide-react';

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  levels: LevelData[];
  currentLevelId: string;
  onSelectLevel: (level: LevelData) => void;
  allProgress: Record<string, LevelProgress>;
  onResetDefaults: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  levels,
  currentLevelId,
  onSelectLevel,
  allProgress,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Escolher Fase</h2>
              <p className="text-[10px] text-slate-400">
                Selecione uma fase para jogar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 custom-scrollbar">
          {levels.map((lvl, index) => {
            const isCurrent = lvl.id === currentLevelId;
            const progress = allProgress[lvl.id] || { completed: false, stars: 0 };

            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  onSelectLevel(lvl);
                  onClose();
                }}
                className={`w-full p-3 rounded-2xl flex items-center justify-between border-2 transition-all text-left ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                      progress.completed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-cyan-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {progress.completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      {lvl.name}
                      {lvl.metadata.isCustom && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Editada
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {lvl.metadata.totalBlocks} blocos
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-cyan-400/90 font-medium">
                        {lvl.metadata.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estrelas */}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= progress.stars
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={onResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Restaurar as 5 fases originais de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrões
          </button>

          <span className="text-[10px] text-slate-500">
            {levels.length} fases salvas
          </span>
        </div>
      </div>
    </div>
  );
};
