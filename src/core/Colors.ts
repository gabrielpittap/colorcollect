import { ColorDef } from './Types';

/**
 * Paleta padrão industrial de alta distinção visual e contraste.
 * Cada cor possui um identificador interno hexadecimal de 3 dígitos (ex: #4AF, #FC4).
 * O identificador é estritamente técnico e NUNCA exibido ao jogador.
 */
export const DEFAULT_PALETTE: Record<string, ColorDef> = {
  '#4AF': {
    id: '#4AF',
    hex: '#4AF',
    name: 'Azul Ciano',
    textHex: '#083344',
  },
  '#FC4': {
    id: '#FC4',
    hex: '#FC4',
    name: 'Amarelo Ouro',
    textHex: '#422006',
  },
  '#F6C': {
    id: '#F6C',
    hex: '#F6C',
    name: 'Rosa Magenta',
    textHex: '#ffffff',
  },
  '#4D8': {
    id: '#4D8',
    hex: '#4D8',
    name: 'Verde Esmeralda',
    textHex: '#022c22',
  },
  '#F84': {
    id: '#F84',
    hex: '#F84',
    name: 'Laranja Radiante',
    textHex: '#431407',
  },
  '#A4F': {
    id: '#A4F',
    hex: '#A4F',
    name: 'Roxo Elétrico',
    textHex: '#ffffff',
  },
  '#FFF': {
    id: '#FFF',
    hex: '#FFF',
    name: 'Branco Puro',
    textHex: '#0f172a',
  },
  '#38C': {
    id: '#38C',
    hex: '#38C',
    name: 'Grafite Metálico',
    textHex: '#f8fafc',
  },
  '#F44': {
    id: '#F44',
    hex: '#F44',
    name: 'Vermelho Coral',
    textHex: '#ffffff',
  },
};

/**
 * Mapeamento de retrocompatibilidade para dados legados (A-H -> 3-digit hex)
 */
export const LEGACY_LETTER_MAP: Record<string, string> = {
  A: '#4AF',
  B: '#FC4',
  C: '#F6C',
  D: '#4D8',
  E: '#F84',
  F: '#A4F',
  G: '#FFF',
  H: '#38C',
};

/**
 * Chaves das cores principais disponíveis no sistema
 */
export const COLOR_KEYS = [
  '#4AF',
  '#FC4',
  '#F6C',
  '#4D8',
  '#F84',
  '#A4F',
  '#FFF',
  '#38C',
  '#F44',
];

/**
 * Converte qualquer ID de cor (seja legado 'A' ou '#4AF') para o identificador 3-digit hex oficial
 */
export function normalizeColorId(colorId: string): string {
  if (DEFAULT_PALETTE[colorId]) return colorId;
  if (LEGACY_LETTER_MAP[colorId]) return LEGACY_LETTER_MAP[colorId];
  return colorId;
}

/**
 * Obtém a definição de cor a partir de qualquer identificador ou fallback
 */
export function getColorDef(palette: Record<string, ColorDef>, colorId: string): ColorDef {
  const normalized = normalizeColorId(colorId);
  return palette[normalized] || DEFAULT_PALETTE[normalized] || {
    id: normalized,
    hex: normalized.startsWith('#') ? normalized : '#94a3b8',
    name: 'Cor Industrial',
    textHex: '#ffffff',
  };
}
