import React from 'react';
import { LevelData } from '../core/Types';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Layers,
  Wrench,
  Star,
  Pause,
} from 'lucide-react';

interface GameHeaderProps {
  currentLevel: LevelData;
  collectedBlocks?: number;
  totalBlocks?: number;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onRestart: () => void;
  onOpenLevelSelect: () => void;
  onOpenAdmin: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  currentLevel,
  collectedBlocks = 0,
  totalBlocks = 1,
  isSoundEnabled,
  onToggleSound,
  onRestart,
  onOpenLevelSelect,
  onOpenAdmin,
}) => {
  // Separa "Nível X" e o Nome da Fase (ex: "Estrela Guia")
  const parts = currentLevel.name.split(':');
  const levelTitle = parts[0]?.trim() || 'Fase';
  const levelSubtitle = parts.slice(1).join(':').trim() || currentLevel.metadata.description || '';
  const difficulty = currentLevel.metadata.difficulty || 'Normal';

  // Cálculo do progresso e estrelas
  const progressRatio = Math.min(1, Math.max(0, totalBlocks > 0 ? collectedBlocks / totalBlocks : 0));
  const progressPercent = Math.round(progressRatio * 100);

  const star1 = progressRatio >= 0.33;
  const star2 = progressRatio >= 0.66;
  const star3 = progressRatio >= 0.999;

  return (
    <header className="w-full shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 px-2.5 sm:px-4 py-2 sticky top-0 z-30 shadow-lg">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Cartão de Nível (Esquerda) - Estilo da Referência */}
        <button
          type="button"
          onClick={onOpenLevelSelect}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 shadow-md transition-all active:scale-95 group text-left min-w-0"
          title="Ver Lista de Níveis"
        >
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400 group-hover:scale-105 transition-transform shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs sm:text-sm font-black text-white tracking-wide">
                {levelTitle}
              </span>
              {levelSubtitle && (
                <span className="text-[11px] sm:text-xs font-bold text-cyan-400 truncate hidden xs:inline">
                  {levelSubtitle}
                </span>
              )}
            </div>
            {levelSubtitle && (
              <span className="text-[10px] font-bold text-cyan-400 truncate xs:hidden">
                {levelSubtitle}
              </span>
            )}
            <div className="mt-0.5">
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 inline-block leading-tight">
                {difficulty}
              </span>
            </div>
          </div>
        </button>

        {/* Barra de Progresso Central & 3 Estrelas - Estilo da Referência */}
        <div className="flex-1 max-w-xs flex flex-col items-center justify-center gap-1 px-1">
          {/* As 3 Estrelas */}
          <div className="flex items-center justify-center gap-2">
            <Star
              className={`w-4 h-4 transition-all duration-300 ${
                star1
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] scale-110'
                  : 'text-slate-600 fill-slate-800/80'
              }`}
            />
            <Star
              className={`w-4.5 h-4.5 transition-all duration-300 -translate-y-0.5 ${
                star2
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] scale-110'
                  : 'text-slate-600 fill-slate-800/80'
              }`}
            />
            <Star
              className={`w-4 h-4 transition-all duration-300 ${
                star3
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] scale-110'
                  : 'text-slate-600 fill-slate-800/80'
              }`}
            />
          </div>

          {/* Cápsula da Barra de Progresso */}
          <div className="w-full h-2.5 sm:h-3 rounded-full bg-slate-900 border border-slate-700/80 p-0.5 shadow-inner overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Botões de Ação Táteis Redondos (Direita) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Som */}
          <button
            type="button"
            onClick={onToggleSound}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center transition-all active:scale-90 shadow-md"
            title={isSoundEnabled ? 'Mutar Som' : 'Ativar Som'}
          >
            {isSoundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Pausar / Menu */}
          <button
            type="button"
            onClick={onOpenLevelSelect}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 flex items-center justify-center transition-all active:scale-90 shadow-md"
            title="Pausar / Fases"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>

          {/* Reiniciar Nível */}
          <button
            type="button"
            onClick={onRestart}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 flex items-center justify-center transition-all active:scale-90 shadow-md"
            title="Reiniciar Nível"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Admin */}
          <button
            type="button"
            onClick={onOpenAdmin}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 flex items-center justify-center transition-all active:scale-90 shadow-md"
            title="Painel Admin"
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
