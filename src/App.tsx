import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BoardGrid, ColorDef, LevelData, SolverResult } from './core/Types';
import { DEFAULT_PALETTE } from './core/Colors';
import { LevelGenerator } from './core/LevelGenerator';
import { LevelSolver } from './core/LevelSolver';
import { DependencyGraph, ColorLayerAnalysis } from './core/DependencyGraph';
import { GameEngine, GameStatus } from './core/GameEngine';
import {
  createConcentricLevel,
  createMiniBotLevel,
  createHeartLevel,
} from './core/PresetLevels';
import { BoardView } from './components/BoardView';
import { BufferView } from './components/BufferView';
import { SupplyView } from './components/SupplyView';
import { GraphInspector } from './components/GraphInspector';
import { PhotoPixelizerModal } from './components/PhotoPixelizerModal';
import {
  RotateCcw,
  Sparkles,
  Camera,
  Trophy,
  AlertTriangle,
  Cpu,
  Layers,
  CheckCircle,
} from 'lucide-react';

export default function App() {
  // Estado do Nível Atual
  const [level, setLevel] = useState<LevelData>(() => {
    const initialGrid = createConcentricLevel();
    const { level } = LevelGenerator.generateLevel(initialGrid, {
      name: 'Alvo Concêntrico (Teste de Camadas)',
    });
    return level;
  });

  const [palette, setPalette] = useState<Record<string, ColorDef>>(DEFAULT_PALETTE);

  // Instância do Motor de Execução
  const [engine, setEngine] = useState<GameEngine>(() => new GameEngine(level));
  const [grid, setGrid] = useState<BoardGrid>(engine.grid);
  const [bufferSlots, setBufferSlots] = useState(engine.bufferSlots);
  const [supplyColumns, setSupplyColumns] = useState(engine.supplyColumns);
  const [gameStatus, setGameStatus] = useState<GameStatus>(engine.status);

  // Análise Matemática e Solver
  const [solverResult, setSolverResult] = useState<SolverResult | null>(null);
  const [layerAnalysis, setLayerAnalysis] = useState<ColorLayerAnalysis[]>([]);
  const [isPixelizerOpen, setIsPixelizerOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('concentric');

  // Inicializa o motor sempre que o nível mudar
  const initEngineForLevel = useCallback((lvl: LevelData, pal = DEFAULT_PALETTE) => {
    const newEngine = new GameEngine(lvl, {
      onGridChanged: (newGrid) => setGrid(newGrid),
      onBufferChanged: (newSlots) => setBufferSlots(newSlots),
      onSupplyChanged: (newCols) => setSupplyColumns(newCols),
      onStatusChanged: (newStatus) => setGameStatus(newStatus),
    });

    setEngine(newEngine);
    setGrid(newEngine.grid);
    setBufferSlots(newEngine.bufferSlots);
    setSupplyColumns(newEngine.supplyColumns);
    setGameStatus(newEngine.status);

    // Executa análise matemática do Solver
    const sol = LevelSolver.solve(lvl.initialGrid, lvl.initialSupply, lvl.bufferSize);
    setSolverResult(sol);

    // Analisa camadas topológicas
    const layers = DependencyGraph.analyzeColorLayers(lvl.initialGrid);
    setLayerAnalysis(layers);
  }, []);

  useEffect(() => {
    initEngineForLevel(level, palette);
  }, [level, palette, initEngineForLevel]);

  // Carrega uma fase pré-definida
  const loadPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    let newGrid: BoardGrid;
    let name = 'Fase';

    if (presetKey === 'concentric') {
      newGrid = createConcentricLevel();
      name = 'Alvo Concêntrico (Casca A -> Miolo C)';
    } else if (presetKey === 'bot') {
      newGrid = createMiniBotLevel();
      name = 'Mini Robô Pixelizado';
    } else {
      newGrid = createHeartLevel();
      name = 'Coração em Cores';
    }

    setPalette(DEFAULT_PALETTE);
    const { level: newLevel } = LevelGenerator.generateLevel(newGrid, { name });
    setLevel(newLevel);
  };

  // Carrega nível a partir de uma foto
  const handleApplyPhotoLevel = (
    newGrid: BoardGrid,
    customPalette: Record<string, ColorDef>,
    name: string
  ) => {
    setActivePreset('photo');
    setPalette(customPalette);
    const { level: newLevel } = LevelGenerator.generateLevel(newGrid, { name });
    setLevel(newLevel);
  };

  // Puxar caixa
  const handlePullBox = (colIdx: number) => {
    engine.pullBox(colIdx);
    setGrid([...engine.grid]);
    setBufferSlots([...engine.bufferSlots]);
    setSupplyColumns([...engine.supplyColumns]);
    setGameStatus(engine.status);
  };

  // Reiniciar
  const handleRestart = () => {
    engine.restart();
    setGrid([...engine.grid]);
    setBufferSlots([...engine.bufferSlots]);
    setSupplyColumns([...engine.supplyColumns]);
    setGameStatus(engine.status);
  };

  // Executar próximo passo da IA (Solver)
  const handlePlayAiStep = () => {
    if (!solverResult?.bestSolution || solverResult.bestSolution.length === 0) return;

    // Acha a primeira coluna com a caixa esperada
    const nextMove = solverResult.bestSolution[0];
    handlePullBox(nextMove.column);
  };

  const dependencyEdges = useMemo(() => {
    return DependencyGraph.buildDependencyEdges(level.initialGrid);
  }, [level]);

  const canPull =
    gameStatus === 'PLAYING' && bufferSlots.some((s) => s.box === null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20 font-black">
              <Cpu className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                ColorCollect
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Engine & Lab v1.0
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {level.name}
              </p>
            </div>
          </div>

          {/* Preset Buttons & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => loadPreset('concentric')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activePreset === 'concentric'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Alvo (Camadas)
              </button>
              <button
                type="button"
                onClick={() => loadPreset('bot')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activePreset === 'bot'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mini Robô
              </button>
              <button
                type="button"
                onClick={() => loadPreset('heart')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activePreset === 'heart'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Coração
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPixelizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all active:scale-95"
            >
              <Camera className="w-3.5 h-3.5" />
              Foto → Fase
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
              title="Reiniciar esta mesma fase"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Board Canvas (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <BoardView grid={grid} palette={palette} />

          {/* Victory / Defeat Overlays */}
          {gameStatus === 'WON' && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/80 shadow-2xl flex items-center justify-between animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <Trophy className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-emerald-300">
                    VITÓRIA! TABULEIRO LIMPO!
                  </h3>
                  <p className="text-xs text-emerald-400/80">
                    Todos os blocos coletados com sucesso.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md active:scale-95"
              >
                Jogar Novamente
              </button>
            </div>
          )}

          {gameStatus === 'LOST' && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500/80 shadow-2xl flex items-center justify-between animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500 text-slate-950 flex items-center justify-center font-black">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-rose-300">
                    GAME OVER (DEADLOCK)!
                  </h3>
                  <p className="text-xs text-rose-400/80">
                    5 slots ocupados sem blocos correspondentes na borda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-all shadow-md active:scale-95"
              >
                Tentar de Novo
              </button>
            </div>
          )}
        </div>

        {/* Center/Right Column: Buffer, Supply & Math Analysis (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Buffer de 5 Slots */}
          <BufferView
            slots={bufferSlots}
            palette={palette}
            isDeadlocked={gameStatus === 'LOST'}
          />

          {/* Pilha Inferior de Suprimentos */}
          <SupplyView
            columns={supplyColumns}
            palette={palette}
            onPullBox={handlePullBox}
            canPull={canPull}
          />

          {/* Painel do Solver e Grafo de Dependência */}
          <GraphInspector
            level={level}
            solverResult={solverResult}
            layerAnalysis={layerAnalysis}
            dependencyEdges={dependencyEdges}
            palette={palette}
            onPlayNextStep={handlePlayAiStep}
            canPlayStep={canPull}
          />
        </div>
      </main>

      {/* Modal do Pixelizador de Fotos */}
      <PhotoPixelizerModal
        isOpen={isPixelizerOpen}
        onClose={() => setIsPixelizerOpen(false)}
        onApplyLevel={handleApplyPhotoLevel}
      />
    </div>
  );
}
