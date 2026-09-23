import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BoardGrid, LevelData, GlobalTuningSettings } from './core/Types';
import { ContinuousGameEngine, GameStatus } from './core/ContinuousGameEngine';
import { StorageManager } from './core/StorageManager';
import { SoundManager } from './core/SoundManager';
import { GameCanvas } from './components/GameCanvas';
import { SupplyView } from './components/SupplyView';
import { GameHeader } from './components/GameHeader';
import { LevelSelectModal } from './components/LevelSelectModal';
import { VictoryModal } from './components/VictoryModal';
import { DefeatModal } from './components/DefeatModal';
import { AdminPanelModal } from './components/AdminPanelModal';

export default function App() {
  // 1. Carrega Fases, Progresso e Tuning do LocalStorage
  const [levels, setLevels] = useState<LevelData[]>(() => StorageManager.getLevels());
  const [currentLevelId, setCurrentLevelId] = useState<string>(() => StorageManager.getLastLevelId());
  const [allProgress, setAllProgress] = useState(() => StorageManager.getAllProgress());
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => SoundManager.isSoundEnabled());
  const [globalTuning, setGlobalTuning] = useState<GlobalTuningSettings>(() =>
    StorageManager.getTuningSettings()
  );

  // Fase ativa atual
  const currentLevel = useMemo(() => {
    const found = levels.find((l) => l.id === currentLevelId);
    return found || levels[0];
  }, [levels, currentLevelId]);

  // 2. Instância do Motor de Simulação Contínua
  const [engine, setEngine] = useState<ContinuousGameEngine>(
    () => new ContinuousGameEngine(currentLevel, undefined, globalTuning)
  );

  const [grid, setGrid] = useState<BoardGrid>(engine.grid);
  const [bufferSlots, setBufferSlots] = useState(engine.bufferSlots);
  const [supplyColumns, setSupplyColumns] = useState(engine.supplyColumns);
  const [gameStatus, setGameStatus] = useState<GameStatus>(engine.status);
  const [collectedBlocks, setCollectedBlocks] = useState<number>(0);
  const [totalBlocks, setTotalBlocks] = useState<number>(() => currentLevel.metadata.totalBlocks || 1);

  // 3. Controle dos Modais
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Inicializa o motor sempre que a fase atual mudar
  const initEngine = useCallback((lvl: LevelData) => {
    const newEngine = new ContinuousGameEngine(lvl, {
      onGridChanged: (newGrid) => {
        setGrid([...newGrid.map((r) => [...r])]);
        setCollectedBlocks(newEngine.totalCollectedBlocks);
      },
      onBufferChanged: (newSlots) => setBufferSlots([...newSlots]),
      onSupplyChanged: (newCols) => setSupplyColumns([...newCols]),
      onStatusChanged: (newStatus) => {
        setGameStatus(newStatus);
        if (newStatus === 'WON') {
          // Salva 3 estrelas e vitória no LocalStorage
          StorageManager.saveLevelProgress(lvl.id, {
            completed: true,
            stars: 3,
            bestTimeSeconds: Math.floor(newEngine.elapsedSeconds),
          });
          setAllProgress(StorageManager.getAllProgress());
        }
      },
    }, globalTuning);

    setEngine(newEngine);
    setGrid(newEngine.grid);
    setBufferSlots(newEngine.bufferSlots);
    setSupplyColumns(newEngine.supplyColumns);
    setGameStatus(newEngine.status);
    setCollectedBlocks(0);
    setTotalBlocks(newEngine.totalInitialBlocks);
    StorageManager.saveLastLevelId(lvl.id);
  }, [globalTuning]);

  useEffect(() => {
    initEngine(currentLevel);
  }, [currentLevel, initEngine]);

  // Ação: Puxar caixa do supply deck
  const handlePullBox = (colIdx: number) => {
    engine.pullBox(colIdx);
    setGrid([...engine.grid]);
    setBufferSlots([...engine.bufferSlots]);
    setSupplyColumns([...engine.supplyColumns]);
  };

  // Ação: Reiniciar a fase atual
  const handleRestart = () => {
    engine.restart();
    setGrid([...engine.grid]);
    setBufferSlots([...engine.bufferSlots]);
    setSupplyColumns([...engine.supplyColumns]);
    setGameStatus(engine.status);
    setCollectedBlocks(0);
  };

  // Ação: Próxima Fase
  const handleNextLevel = () => {
    const currentIndex = levels.findIndex((l) => l.id === currentLevel.id);
    if (currentIndex >= 0 && currentIndex < levels.length - 1) {
      const nextLvl = levels[currentIndex + 1];
      setCurrentLevelId(nextLvl.id);
    }
  };

  const hasNextLevel = useMemo(() => {
    const currentIndex = levels.findIndex((l) => l.id === currentLevel.id);
    return currentIndex >= 0 && currentIndex < levels.length - 1;
  }, [levels, currentLevel]);

  // Ação: Salvar fase customizada do Admin
  const handleSaveLevelFromAdmin = (updatedLevel: LevelData) => {
    StorageManager.saveLevel(updatedLevel);
    const updatedList = StorageManager.getLevels();
    setLevels(updatedList);
    if (updatedLevel.id === currentLevel.id) {
      initEngine(updatedLevel);
    }
  };

  // Ação: Jogar fase diretamente do Admin
  const handlePlayLevelFromAdmin = (targetLevel: LevelData) => {
    setCurrentLevelId(targetLevel.id);
    initEngine(targetLevel);
  };

  // Ação: Restaurar fases originais de fábrica
  const handleResetToDefaults = () => {
    const defaults = StorageManager.resetToDefaults();
    setLevels(defaults);
    setCurrentLevelId(defaults[0].id);
    initEngine(defaults[0]);
  };

  // Ação: Salvar ajustes globais de simulação
  const handleSaveGlobalTuning = (tuning: GlobalTuningSettings) => {
    StorageManager.saveTuningSettings(tuning);
    setGlobalTuning(tuning);
    engine.updateTuning(tuning);
  };

  // Ação: Restaurar ajustes globais para padrões
  const handleResetGlobalTuning = () => {
    const defaults = StorageManager.resetTuningSettings();
    setGlobalTuning(defaults);
    engine.updateTuning(defaults);
  };

  // Ação: Alternar som
  const handleToggleSound = () => {
    const next = SoundManager.toggleMute();
    setIsSoundEnabled(next);
  };

  const canPull =
    gameStatus === 'PLAYING' && bufferSlots.some((s) => s.box === null);

  return (
    <div className="h-screen h-[100dvh] w-full max-w-[100vw] bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased overflow-hidden">
      {/* Barra de Topo do Jogo */}
      <GameHeader
        currentLevel={currentLevel}
        collectedBlocks={collectedBlocks}
        totalBlocks={totalBlocks}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
        onRestart={handleRestart}
        onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Conteúdo Principal do Jogo:
          - Desktop (md+): Depósito compacto à esquerda e campo/robôs maximizado à direita.
          - Celular: Campo/robôs maximizado em cima (flex-1) e depósito de caixas embaixo (shrink-0).
          - Zero desperdício de espaço e sem rolagem indesejada (100dvh).
      */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto p-1.5 sm:p-2 md:p-4 lg:p-6 flex flex-col md:flex-row items-stretch justify-center gap-2 sm:gap-3 md:gap-6 overflow-hidden">
        {/* Painel Esquerdo (Desktop) / Painel Inferior (Mobile): Depósito de Caixas */}
        <section className="order-2 md:order-1 w-full md:w-80 lg:w-96 flex flex-col justify-center items-center shrink-0 min-h-0">
          <div className="w-full max-w-md flex flex-col">
            <SupplyView
              columns={supplyColumns}
              palette={currentLevel.palette}
              onPullBox={handlePullBox}
              canPull={canPull}
            />
          </div>
        </section>

        {/* Painel Direito (Desktop) / Painel Superior (Mobile): Campo e Robôs com Doca Integrada */}
        <section className="order-1 md:order-2 w-full md:flex-1 flex-1 min-h-0 flex flex-col justify-center items-center">
          <GameCanvas
            engine={engine}
            grid={grid}
            palette={currentLevel.palette}
          />
        </section>
      </main>

      {/* Modal de Escolha de Fase */}
      <LevelSelectModal
        isOpen={isLevelSelectOpen}
        onClose={() => setIsLevelSelectOpen(false)}
        levels={levels}
        currentLevelId={currentLevel.id}
        onSelectLevel={(lvl) => setCurrentLevelId(lvl.id)}
        allProgress={allProgress}
        onResetDefaults={handleResetToDefaults}
      />

      {/* Modal de Vitória */}
      <VictoryModal
        isOpen={gameStatus === 'WON'}
        onRestart={handleRestart}
        onNextLevel={handleNextLevel}
        hasNextLevel={hasNextLevel}
        timeSeconds={engine.elapsedSeconds}
        totalBlocks={engine.totalInitialBlocks}
      />

      {/* Modal de Derrota / Deadlock */}
      <DefeatModal
        isOpen={gameStatus === 'LOST'}
        onRestart={handleRestart}
      />

      {/* Painel Admin & Editor de Dificuldade */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentLevel={currentLevel}
        allLevels={levels}
        onSaveLevel={handleSaveLevelFromAdmin}
        onPlayLevel={handlePlayLevelFromAdmin}
        onResetToDefaults={handleResetToDefaults}
        globalTuning={globalTuning}
        onSaveGlobalTuning={handleSaveGlobalTuning}
        onResetGlobalTuning={handleResetGlobalTuning}
      />
    </div>
  );
}
