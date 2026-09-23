import React from 'react';
import { LevelData } from '../core/Types';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Layers,
  Sparkles,
  Wrench,
} from 'lucide-react';

interface GameHeaderProps {
  currentLevel: LevelData;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onRestart: () => void;
  onOpenLevelSelect: () => void;
  onOpenAdmin: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  currentLevel,
  isSoundEnabled,
  onToggleSound,
  onRestart,
  onOpenLevelSelect,
  onOpenAdmin,
}) => {
  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 sticky top-0 z-30 shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Level Info */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLevelSelect}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-all active:scale-95 group"
            title="Escolher Fase"
          >
            <Layers className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
            <div className="text-left">
              <h2 className="text-xs font-black text-white leading-none">
                {currentLevel.name}
              </h2>
              <span className="text-[10px] text-cyan-400 font-bold">
                {currentLevel.metadata.difficulty || 'Normal'}
              </span>
            </div>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Som */}
          <button
            type="button"
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-90"
            title={isSoundEnabled ? 'Mutar Som' : 'Ativar Som'}
          >
            {isSoundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Reiniciar */}
          <button
            type="button"
            onClick={onRestart}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-90"
            title="Reiniciar Nível"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Painel Admin / Editor */}
          <button
            type="button"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Abrir Painel Admin e Editor de Fases"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
};
