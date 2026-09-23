import React, { useState, useEffect } from 'react';
import { BoardGrid, ColorDef, LevelData, GlobalTuningSettings, DEFAULT_GLOBAL_TUNING } from '../core/Types';
import { DEFAULT_PALETTE, COLOR_KEYS, getColorDef } from '../core/Colors';
import { EdgeDetector } from '../core/EdgeDetector';
import {
  X,
  Save,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Palette,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Grid,
  Sliders,
  Gauge,
  Zap,
  Timer,
  Truck,
  Layers,
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: LevelData;
  allLevels: LevelData[];
  onSaveLevel: (level: LevelData) => void;
  onPlayLevel: (level: LevelData) => void;
  onResetToDefaults: () => void;
  globalTuning: GlobalTuningSettings;
  onSaveGlobalTuning: (tuning: GlobalTuningSettings) => void;
  onResetGlobalTuning: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  allLevels,
  onSaveLevel,
  onPlayLevel,
  onResetToDefaults,
  globalTuning,
  onSaveGlobalTuning,
  onResetGlobalTuning,
}) => {
  const [selectedLevelId, setSelectedLevelId] = useState(currentLevel.id);
  const [editedLevel, setEditedLevel] = useState<LevelData>(() =>
    JSON.parse(JSON.stringify(currentLevel))
  );

  // Modo de edição: 'SUPPLY' (caixas), 'GRID' (pixel art) ou 'GLOBAL' (tuning dev)
  const [activeTab, setActiveTab] = useState<'SUPPLY' | 'GRID' | 'GLOBAL'>('SUPPLY');
  const [selectedBrushColor, setSelectedBrushColor] = useState<string>('#4AF');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Configurações globais de tuning editadas
  const [editedTuning, setEditedTuning] = useState<GlobalTuningSettings>(globalTuning);

  useEffect(() => {
    setEditedTuning(globalTuning);
  }, [globalTuning, isOpen]);

  // Sincroniza ao trocar de fase no seletor
  useEffect(() => {
    const lvl = allLevels.find((l) => l.id === selectedLevelId);
    if (lvl) {
      setEditedLevel(JSON.parse(JSON.stringify(lvl)));
    }
  }, [selectedLevelId, allLevels]);

  if (!isOpen) return null;

  // 1. Contagem de blocos na matriz atual
  const gridColorCounts: Record<string, number> = {};
  let totalGridBlocks = 0;
  for (const row of editedLevel.initialGrid) {
    for (const cell of row) {
      if (cell) {
        gridColorCounts[cell] = (gridColorCounts[cell] || 0) + 1;
        totalGridBlocks++;
      }
    }
  }

  // 2. Contagem de capacidade configurada nas caixas do deck
  const deckColorCounts: Record<string, number> = {};
  let totalDeckCapacity = 0;
  editedLevel.initialSupply.forEach((col) => {
    col.forEach((box) => {
      deckColorCounts[box.colorId] =
        (deckColorCounts[box.colorId] || 0) + box.capacity;
      totalDeckCapacity += box.capacity;
    });
  });

  // Todas as cores presentes na matriz ou no deck
  const activeColorKeys = Array.from(
    new Set([
      ...Object.keys(gridColorCounts),
      ...Object.keys(deckColorCounts),
    ])
  ).sort();

  // Handlers para o Deck de Suprimento
  const handleAddBox = (colIdx: number) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    // Pega a primeira cor ativa ou '#4AF'
    const colorId = activeColorKeys[0] || '#4AF';
    newLvl.initialSupply[colIdx].push({
      colorId,
      capacity: 10,
    });
    setEditedLevel(newLvl);
  };

  const handleRemoveBox = (colIdx: number, depth: number) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    newLvl.initialSupply[colIdx].splice(depth, 1);
    setEditedLevel(newLvl);
  };

  const handleBoxChange = (
    colIdx: number,
    depth: number,
    field: 'colorId' | 'capacity',
    value: any
  ) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    if (field === 'capacity') {
      newLvl.initialSupply[colIdx][depth].capacity = Math.max(1, Number(value) || 1);
    } else {
      newLvl.initialSupply[colIdx][depth].colorId = value;
    }
    setEditedLevel(newLvl);
  };

  const handleMoveBoxDepth = (
    colIdx: number,
    depth: number,
    direction: 'UP' | 'DOWN'
  ) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    const col = newLvl.initialSupply[colIdx];
    const targetIdx = direction === 'UP' ? depth - 1 : depth + 1;
    if (targetIdx >= 0 && targetIdx < col.length) {
      const temp = col[depth];
      col[depth] = col[targetIdx];
      col[targetIdx] = temp;
      setEditedLevel(newLvl);
    }
  };

  const handleMoveBoxColumn = (
    colIdx: number,
    depth: number,
    direction: 'LEFT' | 'RIGHT'
  ) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    const targetColIdx = direction === 'LEFT' ? colIdx - 1 : colIdx + 1;
    if (targetColIdx >= 0 && targetColIdx < newLvl.initialSupply.length) {
      const [box] = newLvl.initialSupply[colIdx].splice(depth, 1);
      newLvl.initialSupply[targetColIdx].push(box);
      setEditedLevel(newLvl);
    }
  };

  // Auto-balancear caixas para igualar a matriz
  const handleAutoBalance = () => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    const colors = Object.keys(gridColorCounts);
    if (colors.length === 0) return;

    // Distribui os blocos de cada cor entre as 4 colunas
    const numCols = 4;
    const newSupply: { colorId: string; capacity: number }[][] = Array.from(
      { length: numCols },
      () => []
    );

    let colCounter = 0;
    colors.forEach((c) => {
      const count = gridColorCounts[c];
      if (count <= 15) {
        newSupply[colCounter % numCols].push({ colorId: c, capacity: count });
        colCounter++;
      } else {
        const half = Math.floor(count / 2);
        newSupply[colCounter % numCols].push({ colorId: c, capacity: half });
        colCounter++;
        newSupply[colCounter % numCols].push({ colorId: c, capacity: count - half });
        colCounter++;
      }
    });

    newLvl.initialSupply = newSupply;
    setEditedLevel(newLvl);
  };

  // Pintar célula da matriz
  const handlePaintCell = (x: number, y: number) => {
    const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
    newLvl.initialGrid[y][x] = selectedBrushColor === 'ERASER' ? null : selectedBrushColor;
    setEditedLevel(newLvl);
  };

  // Handlers para os Ajustes Globais (Dev Tuning)
  const handleTuningChange = (field: keyof GlobalTuningSettings, val: number) => {
    const updated = {
      ...editedTuning,
      [field]: val,
    };
    setEditedTuning(updated);
    onSaveGlobalTuning(updated);
  };

  const handleResetTuning = () => {
    onResetGlobalTuning();
    setEditedTuning({ ...DEFAULT_GLOBAL_TUNING });
    setSaveSuccessMsg('Ajustes globais restaurados para os padrões!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Salvar no LocalStorage
  const handleSave = () => {
    const updated = {
      ...editedLevel,
      bufferSize: Math.max(3, Math.min(7, editedLevel.bufferSize || 5)),
      metadata: {
        ...editedLevel.metadata,
        totalBlocks: totalGridBlocks,
        totalBoxes: editedLevel.initialSupply.reduce((sum, col) => sum + col.length, 0),
        colorCounts: gridColorCounts,
        isCustom: true,
      },
    };
    onSaveLevel(updated);
    setSaveSuccessMsg('Fase salva com sucesso no LocalStorage!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handlePlay = () => {
    handleSave();
    onPlayLevel(editedLevel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                Painel Admin & Editor de Dificuldade
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  LocalStorage
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">
                Altere a disposição das caixas para criar quebra-cabeças casuais ou brutais
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Selector & Tabs */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Fase:</span>
              <select
                value={selectedLevelId}
                onChange={(e) => setSelectedLevelId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl px-3 py-1.5 outline-none hover:border-cyan-500 transition-colors cursor-pointer"
              >
                {allLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} ({lvl.metadata.difficulty})
                  </option>
                ))}
              </select>
            </div>

            {/* Buffer Size (Docas da Fase) */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Docas (Buffer):
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {[3, 4, 5, 6, 7].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      const newLvl = JSON.parse(JSON.stringify(editedLevel)) as LevelData;
                      newLvl.bufferSize = num;
                      setEditedLevel(newLvl);
                    }}
                    className={`w-6 h-6 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      (editedLevel.bufferSize || 5) === num
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`${num} docas para caixas ativas`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('SUPPLY')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'SUPPLY'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Disposição de Caixas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('GRID')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'GRID'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Editar Matriz
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('GLOBAL')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'GLOBAL'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Ajustes Globais (Dev)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          {/* TAB 1: SUPPLY DECK EDITOR */}
          {activeTab === 'SUPPLY' && (
            <div className="flex flex-col gap-4">
              {/* Balance Summary Bar */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">
                    Balanço Matriz ↔ Caixas:
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                      totalGridBlocks === totalDeckCapacity
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {totalDeckCapacity} / {totalGridBlocks} blocos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {totalGridBlocks !== totalDeckCapacity && (
                    <button
                      type="button"
                      onClick={handleAutoBalance}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer"
                    >
                      Auto-Balancear Capacidades
                    </button>
                  )}
                </div>
              </div>

              {/* Status por Cor */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                {activeColorKeys.map((c) => {
                  const colorDef = getColorDef(editedLevel.palette, c);
                  const inGrid = gridColorCounts[c] || 0;
                  const inDeck = deckColorCounts[c] || 0;
                  const isMatch = inGrid === inDeck;

                  return (
                    <div
                      key={c}
                      className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 border ${
                        isMatch
                          ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                          : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: colorDef.hex }}
                      />
                      <span className="font-black">{colorDef.name}:</span>
                      <span className="font-mono">
                        {inDeck}/{inGrid}
                      </span>
                      {isMatch ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 4 Colunas do Deck com Edição Completa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                {editedLevel.initialSupply.map((column, colIdx) => (
                  <div
                    key={colIdx}
                    className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800 flex flex-col gap-2 min-h-[300px]"
                  >
                    <div className="flex items-center justify-between text-xs font-black text-slate-300 pb-2 border-b border-slate-800">
                      <span>Coluna {colIdx + 1}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {column.length} caixas
                      </span>
                    </div>

                    {/* Lista de Caixas nesta Coluna */}
                    <div className="flex-1 flex flex-col gap-2">
                      {column.map((box, depth) => {
                        const colorDef = editedLevel.palette[box.colorId];

                        return (
                          <div
                            key={depth}
                            className="p-2 rounded-xl border border-slate-700 bg-slate-900/90 flex flex-col gap-1.5 shadow-sm"
                            style={{
                              borderLeftWidth: '4px',
                              borderLeftColor: colorDef?.hex || '#fff',
                            }}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-400">
                                {depth === 0 ? 'FRENTE (Livre)' : `Prof. ${depth}`}
                              </span>

                              {/* Reordenar Profundidade e Coluna */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveBoxColumn(colIdx, depth, 'LEFT')}
                                  disabled={colIdx === 0}
                                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"
                                  title="Mover para coluna esquerda"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBoxColumn(colIdx, depth, 'RIGHT')}
                                  disabled={colIdx === 3}
                                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"
                                  title="Mover para coluna direita"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBoxDepth(colIdx, depth, 'UP')}
                                  disabled={depth === 0}
                                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"
                                  title="Trazer para frente"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBoxDepth(colIdx, depth, 'DOWN')}
                                  disabled={depth === column.length - 1}
                                  className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-400"
                                  title="Empurrar para trás"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBox(colIdx, depth)}
                                  className="p-1 rounded hover:bg-rose-900/50 text-rose-400"
                                  title="Excluir caixa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Controles de Cor e Capacidade */}
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div>
                                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                                  Cor
                                </label>
                                <select
                                  value={box.colorId}
                                  onChange={(e) =>
                                    handleBoxChange(colIdx, depth, 'colorId', e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-200 outline-none"
                                >
                                  {Object.keys(DEFAULT_PALETTE).map((k) => (
                                    <option key={k} value={k}>
                                      {DEFAULT_PALETTE[k].name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">
                                  Capacidade
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={box.capacity}
                                  onChange={(e) =>
                                    handleBoxChange(colIdx, depth, 'capacity', e.target.value)
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-200 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão Adicionar Caixa nesta Coluna */}
                    <button
                      type="button"
                      onClick={() => handleAddBox(colIdx)}
                      className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-900/40 hover:bg-amber-500/10 text-slate-400 hover:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Caixa</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: GRID PIXEL ART EDITOR */}
          {activeTab === 'GRID' && (
            <div className="flex flex-col items-center gap-4">
              {/* Seletor de Pincel de Cor */}
              <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 w-full">
                <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> Pincel:
                </span>

                {Object.keys(DEFAULT_PALETTE).map((k) => {
                  const color = DEFAULT_PALETTE[k];
                  const isSelected = selectedBrushColor === k;

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedBrushColor(k)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs transition-transform ${
                        isSelected
                          ? 'ring-2 ring-white scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: color.hex,
                        color: color.textHex,
                      }}
                      title={color.name}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedBrushColor('ERASER')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                    selectedBrushColor === 'ERASER'
                      ? 'bg-rose-500 text-slate-950 border-rose-400 shadow'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  Borracha (Vazio)
                </button>
              </div>

              {/* Tabuleiro Interativo para Desenhar */}
              <div
                className="grid gap-1 p-3 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner select-none cursor-pointer"
                style={{
                  gridTemplateColumns: `repeat(${editedLevel.width}, minmax(0, 1fr))`,
                  width: `${Math.min(480, editedLevel.width * 38)}px`,
                  aspectRatio: `${editedLevel.width} / ${editedLevel.height}`,
                }}
                onMouseDown={() => setIsMouseDown(true)}
                onMouseUp={() => setIsMouseDown(false)}
                onMouseLeave={() => setIsMouseDown(false)}
              >
                {editedLevel.initialGrid.map((row, y) =>
                  row.map((cell, x) => {
                    const colorDef = cell ? DEFAULT_PALETTE[cell] : null;

                    return (
                      <div
                        key={`${x}-${y}`}
                        onMouseDown={() => handlePaintCell(x, y)}
                        onMouseEnter={() => isMouseDown && handlePaintCell(x, y)}
                        className={`w-full h-full rounded-md flex items-center justify-center text-[10px] font-black transition-all ${
                          cell ? 'shadow-sm' : 'bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/50'
                        }`}
                        style={{
                          backgroundColor: colorDef?.hex,
                          color: colorDef?.textHex,
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GLOBAL SIMULATION TUNING (DEV MODE) */}
          {activeTab === 'GLOBAL' && (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto py-2">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    Parâmetros Globais de Simulação & Ritmo (Tuning Dev)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ajustes de física e cadência aplicados em tempo real a todas as fases para testar o game-feel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetTuning}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrões
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Velocidade dos Robôs */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-amber-400" />
                      Velocidade dos Robôs
                    </span>
                    <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25">
                      {editedTuning.robotSpeed} px/s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Velocidade de movimento ortogonal dos robôs AGVs pela grade e corredores da fábrica.
                  </p>
                  <input
                    type="range"
                    min={100}
                    max={600}
                    step={10}
                    value={editedTuning.robotSpeed}
                    onChange={(e) => handleTuningChange('robotSpeed', Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>100 (Lento)</span>
                    <span className="text-amber-400/80 font-bold">260 (Padrão)</span>
                    <span>600 (Turbo)</span>
                  </div>
                </div>

                {/* 2. Cadência de Spawn */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      Cadência de Spawn (Intervalo)
                    </span>
                    <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/25">
                      {(editedTuning.spawnCooldown * 1000).toFixed(0)} ms ({editedTuning.spawnCooldown}s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Intervalo mínimo entre robôs consecutivos disparados a partir da mesma doca.
                  </p>
                  <input
                    type="range"
                    min={0.02}
                    max={0.30}
                    step={0.01}
                    value={editedTuning.spawnCooldown}
                    onChange={(e) => handleTuningChange('spawnCooldown', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>20ms (Rajada)</span>
                    <span className="text-cyan-400/80 font-bold">90ms (Padrão)</span>
                    <span>300ms (Fila aberta)</span>
                  </div>
                </div>

                {/* 3. Tempo de Colheita */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-emerald-400" />
                      Tempo de Colheita (Pop no Bloco)
                    </span>
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                      {(editedTuning.harvestTime * 1000).toFixed(0)} ms ({editedTuning.harvestTime}s)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Duração que o robô pausa no bloco antes de descolar e virar em direção à esteira.
                  </p>
                  <input
                    type="range"
                    min={0.01}
                    max={0.30}
                    step={0.01}
                    value={editedTuning.harvestTime}
                    onChange={(e) => handleTuningChange('harvestTime', Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>10ms (Instantâneo)</span>
                    <span className="text-emerald-400/80 font-bold">80ms (Padrão)</span>
                    <span>300ms (Pausa tátil)</span>
                  </div>
                </div>

                {/* 4. Velocidade da Esteira Rolante */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-violet-400" />
                      Velocidade da Esteira
                    </span>
                    <span className="text-xs font-mono font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/25">
                      {editedTuning.conveyorSpeed} px/s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Velocidade das caixas subindo pela esteira rolante mecanizada até o túnel de saída.
                  </p>
                  <input
                    type="range"
                    min={30}
                    max={250}
                    step={5}
                    value={editedTuning.conveyorSpeed}
                    onChange={(e) => handleTuningChange('conveyorSpeed', Number(e.target.value))}
                    className="w-full accent-violet-400 cursor-pointer mt-1"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>30 (Cadência lenta)</span>
                    <span className="text-violet-400/80 font-bold">85 (Padrão)</span>
                    <span>250 (Expresso)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950/80 px-5 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Fases de Fábrica
          </button>

          {saveSuccessMsg && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              {saveSuccessMsg}
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Alterações
            </button>

            <button
              type="button"
              onClick={handlePlay}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Jogar Esta Fase Agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
