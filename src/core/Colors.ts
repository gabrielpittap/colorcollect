import { ColorDef } from './Types';

/**
 * Paleta padrão de alta distinção visual e contraste.
 * Cada cor possui uma letra para representação matricial pura (CLI/Matriz).
 */
export const DEFAULT_PALETTE: Record<string, ColorDef> = {
  A: {
    id: 'A',
    letter: 'A',
    name: 'Azul Ciano',
    hex: '#06b6d4',
    textHex: '#083344',
  },
  B: {
    id: 'B',
    letter: 'B',
    name: 'Amarelo Ouro',
    hex: '#eab308',
    textHex: '#422006',
  },
  C: {
    id: 'C',
    letter: 'C',
    name: 'Rosa Magenta',
    hex: '#ec4899',
    textHex: '#500724',
  },
  D: {
    id: 'D',
    letter: 'D',
    name: 'Verde Esmeralda',
    hex: '#10b981',
    textHex: '#022c22',
  },
  E: {
    id: 'E',
    letter: 'E',
    name: 'Laranja Radiante',
    hex: '#f97316',
    textHex: '#431407',
  },
  F: {
    id: 'F',
    letter: 'F',
    name: 'Roxo Elétrico',
    hex: '#8b5cf6',
    textHex: '#2e1065',
  },
  G: {
    id: 'G',
    letter: 'G',
    name: 'Branco Puro',
    hex: '#f8fafc',
    textHex: '#0f172a',
  },
  H: {
    id: 'H',
    letter: 'H',
    name: 'Grafite / Preto',
    hex: '#334155',
    textHex: '#f8fafc',
  },
};

export const COLOR_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];
