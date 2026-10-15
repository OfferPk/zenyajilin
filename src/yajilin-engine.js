/**
 * ZenYajilin - Core Yajilin (ヤジリン / Yajirin) Logic Engine
 * 
 * Rules of Yajilin:
 * 1. Rectangular grid where some cells contain Clue Tiles with an arrow and a number
 *    (e.g., { r, c, dir: 'R', count: 1 }). Clue tiles are fixed obstacles and never part of the loop.
 * 2. Every playable cell is either a Black Stone (ink shade) or part of the loop.
 * 3. Arrow Clues: The number specifies exactly how many black stones exist in the direction
 *    of the arrow all the way to the grid border.
 * 4. No Adjacent Black Stones: Two black stones can never touch orthogonally (diagonal allowed).
 * 5. Single Continuous Loop: All cells that are neither clues nor black stones must be visited
 *    by exactly ONE single closed, non-intersecting loop.
 */

const DIR_UP = 'U';
const DIR_DOWN = 'D';
const DIR_LEFT = 'L';
const DIR_RIGHT = 'R';

const CELL_EMPTY = 0;
const CELL_BLACK = 1;
const CELL_DOT = 2; // Marked as definitely not black / open path

class YajilinEngine {
  constructor(width, height, clues = []) {
    this.width = width;
    this.height = height;
    // clues: array of { r, c, dir: 'U'|'D'|'L'|'R', count: number }
    this.clues = clues;
    this.clueMap = new Map();
    for (const cl of clues) {
      this.clueMap.set(`${cl.r},${cl.c}`, cl);
    }

    // Grid state: CELL_EMPTY | CELL_BLACK | CELL_DOT
    this.grid = Array.from({ length: height }, () => Array(width).fill(CELL_EMPTY));

    // Edges map: key "r,c" -> Set of connected neighbor directions ('N', 'S', 'W', 'E')
    this.edges = new Map();
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        this.edges.set(`${r},${c}`, new Set());
      }
    }
  }

  isClue(r, c) {
    return this.clueMap.has(`${r},${c}`);
  }

  getClue(r, c) {
    return this.clueMap.get(`${r},${c}`) || null;
  }

  getCell(r, c) {
    if (r < 0 || r >= this.height || c < 0 || c >= this.width) return null;
    return this.grid[r][c];
  }

  setCell(r, c, state) {
    if (this.isClue(r, c)) return false;
    if (r < 0 || r >= this.height || c < 0 || c >= this.width) return false;
    this.grid[r][c] = state;
    if (state === CELL_BLACK) {
      // Black cell cannot have loop edges
      this.clearCellEdges(r, c);
    }
    return true;
  }

  cycleCell(r, c) {
    if (this.isClue(r, c)) return this.grid[r][c];
    // Empty -> Black -> Dot -> Empty
    const cur = this.getCell(r, c);
    const next = (cur + 1) % 3;
    this.setCell(r, c, next);
    return next;
  }

  // --- Loop Edge Management ---
  hasEdge(r1, c1, r2, c2) {
    const key1 = `${r1},${c1}`;
    const dir = this.getDirection(r1, c1, r2, c2);
    if (!dir) return false;
    return this.edges.has(key1) && this.edges.get(key1).has(dir);
  }

  getDirection(r1, c1, r2, c2) {
    if (r1 === r2 && c1 + 1 === c2) return 'E';
    if (r1 === r2 && c1 - 1 === c2) return 'W';
    if (r1 + 1 === r2 && c1 === c2) return 'S';
    if (r1 - 1 === r2 && c1 === c2) return 'N';
    return null;
  }

  getOppositeDir(dir) {
    if (dir === 'N') return 'S';
    if (dir === 'S') return 'N';
    if (dir === 'W') return 'E';
    if (dir === 'E') return 'W';
    return null;
  }

  toggleEdge(r1, c1, r2, c2) {
    // Both cells must be valid and non-clue
    if (this.isClue(r1, c1) || this.isClue(r2, c2)) return false;
    if (r1 < 0 || r1 >= this.height || c1 < 0 || c1 >= this.width) return false;
    if (r2 < 0 || r2 >= this.height || c2 < 0 || c2 >= this.width) return false;

    // Must be orthogonally adjacent
    const dir = this.getDirection(r1, c1, r2, c2);
    if (!dir) return false;
    const opp = this.getOppositeDir(dir);

    const key1 = `${r1},${c1}`;
    const key2 = `${r2},${c2}`;

    const set1 = this.edges.get(key1);
    const set2 = this.edges.get(key2);

    if (set1.has(dir)) {
      set1.delete(dir);
      set2.delete(opp);
      return false; // Removed
    } else {
      // Cannot add edge if cell is black stone
      if (this.grid[r1][c1] === CELL_BLACK || this.grid[r2][c2] === CELL_BLACK) {
        return false;
      }
      set1.add(dir);
      set2.add(opp);
      // Ensure marked as DOT or open path
      if (this.grid[r1][c1] === CELL_EMPTY) this.grid[r1][c1] = CELL_DOT;
      if (this.grid[r2][c2] === CELL_EMPTY) this.grid[r2][c2] = CELL_DOT;
      return true; // Added
    }
  }

  clearCellEdges(r, c) {
    const key = `${r},${c}`;
    if (!this.edges.has(key)) return;
    const current = [...this.edges.get(key)];
    for (const dir of current) {
      let nr = r, nc = c;
      if (dir === 'N') nr--;
      if (dir === 'S') nr++;
      if (dir === 'W') nc--;
      if (dir === 'E') nc++;
      const nKey = `${nr},${nc}`;
      const opp = this.getOppositeDir(dir);
      this.edges.get(key).delete(dir);
      if (this.edges.has(nKey)) {
        this.edges.get(nKey).delete(opp);
      }
    }
  }

  getCellEdges(r, c) {
    const key = `${r},${c}`;
    return this.edges.get(key) ? [...this.edges.get(key)] : [];
  }

  // --- Snapshot / Clone ---
  cloneState() {
    const gridCopy = this.grid.map(row => [...row]);
    const edgesCopy = new Map();
    for (const [k, v] of this.edges) {
      edgesCopy.set(k, new Set(v));
    }
    return { grid: gridCopy, edges: edgesCopy };
  }

  loadState(snapshot) {
    this.grid = snapshot.grid.map(row => [...row]);
    this.edges = new Map();
    for (const [k, v] of snapshot.edges) {
      this.edges.set(k, new Set(v));
    }
  }

  // --- Constraint Checking ---
  checkNoAdjacentBlack(grid = this.grid) {
    const conflicts = [];
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (grid[r][c] === CELL_BLACK) {
          // Check right
          if (c + 1 < this.width && grid[r][c + 1] === CELL_BLACK) {
            conflicts.push({ r1: r, c1: c, r2: r, c2: c + 1 });
          }
          // Check down
          if (r + 1 < this.height && grid[r + 1][c] === CELL_BLACK) {
            conflicts.push({ r1: r, c1: c, r2: r + 1, c2: c });
          }
        }
      }
    }
    return { valid: conflicts.length === 0, conflicts };
  }

  getArrowRayCells(clue) {
    const cells = [];
    let dr = 0, dc = 0;
    if (clue.dir === DIR_UP) dr = -1;
    if (clue.dir === DIR_DOWN) dr = 1;
    if (clue.dir === DIR_LEFT) dc = -1;
    if (clue.dir === DIR_RIGHT) dc = 1;

    let r = clue.r + dr;
    let c = clue.c + dc;
    while (r >= 0 && r < this.height && c >= 0 && c < this.width) {
      cells.push({ r, c });
      r += dr;
      c += dc;
    }
    return cells;
  }

  getClueStatuses(grid = this.grid) {
    const statuses = [];
    for (const clue of this.clues) {
      const ray = this.getArrowRayCells(clue);
      let blackCount = 0;
      let emptyCount = 0;
      for (const cell of ray) {
        if (grid[cell.r][cell.c] === CELL_BLACK) blackCount++;
        else if (grid[cell.r][cell.c] === CELL_EMPTY) emptyCount++;
      }

      let state = 'under';
      if (blackCount === clue.count) {
        state = 'satisfied';
      } else if (blackCount > clue.count) {
        state = 'over';
      } else {
        state = 'under';
      }

      statuses.push({
        r: clue.r,
        c: clue.c,
        dir: clue.dir,
        target: clue.count,
        current: blackCount,
        empty: emptyCount,
        state,
        ray
      });
    }
    return statuses;
  }

  /**
   * Evaluates the loop graph:
   * - Degrees must be either 0 (unvisited) or 2 (valid loop segment).
   * - No branching (degree > 2) and no dead-ends (degree 1).
   * - Count closed cycles and check if exactly ONE cycle covers all open cells.
   */
  checkLoopStructure() {
    const invalidDegrees = [];
    const loopCells = [];
    let totalNonClueNonBlack = 0;

    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.isClue(r, c)) continue;

        if (this.grid[r][c] !== CELL_BLACK) {
          totalNonClueNonBlack++;
        }

        const deg = this.edges.get(`${r},${c}`).size;
        if (deg === 1 || deg > 2) {
          invalidDegrees.push({ r, c, deg });
        }
        if (deg === 2) {
          loopCells.push({ r, c });
        }
      }
    }

    // Traverse connected components
    const visited = new Set();
    const cycles = [];

    for (const start of loopCells) {
      const startKey = `${start.r},${start.c}`;
      if (visited.has(startKey)) continue;

      const comp = [];
      const queue = [startKey];
      visited.add(startKey);

      while (queue.length > 0) {
        const currKey = queue.shift();
        comp.push(currKey);
        const [cr, cc] = currKey.split(',').map(Number);
        const dirs = this.edges.get(currKey);

        for (const dir of dirs) {
          let nr = cr, nc = cc;
          if (dir === 'N') nr--;
          if (dir === 'S') nr++;
          if (dir === 'W') nc--;
          if (dir === 'E') nc++;
          const nKey = `${nr},${nc}`;
          if (!visited.has(nKey) && this.edges.has(nKey) && this.edges.get(nKey).size === 2) {
            visited.add(nKey);
            queue.push(nKey);
          }
        }
      }
      cycles.push(comp);
    }

    const isSingleCycle = cycles.length === 1 && invalidDegrees.length === 0;
    const isCompleteCycle = isSingleCycle && (cycles[0].length === totalNonClueNonBlack);

    return {
      invalidDegrees,
      cycles,
      cycleCount: cycles.length,
      loopCellCount: loopCells.length,
      totalRequiredCells: totalNonClueNonBlack,
      isSingleCycle,
      isCompleteCycle
    };
  }

  /**
   * Full validation of the game state
   */
  validate() {
    const errors = [];
    const adj = this.checkNoAdjacentBlack();
    if (!adj.valid) {
      errors.push('Black stones cannot touch horizontally or vertically.');
    }

    const clueStatuses = this.getClueStatuses();
    let allCluesSatisfied = true;
    for (const st of clueStatuses) {
      if (st.current !== st.target) {
        allCluesSatisfied = false;
        errors.push(`Arrow clue at (${st.r + 1}, ${st.c + 1}) sees ${st.current}/${st.target} stones.`);
      }
    }

    const loop = this.checkLoopStructure();
    if (loop.invalidDegrees.length > 0) {
      errors.push('Loop has dead-ends or branching intersections.');
    } else if (loop.cycleCount > 1) {
      errors.push('Multiple disconnected loops detected. Must form a single unbroken loop.');
    }

    const isComplete = adj.valid && allCluesSatisfied && loop.isCompleteCycle;
    const isValid = adj.valid && loop.invalidDegrees.length === 0 && loop.cycleCount <= 1;

    return {
      isComplete,
      isValid,
      adjValid: adj.valid,
      allCluesSatisfied,
      loop,
      errors,
      clueStatuses
    };
  }

  // --- Deductive Hint Engine ---
  getHint() {
    // 1. Error state: Adjacent black stones
    const adj = this.checkNoAdjacentBlack();
    if (!adj.valid) {
      const c = adj.conflicts[0];
      return {
        type: 'error_adjacent_black',
        r: c.r2,
        c: c.c2,
        message: `Two black stones touch at (${c.r1 + 1}, ${c.c1 + 1}) and (${c.r2 + 1}, ${c.c2 + 1}). Remove one stone.`,
        suggestedState: CELL_EMPTY
      };
    }

    // 2. Error state: Clue over-saturated
    const statuses = this.getClueStatuses();
    for (const st of statuses) {
      if (st.state === 'over') {
        return {
          type: 'error_clue_over',
          r: st.r,
          c: st.c,
          message: `Arrow clue at (${st.r + 1}, ${st.c + 1}) has too many black stones (${st.current}/${st.target}). Remove excess stones along this ray.`,
          suggestedState: CELL_EMPTY
        };
      }
    }

    // 3. Rule: Cells orthogonally adjacent to a black stone MUST be open path (dot)
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.grid[r][c] === CELL_BLACK) {
          const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
          for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && !this.isClue(nr, nc)) {
              if (this.grid[nr][nc] === CELL_EMPTY) {
                return {
                  type: 'adjacent_to_black',
                  r: nr,
                  c: nc,
                  message: `Cells adjacent to black stones must be open path. Mark (${nr + 1}, ${nc + 1}) with a path dot.`,
                  suggestedState: CELL_DOT
                };
              }
            }
          }
        }
      }
    }

    // 4. Rule: Arrow clue with 0 count -> all non-clue cells in that ray MUST be path dots
    for (const st of statuses) {
      if (st.target === 0 && st.empty > 0) {
        for (const cell of st.ray) {
          if (!this.isClue(cell.r, cell.c) && this.grid[cell.r][cell.c] === CELL_EMPTY) {
            return {
              type: 'zero_clue_ray',
              r: cell.r,
              c: cell.c,
              message: `Arrow clue with 0 at (${st.r + 1}, ${st.c + 1}) sees no black stones. Cell (${cell.r + 1}, ${cell.c + 1}) must be an open path dot.`,
              suggestedState: CELL_DOT
            };
          }
        }
      }
    }

    // 5. Rule: Clue satisfied -> all remaining empty cells in ray must be path dots
    for (const st of statuses) {
      if (st.state === 'satisfied' && st.empty > 0) {
        for (const cell of st.ray) {
          if (!this.isClue(cell.r, cell.c) && this.grid[cell.r][cell.c] === CELL_EMPTY) {
            return {
              type: 'clue_satisfied_ray',
              r: cell.r,
              c: cell.c,
              message: `Arrow clue at (${st.r + 1}, ${st.c + 1}) already has all required stones. Cell (${cell.r + 1}, ${cell.c + 1}) must be an open path dot.`,
              suggestedState: CELL_DOT
            };
          }
        }
      }
    }

    // 6. Rule: Forced black stones from clue ray capacity
    for (const st of statuses) {
      if (st.current < st.target) {
        // Collect eligible empty cells in this ray
        const eligible = [];
        for (const cell of st.ray) {
          if (!this.isClue(cell.r, cell.c) && this.grid[cell.r][cell.c] === CELL_EMPTY) {
            // Check if placing black stone here would violate adjacency
            let canBlack = true;
            const nbrs = [[cell.r - 1, cell.c], [cell.r + 1, cell.c], [cell.r, cell.c - 1], [cell.r, cell.c + 1]];
            for (const [nr, nc] of nbrs) {
              if (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && this.grid[nr][nc] === CELL_BLACK) {
                canBlack = false;
                break;
              }
            }
            if (canBlack) eligible.push(cell);
          }
        }

        // If eligible non-adjacent count exactly matches remaining needed
        const needed = st.target - st.current;
        if (eligible.length === needed) {
          const target = eligible[0];
          return {
            type: 'forced_black_stone',
            r: target.r,
            c: target.c,
            message: `Arrow clue at (${st.r + 1}, ${st.c + 1}) requires ${st.target} stones. Cell (${target.r + 1}, ${target.c + 1}) must be a black stone.`,
            suggestedState: CELL_BLACK
          };
        }
      }
    }

    // 7. Fallback: Solver comparison
    const solution = YajilinEngine.solve(this.width, this.height, this.clues);
    if (solution) {
      // Check black cell state first
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          if (this.isClue(r, c)) continue;
          const solBlack = solution.grid[r][c] === CELL_BLACK;
          const curBlack = this.grid[r][c] === CELL_BLACK;
          if (solBlack && !curBlack) {
            return {
              type: 'solver_black_stone',
              r,
              c,
              message: `By logical deduction, cell (${r + 1}, ${c + 1}) must be a black stone.`,
              suggestedState: CELL_BLACK
            };
          } else if (!solBlack && this.grid[r][c] === CELL_EMPTY) {
            return {
              type: 'solver_path_dot',
              r,
              c,
              message: `Cell (${r + 1}, ${c + 1}) must be an open path cell.`,
              suggestedState: CELL_DOT
            };
          }
        }
      }
    }

    return null;
  }

  // --- Static Backtracking Solver ---
  static solve(width, height, clues) {
    const clueMap = new Map();
    for (const cl of clues) {
      clueMap.set(`${cl.r},${cl.c}`, cl);
    }

    // Playable cells list
    const playable = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!clueMap.has(`${r},${c}`)) {
          playable.push({ r, c });
        }
      }
    }

    const grid = Array.from({ length: height }, () => Array(width).fill(CELL_EMPTY));

    function canPlaceBlack(r, c) {
      if (clueMap.has(`${r},${c}`)) return false;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
          if (grid[nr][nc] === CELL_BLACK) return false;
        }
      }
      return true;
    }

    function checkClueFeasibility() {
      for (const clue of clues) {
        let dr = 0, dc = 0;
        if (clue.dir === DIR_UP) dr = -1;
        if (clue.dir === DIR_DOWN) dr = 1;
        if (clue.dir === DIR_LEFT) dc = -1;
        if (clue.dir === DIR_RIGHT) dc = 1;

        let r = clue.r + dr;
        let c = clue.c + dc;
        let black = 0;
        let empty = 0;
        while (r >= 0 && r < height && c >= 0 && c < width) {
          if (grid[r][c] === CELL_BLACK) black++;
          else if (grid[r][c] === CELL_EMPTY) empty++;
          r += dr;
          c += dc;
        }
        if (black > clue.count) return false;
        if (black + empty < clue.count) return false;
      }
      return true;
    }

    // Recursive search for black stone configurations
    let solvedGrid = null;
    let solvedEdges = null;

    function searchBlack(idx) {
      if (solvedGrid) return;

      if (!checkClueFeasibility()) return;

      if (idx === playable.length) {
        // Verify all clues match exactly
        for (const clue of clues) {
          let dr = 0, dc = 0;
          if (clue.dir === DIR_UP) dr = -1;
          if (clue.dir === DIR_DOWN) dr = 1;
          if (clue.dir === DIR_LEFT) dc = -1;
          if (clue.dir === DIR_RIGHT) dc = 1;

          let r = clue.r + dr;
          let c = clue.c + dc;
          let black = 0;
          while (r >= 0 && r < height && c >= 0 && c < width) {
            if (grid[r][c] === CELL_BLACK) black++;
            r += dr;
            c += dc;
          }
          if (black !== clue.count) return;
        }

        // Test if a single closed loop can visit ALL non-black playable cells
        const loopEdges = findHamiltonianLoop(width, height, clueMap, grid);
        if (loopEdges) {
          solvedGrid = grid.map(row => [...row]);
          solvedEdges = loopEdges;
        }
        return;
      }

      const { r, c } = playable[idx];

      // Try DOT / non-black
      grid[r][c] = CELL_DOT;
      searchBlack(idx + 1);
      if (solvedGrid) return;

      // Try BLACK (if allowed)
      if (canPlaceBlack(r, c)) {
        grid[r][c] = CELL_BLACK;
        searchBlack(idx + 1);
        if (solvedGrid) return;
      }

      grid[r][c] = CELL_EMPTY;
    }

    searchBlack(0);

    if (solvedGrid) {
      return { grid: solvedGrid, edges: solvedEdges };
    }
    return null;
  }
}

/**
 * Backtracking solver for finding a single closed loop through all open cells.
 */
function findHamiltonianLoop(width, height, clueMap, grid) {
  const openCells = [];
  const openSet = new Set();
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!clueMap.has(`${r},${c}`) && grid[r][c] !== CELL_BLACK) {
        openCells.push({ r, c });
        openSet.add(`${r},${c}`);
      }
    }
  }

  if (openCells.length < 4) return null;

  const start = openCells[0];
  const startKey = `${start.r},${start.c}`;
  const total = openCells.length;

  const path = [startKey];
  const inPath = new Set([startKey]);
  const edgesMap = new Map();

  const dirs = [
    { dr: -1, dc: 0, dir: 'N', opp: 'S' },
    { dr: 1, dc: 0, dir: 'S', opp: 'N' },
    { dr: 0, dc: -1, dir: 'W', opp: 'E' },
    { dr: 0, dc: 1, dir: 'E', opp: 'W' }
  ];

  function searchPath(currKey) {
    const [cr, cc] = currKey.split(',').map(Number);

    if (path.length === total) {
      // Check if adjacent to startKey to close loop
      for (const d of dirs) {
        if (cr + d.dr === start.r && cc + d.dc === start.c) {
          return true; // Loop closed!
        }
      }
      return false;
    }

    for (const d of dirs) {
      const nr = cr + d.dr;
      const nc = cc + d.dc;
      const nKey = `${nr},${nc}`;
      if (openSet.has(nKey) && !inPath.has(nKey)) {
        inPath.add(nKey);
        path.push(nKey);
        if (searchPath(nKey)) return true;
        path.pop();
        inPath.delete(nKey);
      }
    }
    return false;
  }

  if (searchPath(startKey)) {
    // Reconstruct edge map
    for (let i = 0; i < path.length; i++) {
      const k1 = path[i];
      const k2 = path[(i + 1) % path.length];
      const [r1, c1] = k1.split(',').map(Number);
      const [r2, c2] = k2.split(',').map(Number);

      let d1 = 'E', d2 = 'W';
      if (r1 === r2 && c1 + 1 === c2) { d1 = 'E'; d2 = 'W'; }
      else if (r1 === r2 && c1 - 1 === c2) { d1 = 'W'; d2 = 'E'; }
      else if (r1 + 1 === r2 && c1 === c2) { d1 = 'S'; d2 = 'N'; }
      else if (r1 - 1 === r2 && c1 === c2) { d1 = 'N'; d2 = 'S'; }

      if (!edgesMap.has(k1)) edgesMap.set(k1, new Set());
      if (!edgesMap.has(k2)) edgesMap.set(k2, new Set());
      edgesMap.get(k1).add(d1);
      edgesMap.get(k2).add(d2);
    }
    return edgesMap;
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    YajilinEngine,
    CELL_EMPTY,
    CELL_BLACK,
    CELL_DOT,
    DIR_UP,
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT
  };
}
