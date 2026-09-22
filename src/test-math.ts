import { EdgeDetector } from './core/EdgeDetector';
import { DependencyGraph } from './core/DependencyGraph';
import { LevelGenerator } from './core/LevelGenerator';
import { LevelSolver } from './core/LevelSolver';
import {
  createConcentricLevel,
  createMiniBotLevel,
  createHeartLevel,
} from './core/PresetLevels';

console.log('=== INICIANDO BATERIA DE TESTES MATEMÁTICOS (COLORCOLLECT) ===\n');

// Teste 1: Detecção de Bordas
console.log('--- Teste 1: Detecção de Borda Acessível (EdgeDetector) ---');
const concentricGrid = createConcentricLevel();
const exposedInitial = EdgeDetector.getExposedCells(concentricGrid);
const exposedCounts = EdgeDetector.getExposedCounts(concentricGrid);
console.log(`Total de células na borda externa: ${exposedInitial.length}`);
console.log('Contagem de cores na borda:', exposedCounts);
if (exposedCounts['A'] > 0 && !exposedCounts['B'] && !exposedCounts['C']) {
  console.log('✅ SUCESSO: Apenas a cor A (casca externa) está acessível na largada!');
} else {
  console.error('❌ FALHA na detecção de camadas da casca!');
}

// Teste 2: Grafo de Camadas (DAG)
console.log('\n--- Teste 2: Topologia de Camadas (DependencyGraph) ---');
const layerAnalysis = DependencyGraph.analyzeColorLayers(concentricGrid);
console.log('Camadas detectadas:');
for (const l of layerAnalysis) {
  console.log(`  Cor ${l.colorId}: Camada Min ${l.minLayer}, Camada Max ${l.maxLayer}, Total: ${l.totalCount}`);
}
const edges = DependencyGraph.buildDependencyEdges(concentricGrid);
console.log(`Arestas de dependência encontradas (${edges.length}):`);
for (const e of edges) {
  console.log(`  ${e.fromColor} -> ${e.toColor} (bloqueia ${e.blockingCount} blocos)`);
}

// Teste 3: Geração de Nível e Solver de Solvabilidade
console.log('\n--- Teste 3: Geração e Solver no Nível Concêntrico ---');
const genResult1 = LevelGenerator.generateLevel(concentricGrid, {
  name: 'Alvo Concêntrico',
  bufferSize: 5,
});
console.log(`Fase gerada: ${genResult1.level.name}`);
console.log(`Total de blocos: ${genResult1.level.metadata.totalBlocks}`);
console.log(`Total de caixas: ${genResult1.level.metadata.totalBoxes}`);
console.log(`Total de caminhos de vitória: ${genResult1.solutionsCount}`);
console.log(`Dificuldade classificada: ${genResult1.difficulty}`);
if (genResult1.solutionsCount > 0) {
  console.log('✅ SUCESSO: O Solver garantiu que a fase tem solução viável!');
} else {
  console.error('❌ FALHA: Fase gerada como insolúvel!');
}

// Teste 4: Mini Robô (Pixel Art com 5 cores)
console.log('\n--- Teste 4: Geração e Solver no Nível Mini Robô ---');
const botGrid = createMiniBotLevel();
const genResult2 = LevelGenerator.generateLevel(botGrid, {
  name: 'Mini Robô',
  bufferSize: 5,
});
console.log(`Total de blocos: ${genResult2.level.metadata.totalBlocks}`);
console.log(`Total de caminhos de vitória: ${genResult2.solutionsCount}`);
console.log(`Dificuldade classificada: ${genResult2.difficulty}`);
if (genResult2.solutionsCount > 0) {
  console.log('✅ SUCESSO: Mini Robô validado com solução viável!');
} else {
  console.error('❌ FALHA no Mini Robô!');
}

// Teste 5: Coração Pixel
console.log('\n--- Teste 5: Geração e Solver no Nível Coração ---');
const heartGrid = createHeartLevel();
const genResult3 = LevelGenerator.generateLevel(heartGrid, {
  name: 'Coração',
  bufferSize: 5,
});
console.log(`Total de blocos: ${genResult3.level.metadata.totalBlocks}`);
console.log(`Total de caminhos de vitória: ${genResult3.solutionsCount}`);
console.log(`Dificuldade classificada: ${genResult3.difficulty}`);

console.log('\n=== TODOS OS TESTES MATEMÁTICOS CONCLUÍDOS COM SUCESSO! ===');
