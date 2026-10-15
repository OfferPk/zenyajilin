const test = require('node:test');
const assert = require('node:assert/strict');
const {
  YajilinEngine,
  CELL_EMPTY,
  CELL_BLACK,
  CELL_DOT,
  DIR_UP,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT
} = require('../src/yajilin-engine.js');
const { LEVEL_PACKS } = require('../src/levels.js');

test('YajilinEngine: Initialization & Clue Management', () => {
  const clues = [
    { r: 0, c: 1, dir: DIR_DOWN, count: 1 },
    { r: 3, c: 4, dir: DIR_LEFT, count: 0 }
  ];
  const engine = new YajilinEngine(5, 5, clues);

  assert.equal(engine.width, 5);
  assert.equal(engine.height, 5);
  assert.equal(engine.isClue(0, 1), true);
  assert.equal(engine.isClue(3, 4), true);
  assert.equal(engine.isClue(0, 0), false);

  const cl = engine.getClue(0, 1);
  assert.equal(cl.dir, DIR_DOWN);
  assert.equal(cl.count, 1);

  // Cannot mutate clue cell state
  assert.equal(engine.setCell(0, 1, CELL_BLACK), false);
  assert.equal(engine.getCell(0, 1), CELL_EMPTY);
});

test('YajilinEngine: Cell State Cycling & Black Stone Placement', () => {
  const engine = new YajilinEngine(4, 4);
  assert.equal(engine.getCell(1, 1), CELL_EMPTY);

  // Empty -> Black -> Dot -> Empty
  const s1 = engine.cycleCell(1, 1);
  assert.equal(s1, CELL_BLACK);
  assert.equal(engine.getCell(1, 1), CELL_BLACK);

  const s2 = engine.cycleCell(1, 1);
  assert.equal(s2, CELL_DOT);
  assert.equal(engine.getCell(1, 1), CELL_DOT);

  const s3 = engine.cycleCell(1, 1);
  assert.equal(s3, CELL_EMPTY);
  assert.equal(engine.getCell(1, 1), CELL_EMPTY);
});

test('YajilinEngine: Edge Management & Loop Segment Toggling', () => {
  const clues = [{ r: 0, c: 0, dir: DIR_RIGHT, count: 0 }];
  const engine = new YajilinEngine(3, 3, clues);

  // Connect (0, 1) to (0, 2)
  assert.equal(engine.hasEdge(0, 1, 0, 2), false);
  const toggledOn = engine.toggleEdge(0, 1, 0, 2);
  assert.equal(toggledOn, true);
  assert.equal(engine.hasEdge(0, 1, 0, 2), true);
  assert.equal(engine.hasEdge(0, 2, 0, 1), true);

  // Both endpoints become CELL_DOT
  assert.equal(engine.getCell(0, 1), CELL_DOT);
  assert.equal(engine.getCell(0, 2), CELL_DOT);

  // Toggle off
  const toggledOff = engine.toggleEdge(0, 1, 0, 2);
  assert.equal(toggledOff, false);
  assert.equal(engine.hasEdge(0, 1, 0, 2), false);

  // Cannot connect to clue cell
  assert.equal(engine.toggleEdge(0, 0, 0, 1), false);
});

test('YajilinEngine: No Adjacent Black Stones Constraint', () => {
  const engine = new YajilinEngine(4, 4);
  engine.setCell(1, 1, CELL_BLACK);
  engine.setCell(2, 2, CELL_BLACK); // Diagonal touch is allowed
  assert.equal(engine.checkNoAdjacentBlack().valid, true);

  engine.setCell(1, 2, CELL_BLACK); // Orthogonal touch with (1, 1) and (2, 2)
  const adj = engine.checkNoAdjacentBlack();
  assert.equal(adj.valid, false);
  assert.ok(adj.conflicts.length >= 1);
});

test('YajilinEngine: Arrow Ray Calculation & Status Validation', () => {
  const clues = [
    { r: 1, c: 0, dir: DIR_RIGHT, count: 1 },
    { r: 3, c: 2, dir: DIR_UP, count: 1 }
  ];
  const engine = new YajilinEngine(4, 4, clues);

  // Initially under
  let st = engine.getClueStatuses();
  assert.equal(st[0].state, 'under');
  assert.equal(st[0].current, 0);

  // Place stone in ray
  engine.setCell(1, 2, CELL_BLACK);
  st = engine.getClueStatuses();
  assert.equal(st[0].state, 'satisfied');
  assert.equal(st[0].current, 1);
  assert.equal(st[1].state, 'satisfied');
  assert.equal(st[1].current, 1);

  // Place another stone in ray -> over
  engine.setCell(1, 3, CELL_BLACK);
  st = engine.getClueStatuses();
  assert.equal(st[0].state, 'over');
  assert.equal(st[0].current, 2);
});

test('YajilinEngine: Loop Graph Degree & Cycle Structure Analysis', () => {
  const engine = new YajilinEngine(3, 3);
  // Place black stone in center (1, 1)
  engine.setCell(1, 1, CELL_BLACK);

  // Create loop around perimeter of 3x3: (0,0)-(0,1)-(0,2)-(1,2)-(2,2)-(2,1)-(2,0)-(1,0)-(0,0)
  const ring = [
    [0, 0], [0, 1], [0, 2],
    [1, 2], [2, 2], [2, 1],
    [2, 0], [1, 0]
  ];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const nxt = ring[(i + 1) % ring.length];
    engine.toggleEdge(cur[0], cur[1], nxt[0], nxt[1]);
  }

  const loop = engine.checkLoopStructure();
  assert.equal(loop.invalidDegrees.length, 0);
  assert.equal(loop.cycleCount, 1);
  assert.equal(loop.isCompleteCycle, true);
});

test('YajilinEngine: Deductive Hint Engine', () => {
  const clues = [
    { r: 0, c: 0, dir: DIR_RIGHT, count: 0 },
    { r: 3, c: 3, dir: DIR_UP, count: 1 }
  ];
  const engine = new YajilinEngine(4, 4, clues);

  // Zero clue ray hint
  const h1 = engine.getHint();
  assert.ok(h1);
  assert.equal(h1.suggestedState, CELL_DOT);

  // Adjacent black stone hint
  engine.setCell(2, 2, CELL_BLACK);
  const h2 = engine.getHint();
  assert.ok(h2);
  assert.equal(h2.suggestedState, CELL_DOT);
});

test('Levels Verification: All 50 Levels Verified', () => {
  assert.equal(LEVEL_PACKS.length, 5);
  let totalLevels = 0;

  for (const pack of LEVEL_PACKS) {
    assert.equal(pack.levels.length, 10);
    for (const lvl of pack.levels) {
      totalLevels++;
      assert.ok(lvl.width >= 6);
      assert.ok(lvl.height >= 6);
      assert.ok(lvl.clues.length >= 2);

      const engine = new YajilinEngine(lvl.width, lvl.height, lvl.clues);
      for (const b of lvl.solution.blackStones) {
        engine.setCell(b.r, b.c, CELL_BLACK);
      }

      // Adjacency check
      const adj = engine.checkNoAdjacentBlack();
      assert.equal(adj.valid, true, `Level ${lvl.id} has touching black stones!`);

      // Clues check
      const statuses = engine.getClueStatuses();
      for (const st of statuses) {
        assert.equal(
          st.current,
          st.target,
          `Level ${lvl.id} clue at (${st.r},${st.c}) has mismatch: ${st.current} vs ${st.target}`
        );
      }
    }
  }

  assert.equal(totalLevels, 50);
});
