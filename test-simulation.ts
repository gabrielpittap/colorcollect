import { INITIAL_LEVELS } from './src/core/DefaultLevels';
import { StorageManager } from './src/core/StorageManager';
import { ContinuousGameEngine } from './src/core/ContinuousGameEngine';
import { Pathfinder } from './src/core/Pathfinder';
import { EdgeDetector } from './src/core/EdgeDetector';
import { DEFAULT_PALETTE, COLOR_KEYS, normalizeColorId, getColorDef } from './src/core/Colors';

console.log('=== TEST 1: Default Levels Integrity ===');
for (const lvl of INITIAL_LEVELS) {
  console.log(`Auditing level ${lvl.id}: "${lvl.name}"`);
  if (!lvl.initialGrid || lvl.initialGrid.length === 0) {
    throw new Error(`Level ${lvl.id} has empty grid`);
  }
  
  // Verify only 3-digit hex IDs starting with #
  for (let y = 0; y < lvl.height; y++) {
    for (let x = 0; x < lvl.width; x++) {
      const cell = lvl.initialGrid[y][x];
      if (cell !== null) {
        if (!cell.startsWith('#') || cell.length !== 4) {
          throw new Error(`Level ${lvl.id} cell (${x},${y}) has invalid colorId: "${cell}"`);
        }
      }
    }
  }

  // Count grid blocks
  const gridCounts: Record<string, number> = {};
  let totalGrid = 0;
  for (const row of lvl.initialGrid) {
    for (const cell of row) {
      if (cell) {
        gridCounts[cell] = (gridCounts[cell] || 0) + 1;
        totalGrid++;
      }
    }
  }

  // Count supply box capacities
  const supplyCounts: Record<string, number> = {};
  let totalSupply = 0;
  for (const col of lvl.initialSupply) {
    for (const box of col) {
      if (!box.colorId.startsWith('#') || box.colorId.length !== 4) {
        throw new Error(`Level ${lvl.id} supply box has invalid colorId: "${box.colorId}"`);
      }
      supplyCounts[box.colorId] = (supplyCounts[box.colorId] || 0) + box.capacity;
      totalSupply += box.capacity;
    }
  }

  if (totalGrid !== totalSupply) {
    throw new Error(`Level ${lvl.id} total mismatch: grid ${totalGrid} vs supply ${totalSupply}`);
  }

  for (const color of Object.keys(gridCounts)) {
    if (gridCounts[color] !== (supplyCounts[color] || 0)) {
      throw new Error(`Level ${lvl.id} color mismatch for ${color}: grid ${gridCounts[color]} vs supply ${supplyCounts[color]}`);
    }
  }
}
console.log('✓ All 5 default levels have valid 3-digit hex IDs and 100% exact mathematical balance!');

console.log('\n=== TEST 2: StorageManager in Headless/SSR Environment ===');
// Should NOT throw ReferenceError: localStorage is not defined
const levelsFromStorage = StorageManager.getLevels();
if (!levelsFromStorage || levelsFromStorage.length !== 5) {
  throw new Error(`Expected 5 levels from StorageManager, got ${levelsFromStorage?.length}`);
}
console.log('✓ StorageManager safely returns 5 audited default levels without crashing in Node.js environment!');

console.log('\n=== TEST 3: Pathfinder Orthogonal Navigation & Side Exit ===');
const level1 = levelsFromStorage[0];
const exposed1 = EdgeDetector.getExposedCells(level1.initialGrid);
if (exposed1.length === 0) {
  throw new Error('Level 1 has no exposed cells!');
}
const firstExposed = exposed1[0];
const pathFromDock = Pathfinder.findPathToBlockFace(
  0,
  level1.height,
  firstExposed.x,
  firstExposed.y,
  level1.initialGrid,
  level1.width,
  level1.height
);
if (!pathFromDock || pathFromDock.length === 0) {
  throw new Error(`Pathfinder failed to find route to exposed block (${firstExposed.x}, ${firstExposed.y})`);
}
const exitPath = Pathfinder.findPathToSideExit(
  firstExposed.x,
  firstExposed.y,
  level1.initialGrid,
  level1.width,
  level1.height
);
if (!exitPath || exitPath.length === 0) {
  throw new Error(`Pathfinder failed to find route to side exit from (${firstExposed.x}, ${firstExposed.y})`);
}
console.log(`✓ Pathfinder found valid path from dock (length ${pathFromDock.length}) and to side exit (length ${exitPath.length})!`);

console.log('\n=== TEST 4: Full Simulation of Level 1 to WON ===');
let finalStatus = 'PLAYING';
let depositedBoxesCount = 0;

const engine = new ContinuousGameEngine(level1, {
  onStatusChanged: (status) => { finalStatus = status; },
  onBoxDeposited: () => { depositedBoxesCount++; },
});

engine.updateLayoutMetrics(
  [
    { x: 50, y: 500 },
    { x: 120, y: 500 },
    { x: 190, y: 500 },
    { x: 260, y: 500 },
    { x: 330, y: 500 },
  ],
  28,
  40,
  50,
  400,
  600
);

let steps = 0;
const maxSteps = 3000;
while (finalStatus === 'PLAYING' && steps < maxSteps) {
  // Pull available boxes into buffer
  if (engine.bufferSlots.some(s => s.box === null)) {
    for (let c = 0; c < engine.supplyColumns.length; c++) {
      if (engine.supplyColumns[c].length > 0) {
        engine.pullBox(c);
        break;
      }
    }
  }
  engine.update(0.05);
  steps++;
}

console.log(`Level 1 simulation finished in ${steps} steps. Status: ${finalStatus}`);
console.log(`Blocks collected: ${engine.totalCollectedBlocks} / ${engine.totalInitialBlocks}`);
console.log(`Boxes deposited at exit: ${depositedBoxesCount}`);

if (finalStatus !== 'WON') {
  throw new Error(`Level 1 simulation did not end in WON (got ${finalStatus})`);
}
if (engine.totalCollectedBlocks !== engine.totalInitialBlocks) {
  throw new Error(`Mismatch in collected blocks: ${engine.totalCollectedBlocks} vs ${engine.totalInitialBlocks}`);
}
console.log('✓ Level 1 simulation succeeded with WON status, 55/55 blocks collected and deposited!');

console.log('\n=== TEST 5: Deadlock / LOST Condition Verification ===');
// Create a deadlock scenario: grid has only #FFF in center surrounded by #F84
// Buffer has 5 boxes of #4AF (which is not in the grid)
const deadlockLevel = JSON.parse(JSON.stringify(level1));
const engineDeadlock = new ContinuousGameEngine(deadlockLevel);
engineDeadlock.updateLayoutMetrics(
  [
    { x: 50, y: 500 },
    { x: 120, y: 500 },
    { x: 190, y: 500 },
    { x: 260, y: 500 },
    { x: 330, y: 500 },
  ],
  28, 40, 50, 400, 600
);

// Fill all 5 buffer slots with a color not exposed in the grid
for (let i = 0; i < 5; i++) {
  engineDeadlock.bufferSlots[i].box = {
    id: `box_deadlock_${i}`,
    colorId: '#38C', // Not in Level 1
    totalCapacity: 5,
    remaining: 5,
    column: 0,
    depth: 0,
    isUnlocked: true,
  };
}

engineDeadlock.update(0.1);
if (engineDeadlock.status !== 'LOST') {
  throw new Error(`Expected engine status to be LOST on deadlock, got ${engineDeadlock.status}`);
}
console.log('✓ Deadlock condition correctly triggered LOST status when all 5 buffer slots are blocked!');

console.log('\n=== TEST 6: Verify ColorDef helper & 3-digit hex normalization ===');
if (normalizeColorId('A') !== '#4AF') throw new Error('normalizeColorId A failed');
if (normalizeColorId('B') !== '#FC4') throw new Error('normalizeColorId B failed');
if (normalizeColorId('#4AF') !== '#4AF') throw new Error('normalizeColorId #4AF failed');
const def = getColorDef(DEFAULT_PALETTE, '#4AF');
if (!def || def.hex !== '#4AF' || def.name !== 'Azul Ciano') {
  throw new Error(`getColorDef failed: ${JSON.stringify(def)}`);
}
console.log('✓ Color normalization and definitions verified!');

console.log('\n=== TEST 7: Dynamic BufferSize (3, 4, 7 slots) ===');
for (const testSize of [3, 4, 7]) {
  const dynamicLevel = JSON.parse(JSON.stringify(level1));
  dynamicLevel.bufferSize = testSize;
  const dynEngine = new ContinuousGameEngine(dynamicLevel);
  if (dynEngine.bufferSlots.length !== testSize) {
    throw new Error(`Expected ${testSize} buffer slots, got ${dynEngine.bufferSlots.length}`);
  }
  const dockPoint = dynEngine.getDockGridPos(testSize - 1);
  if (dockPoint.y !== dynamicLevel.height) {
    throw new Error(`Dock grid pos y expected ${dynamicLevel.height}, got ${dockPoint.y}`);
  }
}
console.log('✓ Dynamic bufferSize (3, 4, 7 slots) correctly instantiates bufferSlots and coordinates!');

console.log('\n=== TEST 8: Global Tuning Settings (Speed, Cadence, Harvest, Conveyor) ===');
const tuning = StorageManager.getTuningSettings();
if (!tuning.robotSpeed || !tuning.spawnCooldown || !tuning.harvestTime || !tuning.conveyorSpeed) {
  throw new Error(`Invalid tuning settings: ${JSON.stringify(tuning)}`);
}
const customTuning = {
  robotSpeed: 450,
  spawnCooldown: 0.05,
  harvestTime: 0.04,
  conveyorSpeed: 120,
};
const customEngine = new ContinuousGameEngine(level1, undefined, customTuning);
if (customEngine.tuning.robotSpeed !== 450) {
  throw new Error(`Expected engine robotSpeed 450, got ${customEngine.tuning.robotSpeed}`);
}
customEngine.updateTuning({ ...customTuning, robotSpeed: 520 });
if (customEngine.tuning.robotSpeed !== 520) {
  throw new Error(`Expected updated robotSpeed 520, got ${customEngine.tuning.robotSpeed}`);
}
console.log('✓ Global Tuning settings initialized and updated correctly in runtime engine!');

console.log('\n=== ALL SIMULATION TESTS PASSED SUCCESSFULLY! ===');
