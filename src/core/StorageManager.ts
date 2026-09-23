import { LevelData, LevelProgress, GameSettings } from './Types';
import { INITIAL_LEVELS } from './DefaultLevels';

const STORAGE_KEYS = {
  LEVELS: 'colorcollect_levels_v2',
  PROGRESS: 'colorcollect_progress_v2',
  SETTINGS: 'colorcollect_settings_v2',
  LAST_LEVEL_ID: 'colorcollect_last_level_id',
};

class StorageManagerClass {
  /**
   * Obtém a lista completa de fases (padrão + customizadas/editadas)
   */
  public getLevels(): LevelData[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Erro ao ler fases do localStorage:', e);
    }

    // Inicializa com as 5 fases padrão se não houver dados salvos
    this.saveLevels(INITIAL_LEVELS);
    return INITIAL_LEVELS;
  }

  /**
   * Salva toda a lista de fases no localStorage
   */
  public saveLevels(levels: LevelData[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(levels));
    } catch (e) {
      console.error('Erro ao salvar fases no localStorage:', e);
    }
  }

  /**
   * Salva ou atualiza uma fase específica
   */
  public saveLevel(level: LevelData): void {
    const levels = this.getLevels();
    const index = levels.findIndex((l) => l.id === level.id);
    if (index >= 0) {
      levels[index] = level;
    } else {
      levels.push(level);
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
   * Restaura as 5 fases padrão de fábrica
   */
  public resetToDefaults(): LevelData[] {
    this.saveLevels(INITIAL_LEVELS);
    return INITIAL_LEVELS;
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
