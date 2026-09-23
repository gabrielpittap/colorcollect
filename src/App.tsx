import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BoardGrid, LevelData } from './core/Types';
import { ContinuousGameEngine, GameStatus } from './core/ContinuousGameEngine';
import { StorageManager } from './core/StorageManager';
import { SoundManager } from './core/SoundManager';
import { GameCanvas } from './components/GameCanvas';
import { BufferView } from './components/BufferView';
import { SupplyView } from './components/SupplyView';
import { GameHeader } from './components/GameHeader';
import { LevelSelectModal } from './components/LevelSelectModal';
import { VictoryModal } from './components/VictoryModal';
import { DefeatModal } from './components/DefeatModal';
import { AdminPanelModal } from './components/AdminPanelModal';

export default function App() {
  // 1. Carrega Fases e Progresso do LocalStorage
  const [levels, setLevels] = useState<LevelData[]>(() => StorageManager.getLevels());
  const [currentLevelId, setCurrentLevelId] = useState<string>(() => StorageManager.getLastLevelId());
  const [allProgress, setAllProgress] = useState(() => StorageManager.getAllProgress());
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => SoundManager.isSoundEnabled());

  // Fase ativa atual
  const currentLevel = useMemo(() => {
    const found = levels.find((l) => l.id === currentLevelId);
    return found || levels[0];
  }, [levels, currentLevelId]);

  // 2. Instância do Motor de Simulação Contínua
  const [engine, setEngine] = useState<ContinuousGameEngine>(
    () => new ContinuousGameEngine(currentLevel)
  );

  const [grid, setGrid] = useState<BoardGrid>(engine.grid);
  const [bufferSlots, setBufferSlots] = useState(engine.bufferSlots);
  const [supplyColumns, setSupplyColumns] = useState(engine.supplyColumns);
  const [gameStatus, setGameStatus] = useState<GameStatus>(engine.status);

  // 3. Controle dos Modais
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Inicializa o motor sempre que a fase atual mudar
  const initEngine = useCallback((lvl: LevelData) => {
    const newEngine = new ContinuousGameEngine(lvl, {
      onGridChanged: (newGrid) => setGrid([...newGrid.map((r) => [...r])]),
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
    });

    setEngine(newEngine);
    setGrid(newEngine.grid);
    setBufferSlots(newEngine.bufferSlots);
    setSupplyColumns(newEngine.supplyColumns);
    setGameStatus(newEngine.status);
    StorageManager.saveLastLevelId(lvl.id);
  }, []);

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

  // Ação: Alternar som
  const handleToggleSound = () => {
    const next = SoundManager.toggleMute();
    setIsSoundEnabled(next);
  };

  const canPull =
    gameStatus === 'PLAYING' && bufferSlots.some((s) => s.box === null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Barra de Topo do Jogo */}
      <GameHeader
        currentLevel={currentLevel}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={handleToggleSound}
        onRestart={handleRestart}
        onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Conteúdo Principal do Jogo (Layout Arcade Mobile-First Centralizado) */}
      <main className="flex-1 w-full max-w-xl mx-auto px-3 sm:px-4 py-3 flex flex-col items-center justify-between gap-3">
        {/* 1. Canvas do Jogo 60 FPS (Robôs + Matriz 3D + Partículas) */}
        <div className="w-full flex-1 flex flex-col justify-center min-h-[360px]">
          <GameCanvas
            engine={engine}
            grid={grid}
            palette={currentLevel.palette}
          />
        </div>

        {/* 2. As 5 Docas da Fila de Espera */}
        <div className="w-full">
          <BufferView
            slots={bufferSlots}
            palette={currentLevel.palette}
            isDeadlocked={gameStatus === 'LOST'}
            robots={engine.robots}
          />
        </div>

        {/* 3. Depósito de Suprimentos (Deck de Caixas Táteis) */}
        <div className="w-full pb-2">
          <SupplyView
            columns={supplyColumns}
            palette={currentLevel.palette}
            onPullBox={handlePullBox}
            canPull={canPull}
          />
        </div>
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
      />
    </div>
  );
}
