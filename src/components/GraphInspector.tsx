import React from 'react';
import { ColorDef, DependencyEdge, LevelData, SolverResult } from '../core/Types';
import { ColorLayerAnalysis } from '../core/DependencyGraph';
import {
  BrainCircuit,
  GitBranch,
  Play,
  Copy,
  Check,
  ShieldCheck,
  AlertOctagon,
  Clock,
} from 'lucide-react';

interface GraphInspectorProps {
  level: LevelData;
  solverResult: SolverResult | null;
  layerAnalysis: ColorLayerAnalysis[];
  dependencyEdges: DependencyEdge[];
  palette: Record<string, ColorDef>;
  onPlayNextStep: () => void;
  canPlayStep: boolean;
}

export const GraphInspector: React.FC<GraphInspectorProps> = ({
  level,
  solverResult,
  layerAnalysis,
  dependencyEdges,
  palette,
  onPlayNextStep,
  canPlayStep,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(level, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyBadge = (diff?: string) => {
    switch (diff) {
      case 'Muito Fácil':
      case 'Fácil':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Médio':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Difícil':
      case 'Extremo':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl">
      {/* Header com Status do Solver */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-slate-100 text-sm">
            Diagnóstico Matemático do Solver
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {solverResult?.isSolvable ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Solucionável
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertOctagon className="w-3.5 h-3.5" />
              Sem Solução (Impossível)
            </span>
          )}

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${getDifficultyBadge(
              solverResult?.difficulty
            )}`}
          >
            {solverResult?.difficulty || 'Calculando...'}
          </span>
        </div>
      </div>

      {/* Métricas do Solver */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium block">
            Caminhos de Vitória
          </span>
          <span className="text-xl font-black text-cyan-400 font-mono">
            {solverResult?.totalSolutions ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">
            ramificações válidas
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium block">
            Deadlocks Evitáveis
          </span>
          <span className="text-xl font-black text-amber-400 font-mono">
            {solverResult?.deadlockStatesCount ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">becos sem saída</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium block">
            Estados Avaliados
          </span>
          <span className="text-xl font-black text-indigo-400 font-mono">
            {solverResult?.statesEvaluated ?? 0}
          </span>
          <span className="text-[10px] text-slate-500 block">nós de busca</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium block">
            Tempo de Cálculo
          </span>
          <span className="text-xl font-black text-emerald-400 font-mono flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {solverResult?.executionTimeMs.toFixed(1) ?? 0}ms
          </span>
          <span className="text-[10px] text-slate-500 block">em tempo real</span>
        </div>
      </div>

      {/* Grafo de Camadas & Dependências */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Distribuição por Camadas */}
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            Topologia de Camadas (Casca vs Miolo)
          </h4>
          <div className="flex flex-col gap-1.5">
            {layerAnalysis.map((item) => {
              const color = palette[item.colorId];
              const isOuter = item.minLayer === 0;

              return (
                <div
                  key={item.colorId}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-900 border border-slate-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md shadow-sm border border-white/20"
                      style={{
                        backgroundColor: color?.hex,
                      }}
                    />
                    <span className="font-medium text-slate-300">
                      {color?.name || 'Cor Industrial'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">
                      {item.totalCount} blocos
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        isOuter
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-indigo-500/20 text-indigo-300'
                      }`}
                    >
                      {isOuter
                        ? 'Camada 0 (Casca Externa)'
                        : `Camada ${item.minLayer} (Interna)`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bloqueios Diretos (Arestas DAG) */}
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            Relações de Bloqueio Direto (Origem bloqueia Destino)
          </h4>
          {dependencyEdges.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-2">
              Todas as cores estão livres na borda.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {dependencyEdges.map((edge, idx) => {
                const cFrom = palette[edge.fromColor];
                const cTo = palette[edge.toColor];
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-800 text-slate-300"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/20 inline-block"
                      style={{
                        backgroundColor: cFrom?.hex,
                      }}
                    />
                    <span className="text-slate-500">→</span>
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-white/20 inline-block"
                      style={{
                        backgroundColor: cTo?.hex,
                      }}
                    />
                    <span className="text-[10px] text-slate-500">
                      ({edge.blockingCount})
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ações: Passo Ótimo da IA e Exportar JSON */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPlayNextStep}
            disabled={!canPlayStep || !solverResult?.bestSolution?.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Executar Próximo Passo da IA
          </button>
          <span className="text-[11px] text-slate-500">
            {solverResult?.bestSolution
              ? `Solução ótima em ${solverResult.bestSolution.length} passos`
              : 'Sem solução'}
          </span>
        </div>

        <button
          type="button"
          onClick={copyJson}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'JSON Copiado!' : 'Copiar JSON da Fase'}
        </button>
      </div>
    </div>
  );
};
