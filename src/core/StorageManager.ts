import { LevelData, LevelProgress, GameSettings } from './Types';
import { INITIAL_LEVELS } from './DefaultLevels';

const STORAGE_KEYS = {
  LEVELS: 'colorcollect_levels_v4', // Atualizado para v4 para garantir dados auditados
  PROGRESS: 'colorcollect_progress_v2',
  SETTINGS: 'colorcollect_settings_v2',
  LAST_LEVEL_ID: 'colorcollect_last_level_id',
};

class StorageManagerClass {
  /**
   * Audita matematicamente uma fase: verifica se cada cor na matriz tem exatamente
   * o mesmo número de blocos no deck de suprimento. Se houver discrepância (por ex. de cache antigo),
   * corrige automaticamente as capacidades para garantir 100% de consistência.
   */
  public auditAndEnsureConsistency(level: LevelData): LevelData {
    // 1. Contagem real na matriz
    const gridCounts: Record<string, number> = {};
    let totalGrid = 0;
    for (const row of level.initialGrid) {
      for (const cell of row) {
        if (cell) {
          gridCounts[cell] = (gridCounts[cell] || 0) + 1;
          totalGrid++;
        }
      }
    }

    // 2. Contagem atual no deck
    const supplyCounts: Record<string, number> = {};
    level.initialSupply.forEach((col) => {
      col.forEach((b) => {
        supplyCounts[b.colorId] = (supplyCounts[b.colorId] || 0) + b.capacity;
      });
    });

    // 3. Verifica se há inconsistência
    let hasMismatch = false;
    for (const c of Object.keys(gridCounts)) {
      if (gridCounts[c] !== (supplyCounts[c] || 0)) {
        hasMismatch = true;
        break;
      }
    }
    for (const c of Object.keys(supplyCounts)) {
      if (!gridCounts[c] && supplyCounts[c] > 0) {
        hasMismatch = true;
        break;
      }
    }

    if (!hasMismatch) {
      return level;
    }

    // Se houver inconsistência, corrige e reequilibra com precisão cirúrgica
    const repaired = JSON.parse(JSON.stringify(level)) as LevelData;

    // Remove caixas de cores fantasmas que não existem na matriz
    repaired.initialSupply = repaired.initialSupply.map((col) =>
      col.filter((b) => gridCounts[b.colorId] > 0)
    );

    // Ajusta as capacidades das cores existentes para bater 100% com a matriz
    for (const colorId of Object.keys(gridCounts)) {
      const needed = gridCounts[colorId];
      const matchingBoxes: { col: number; depth: number; box: { colorId: string; capacity: number } }[] = [];
      repaired.initialSupply.forEach((col, colIdx) => {
        col.forEach((box, depth) => {
          if (box.colorId === colorId) {
            matchingBoxes.push({ col: colIdx, depth, box });
          }
        });
      });

      if (matchingBoxes.length === 0) {
        // Se a cor existe na matriz mas não tinha caixa, adiciona na coluna com menos caixas
        let minCol = 0;
        for (let i = 1; i < repaired.initialSupply.length; i++) {
          if (repaired.initialSupply[i].length < repaired.initialSupply[minCol].length) {
            minCol = i;
          }
        }
        repaired.initialSupply[minCol].push({ colorId, capacity: needed });
      } else {
        // Distribui exatamente a quantidade necessária entre as caixas existentes
        const currentSum = matchingBoxes.reduce((acc, m) => acc + m.box.capacity, 0) || 1;
        let allocated = 0;
        matchingBoxes.forEach((m, idx) => {
          if (idx === matchingBoxes.length - 1) {
            m.box.capacity = Math.max(1, needed - allocated);
          } else {
            const prop = Math.max(1, Math.round((m.box.capacity / currentSum) * needed));
            m.box.capacity = prop;
            allocated += prop;
          }
        });
      }
    }

    repaired.metadata.totalBlocks = totalGrid;
    repaired.metadata.colorCounts = gridCounts;
    return repaired;
  }

  /**
   * Obtém a lista completa de fases (auditadas e garantidas de ter 100% de consistência)
   */
  public getLevels(): LevelData[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Audita e valida cada fase carregada
          const audited = parsed.map((lvl) => this.auditAndEnsureConsistency(lvl));
          return audited;
        }
      }
    } catch (e) {
      console.error('Erro ao ler fases do localStorage:', e);
    }

    // Inicializa com as 5 fases padrão auditadas
    const auditedDefaults = INITIAL_LEVELS.map((lvl) => this.auditAndEnsureConsistency(lvl));
    this.saveLevels(auditedDefaults);
    return auditedDefaults;
  }

  /**
   * Salva toda a lista de fases no localStorage
   */
  public saveLevels(levels: LevelData[]): void {
    try {
      const audited = levels.map((lvl) => this.auditAndEnsureConsistency(lvl));
      localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(audited));
    } catch (e) {
      console.error('Erro ao salvar fases no localStorage:', e);
    }
  }

  /**
   * Salva ou atualiza uma fase específica
   */
  public saveLevel(level: LevelData): void {
    const auditedLevel = this.auditAndEnsureConsistency(level);
    const levels = this.getLevels();
    const index = levels.findIndex((l) => l.id === auditedLevel.id);
    if (index >= 0) {
      levels[index] = auditedLevel;
    } else {
      levels.push(auditedLevel);
    }
    this.saveLevels(levels);
  }

  /**
   * Remove uma fase customizada
   */
  public deleteLevel(levelId: string): boolean {
    const levels = this.getLevels();
    const filtered = levels.filter((l) => l.id !== levelId);
    if (filtered.length !== levels.length) {
      this.saveLevels(filtered);
      return true;
    }
    return false;
  }

  /**
   * Restaura as 5 fases padrão auditadas de fábrica
   */
  public resetToDefaults(): LevelData[] {
    const auditedDefaults = INITIAL_LEVELS.map((lvl) => this.auditAndEnsureConsistency(lvl));
    this.saveLevels(auditedDefaults);
    return auditedDefaults;
  }

  /**
   * Obtém o progresso de uma fase (estrelas, vitória, tempo)
   */
  public getLevelProgress(levelId: string): LevelProgress {
    const all = this.getAllProgress();
    return all[levelId] || { completed: false, stars: 0 };
  }

  /**
   * Obtém todo o mapa de progresso
   */
  public getAllProgress(): Record<string, LevelProgress> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (data) return JSON.parse(data);
    } catch {}
    return {};
  }

  /**
   * Salva progresso de vitória ou nova pontuação em uma fase
   */
  public saveLevelProgress(levelId: string, progress: Partial<LevelProgress>): void {
    try {
      const all = this.getAllProgress();
      const current = all[levelId] || { completed: false, stars: 0 };
      all[levelId] = {
        ...current,
        ...progress,
        completed: progress.completed ?? current.completed,
        stars: Math.max(current.stars, progress.stars ?? 0),
        bestTimeSeconds:
          current.bestTimeSeconds && progress.bestTimeSeconds
            ? Math.min(current.bestTimeSeconds, progress.bestTimeSeconds)
            : progress.bestTimeSeconds || current.bestTimeSeconds,
      };
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(all));
    } catch (e) {
      console.error('Erro ao salvar progresso:', e);
    }
  }

  /**
   * Obtém o ID da última fase jogada
   */
  public getLastLevelId(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_LEVEL_ID) || INITIAL_LEVELS[0].id;
    } catch {
      return INITIAL_LEVELS[0].id;
    }
  }

  /**
   * Salva o ID da última fase jogada
   */
  public saveLastLevelId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_LEVEL_ID, id);
    } catch {}
  }

  /**
   * Obtém as configurações do jogo
   */
  public getSettings(): GameSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
    } catch {}
    return { soundEnabled: true, fastSpeed: false };
  }

  /**
   * Salva configurações do jogo
   */
  public saveSettings(settings: Partial<GameSettings>): void {
    try {
      const current = this.getSettings();
      localStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify({ ...current, ...settings })
      );
    } catch {}
  }
}

export const StorageManager = new StorageManagerClass();
