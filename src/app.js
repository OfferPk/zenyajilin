/**
 * ZenYajilin - Game Controller & SVG Board Renderer
 */

(function () {
  'use strict';

  // Game State
  let packs = [];
  let currentPackIdx = 0;
  let currentLevelIdx = 0;
  let engine = null;
  let currentLevelData = null;

  let toolMode = 'loop'; // 'loop' | 'stone' | 'dot'
  let selectedClue = null;
  let highlightedCell = null;
  let undoStack = [];
  let moveCount = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let isLevelCompleted = false;

  // Drag-to-connect state
  let isDragging = false;
  let dragLastCell = null;

  // LocalStorage keys
  const STORAGE_COMPLETED = 'zenyajilin_completed';
  const STORAGE_CURRENT = 'zenyajilin_current';

  function getCompletedSet() {
    try {
      const data = localStorage.getItem(STORAGE_COMPLETED);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function markLevelCompleted(levelId) {
    try {
      const set = getCompletedSet();
      set.add(levelId);
      localStorage.setItem(STORAGE_COMPLETED, JSON.stringify([...set]));
    } catch (e) {}
  }

  function saveCurrentLevel(packIdx, levelIdx) {
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify({ packIdx, levelIdx }));
    } catch (e) {}
  }

  function loadCurrentLevel() {
    try {
      const data = localStorage.getItem(STORAGE_CURRENT);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed.packIdx === 'number' && typeof parsed.levelIdx === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { packIdx: 0, levelIdx: 0 };
  }

  // DOM Elements
  const elGrid = document.getElementById('grid-container');
  const elPackName = document.getElementById('pack-name');
  const elLevelName = document.getElementById('level-name');
  const elStatClues = document.getElementById('stat-clues');
  const elStatStones = document.getElementById('stat-stones');
  const elStatTime = document.getElementById('stat-time');

  const elBtnSound = document.getElementById('btn-sound');
  const elBtnRules = document.getElementById('btn-rules');
  const elBtnLevels = document.getElementById('btn-levels');
  const elBtnUndo = document.getElementById('btn-undo');
  const elBtnHint = document.getElementById('btn-hint');
  const elBtnReset = document.getElementById('btn-reset');

  const elToolLoop = document.getElementById('tool-loop');
  const elToolStone = document.getElementById('tool-stone');
  const elToolDot = document.getElementById('tool-dot');

  const elHintBanner = document.getElementById('hint-banner');
  const elHintText = document.getElementById('hint-text');
  const elBtnCloseHint = document.getElementById('btn-close-hint');

  const elRulesModal = document.getElementById('rules-modal');
  const elBtnCloseRules = document.getElementById('btn-close-rules');
  const elBtnStartPlaying = document.getElementById('btn-start-playing');

  const elLevelsModal = document.getElementById('levels-modal');
  const elBtnCloseLevels = document.getElementById('btn-close-levels');
  const elPackTabs = document.getElementById('pack-tabs');
  const elLevelsGrid = document.getElementById('levels-grid');

  const elVictoryModal = document.getElementById('victory-modal');
  const elVstatTime = document.getElementById('vstat-time');
  const elVstatMoves = document.getElementById('vstat-moves');
  const elVstatStones = document.getElementById('vstat-stones');
  const elBtnNextLevel = document.getElementById('btn-next-level');
  const elBtnReplay = document.getElementById('btn-replay');

  // Initialization
  function init() {
    if (typeof LEVEL_PACKS !== 'undefined') {
      packs = LEVEL_PACKS;
    } else {
      console.error('LEVEL_PACKS not loaded');
      return;
    }

    const saved = loadCurrentLevel();
    currentPackIdx = Math.min(saved.packIdx, packs.length - 1);
    currentLevelIdx = Math.min(saved.levelIdx, packs[currentPackIdx].levels.length - 1);

    updateSoundButton();
    setupEventListeners();
    loadLevel(currentPackIdx, currentLevelIdx);

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }

  function startTimer() {
    stopTimer();
    elapsedSeconds = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateTimerDisplay() {
    if (elStatTime) elStatTime.textContent = formatTime(elapsedSeconds);
  }

  function loadLevel(packIdx, levelIdx) {
    currentPackIdx = packIdx;
    currentLevelIdx = levelIdx;
    saveCurrentLevel(packIdx, levelIdx);

    const pack = packs[packIdx];
    currentLevelData = pack.levels[levelIdx];
    engine = new YajilinEngine(currentLevelData.width, currentLevelData.height, currentLevelData.clues);

    undoStack = [];
    moveCount = 0;
    isLevelCompleted = false;
    selectedClue = null;
    highlightedCell = null;
    hideHint();

    elPackName.textContent = pack.name;
    elLevelName.textContent = `Chamber ${currentLevelData.number} (${currentLevelData.width}×${currentLevelData.height})`;

    startTimer();
    renderBoard();
    updateStats();
  }

  function saveUndoState() {
    undoStack.push(engine.cloneState());
    if (undoStack.length > 50) undoStack.shift();
  }

  function handleUndo() {
    if (undoStack.length === 0 || isLevelCompleted) return;
    const prev = undoStack.pop();
    engine.loadState(prev);
    sound.playCellClear();
    renderBoard();
    updateStats();
  }

  function handleReset() {
    if (isLevelCompleted) return;
    saveUndoState();
    const blank = Array.from({ length: engine.height }, () => Array(engine.width).fill(CELL_EMPTY));
    for (let r = 0; r < engine.height; r++) {
      for (let c = 0; c < engine.width; c++) {
        engine.setCell(r, c, CELL_EMPTY);
        engine.clearCellEdges(r, c);
      }
    }
    sound.playCellClear();
    renderBoard();
    updateStats();
  }

  function setToolMode(mode) {
    toolMode = mode;
    [elToolLoop, elToolStone, elToolDot].forEach(btn => btn && btn.classList.remove('active'));
    if (mode === 'loop' && elToolLoop) elToolLoop.classList.add('active');
    if (mode === 'stone' && elToolStone) elToolStone.classList.add('active');
    if (mode === 'dot' && elToolDot) elToolDot.classList.add('active');
  }

  // Cell Interaction
  function handleCellClick(r, c) {
    if (isLevelCompleted) return;

    // If clicking clue cell, toggle ray highlight
    if (engine.isClue(r, c)) {
      if (selectedClue && selectedClue.r === r && selectedClue.c === c) {
        selectedClue = null;
      } else {
        selectedClue = { r, c };
        sound.playDotPlace();
      }
      renderBoard();
      return;
    }

    saveUndoState();
    moveCount++;
    const cur = engine.getCell(r, c);

    if (toolMode === 'stone') {
      const next = cur === CELL_BLACK ? CELL_EMPTY : CELL_BLACK;
      engine.setCell(r, c, next);
      if (next === CELL_BLACK) {
        sound.playStonePlace();
        const adj = engine.checkNoAdjacentBlack();
        if (!adj.valid) sound.playConflictWarning();
      } else {
        sound.playCellClear();
      }
    } else if (toolMode === 'dot') {
      const next = cur === CELL_DOT ? CELL_EMPTY : CELL_DOT;
      engine.setCell(r, c, next);
      if (next === CELL_DOT) sound.playDotPlace();
      else sound.playCellClear();
    } else if (toolMode === 'loop') {
      // Loop mode tap: cycle empty -> dot -> black -> empty
      const next = engine.cycleCell(r, c);
      if (next === CELL_BLACK) {
        sound.playStonePlace();
        const adj = engine.checkNoAdjacentBlack();
        if (!adj.valid) sound.playConflictWarning();
      } else if (next === CELL_DOT) {
        sound.playDotPlace();
      } else {
        sound.playCellClear();
      }
    }

    if (highlightedCell && highlightedCell.r === r && highlightedCell.c === c) {
      hideHint();
    }

    renderBoard();
    updateStats();
    checkVictory();
  }

  // Pointer / Drag-to-connect handling
  function handleDragConnect(r1, c1, r2, c2) {
    if (isLevelCompleted) return;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    if (engine.isClue(r1, c1) || engine.isClue(r2, c2)) return;

    saveUndoState();
    moveCount++;
    const added = engine.toggleEdge(r1, c1, r2, c2);
    if (added) {
      sound.playLoopDraw();
    } else {
      sound.playCellClear();
    }

    renderBoard();
    updateStats();
    checkVictory();
  }

  function checkVictory() {
    const val = engine.validate();
    if (val.isComplete) {
      isLevelCompleted = true;
      stopTimer();
      markLevelCompleted(currentLevelData.id);
      sound.playVictoryGong();

      setTimeout(() => {
        elVstatTime.textContent = formatTime(elapsedSeconds);
        elVstatMoves.textContent = moveCount.toString();
        let blackCount = 0;
        for (let r = 0; r < engine.height; r++) {
          for (let c = 0; c < engine.width; c++) {
            if (engine.getCell(r, c) === CELL_BLACK) blackCount++;
          }
        }
        elVstatStones.textContent = blackCount.toString();
        elVictoryModal.classList.remove('hidden');
      }, 400);
    }
  }

  function updateStats() {
    const clueStatuses = engine.getClueStatuses();
    const satisfiedCount = clueStatuses.filter(s => s.state === 'satisfied').length;
    elStatClues.textContent = `${satisfiedCount} / ${clueStatuses.length}`;

    let blackCount = 0;
    for (let r = 0; r < engine.height; r++) {
      for (let c = 0; c < engine.width; c++) {
        if (engine.getCell(r, c) === CELL_BLACK) blackCount++;
      }
    }
    elStatStones.textContent = blackCount.toString();
  }

  // SVG Board Rendering
  function renderBoard() {
    const w = engine.width;
    const h = engine.height;
    const cellSize = 54;
    const totalW = w * cellSize;
    const totalH = h * cellSize;

    // Ray cells to highlight
    const rayCellKeys = new Set();
    if (selectedClue) {
      const clue = engine.getClue(selectedClue.r, selectedClue.c);
      if (clue) {
        const ray = engine.getArrowRayCells(clue);
        for (const cell of ray) {
          rayCellKeys.add(`${cell.r},${cell.c}`);
        }
      }
    }

    let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">`;

    // Gradients & Filters
    svg += `
      <defs>
        <radialGradient id="stoneGradient" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stop-color="#4a5752" />
          <stop offset="50%" stop-color="#242e2a" />
          <stop offset="100%" stop-color="#0d1411" />
        </radialGradient>
        <filter id="stoneDropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.4" />
        </filter>
        <filter id="hintGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;

    // 1. Grid Background Cells & Ray Highlights
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const isRay = rayCellKeys.has(`${r},${c}`);
        const rayFill = isRay ? 'rgba(74, 222, 128, 0.2)' : 'transparent';

        svg += `<rect class="svg-cell ${isRay ? 'svg-ray-active' : ''}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${rayFill}" stroke="#d8d3c5" stroke-width="1.2" data-r="${r}" data-c="${c}" />`;
      }
    }

    // 2. Hint Highlight Rect
    if (highlightedCell) {
      const hx = highlightedCell.c * cellSize + 2;
      const hy = highlightedCell.r * cellSize + 2;
      svg += `<rect x="${hx}" y="${hy}" width="${cellSize - 4}" height="${cellSize - 4}" rx="8" fill="rgba(74, 222, 128, 0.3)" stroke="#4ade80" stroke-width="3" filter="url(#hintGlow)" />`;
    }

    // 3. Loop Edge Tracks (Lines from center to center)
    const drawnEdges = new Set();
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const dirs = engine.getCellEdges(r, c);
        const x1 = c * cellSize + cellSize / 2;
        const y1 = r * cellSize + cellSize / 2;

        for (const dir of dirs) {
          let nr = r, nc = c;
          if (dir === 'N') nr--;
          if (dir === 'S') nr++;
          if (dir === 'W') nc--;
          if (dir === 'E') nc++;

          const edgeKey = r < nr || (r === nr && c < nc) ? `${r},${c}-${nr},${nc}` : `${nr},${nc}-${r},${c}`;
          if (!drawnEdges.has(edgeKey)) {
            drawnEdges.add(edgeKey);
            const x2 = nc * cellSize + cellSize / 2;
            const y2 = nr * cellSize + cellSize / 2;

            // Outer line shadow
            svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(20,25,23,0.3)" stroke-width="12" stroke-linecap="round" />`;
            // Core loop track
            svg += `<line class="svg-loop-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1f2c25" stroke-width="6" stroke-linecap="round" />`;
            svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4ade80" stroke-width="2" stroke-linecap="round" opacity="0.9" />`;
          }
        }
      }
    }

    // 4. Clue Tiles, Stones, and Dots
    const clueStatuses = engine.getClueStatuses();
    const clueStatusMap = new Map();
    for (const st of clueStatuses) {
      clueStatusMap.set(`${st.r},${st.c}`, st);
    }

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2;
        const state = engine.getCell(r, c);
        const isClue = engine.isClue(r, c);

        if (isClue) {
          const clue = engine.getClue(r, c);
          const st = clueStatusMap.get(`${r},${c}`) || { state: 'under' };
          const isSel = selectedClue && selectedClue.r === r && selectedClue.c === c;
          const pad = 4;
          const tx = c * cellSize + pad;
          const ty = r * cellSize + pad;
          const tw = cellSize - pad * 2;
          const th = cellSize - pad * 2;

          // Arrow symbols
          let arrowSvg = '';
          if (clue.dir === 'U') arrowSvg = `M ${cx} ${cy - 2} L ${cx} ${cy - 14} M ${cx - 5} ${cy - 9} L ${cx} ${cy - 14} L ${cx + 5} ${cy - 9}`;
          else if (clue.dir === 'D') arrowSvg = `M ${cx} ${cy - 14} L ${cx} ${cy - 2} M ${cx - 5} ${cy - 7} L ${cx} ${cy - 2} L ${cx + 5} ${cy - 7}`;
          else if (clue.dir === 'L') arrowSvg = `M ${cx + 6} ${cy - 8} L ${cx - 6} ${cy - 8} M ${cx - 1} ${cy - 13} L ${cx - 6} ${cy - 8} L ${cx - 1} ${cy - 3}`;
          else if (clue.dir === 'R') arrowSvg = `M ${cx - 6} ${cy - 8} L ${cx + 6} ${cy - 8} M ${cx + 1} ${cy - 13} L ${cx + 6} ${cy - 8} L ${cx + 1} ${cy - 3}`;

          svg += `
            <g class="svg-clue-tile ${st.state} ${isSel ? 'selected' : ''}" data-r="${r}" data-c="${c}">
              <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="8" fill="#1e2723" stroke="${isSel ? '#facc15' : '#48bb78'}" stroke-width="${isSel ? 3 : 2}" />
              <path d="${arrowSvg}" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <text x="${cx}" y="${cy + 16}" font-family="-apple-system, BlinkMacSystemFont, Roboto, sans-serif" font-size="16" font-weight="900" text-anchor="middle" fill="#f0fdf4">${clue.count}</text>
            </g>
          `;
        } else if (state === CELL_BLACK) {
          const radius = cellSize * 0.38;
          svg += `
            <g class="svg-stone" data-r="${r}" data-c="${c}">
              <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#stoneGradient)" stroke="#48bb78" stroke-width="1.5" filter="url(#stoneDropShadow)" />
              <ellipse cx="${cx - radius * 0.28}" cy="${cy - radius * 0.28}" rx="${radius * 0.32}" ry="${radius * 0.2}" fill="rgba(255,255,255,0.2)" transform="rotate(-30 ${cx - radius * 0.28} ${cy - radius * 0.28})" />
            </g>
          `;
        } else if (state === CELL_DOT) {
          const radius = cellSize * 0.12;
          svg += `
            <g class="svg-dot" data-r="${r}" data-c="${c}">
              <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#5a7367" />
            </g>
          `;
        }
      }
    }

    svg += '</svg>';
    elGrid.innerHTML = svg;

    // Attach interaction listeners
    elGrid.querySelectorAll('.svg-cell, .svg-clue-tile, .svg-stone, .svg-dot').forEach(el => {
      el.addEventListener('click', (e) => {
        const r = parseInt(el.getAttribute('data-r'), 10);
        const c = parseInt(el.getAttribute('data-c'), 10);
        if (!isNaN(r) && !isNaN(c)) {
          handleCellClick(r, c);
        }
      });

      // Pointer drag listeners for Loop drawing
      el.addEventListener('pointerdown', (e) => {
        if (toolMode === 'loop') {
          isDragging = true;
          const r = parseInt(el.getAttribute('data-r'), 10);
          const c = parseInt(el.getAttribute('data-c'), 10);
          dragLastCell = { r, c };
        }
      });

      el.addEventListener('pointerenter', (e) => {
        if (isDragging && toolMode === 'loop' && dragLastCell) {
          const r = parseInt(el.getAttribute('data-r'), 10);
          const c = parseInt(el.getAttribute('data-c'), 10);
          if (!isNaN(r) && !isNaN(c)) {
            if (dragLastCell.r !== r || dragLastCell.c !== c) {
              handleDragConnect(dragLastCell.r, dragLastCell.c, r, c);
              dragLastCell = { r, c };
            }
          }
        }
      });
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
      dragLastCell = null;
    });
  }

  // Hint Logic
  function handleHint() {
    if (isLevelCompleted) return;
    const hint = engine.getHint();
    if (!hint) {
      showHint('The garden is in balance so far! Keep weaving the loop.');
      return;
    }

    highlightedCell = { r: hint.r, c: hint.c };
    renderBoard();
    showHint(hint.message);
  }

  function showHint(msg) {
    elHintText.textContent = msg;
    elHintBanner.classList.remove('hidden');
  }

  function hideHint() {
    highlightedCell = null;
    elHintBanner.classList.add('hidden');
  }

  // Sound Button
  function updateSoundButton() {
    if (elBtnSound) {
      elBtnSound.textContent = sound.isSoundEnabled() ? '🔊' : '🔇';
    }
  }

  // Level Selector Modal
  function showLevelsModal() {
    renderPackTabs();
    renderLevelsGrid(currentPackIdx);
    elLevelsModal.classList.remove('hidden');
  }

  function hideLevelsModal() {
    elLevelsModal.classList.add('hidden');
  }

  function renderPackTabs() {
    elPackTabs.innerHTML = '';
    packs.forEach((pack, idx) => {
      const tab = document.createElement('button');
      tab.className = `pack-tab ${idx === currentPackIdx ? 'active' : ''}`;
      tab.textContent = `${pack.name} (${pack.width}×${pack.height})`;
      tab.addEventListener('click', () => {
        elPackTabs.querySelectorAll('.pack-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLevelsGrid(idx);
      });
      elPackTabs.appendChild(tab);
    });
  }

  function renderLevelsGrid(packIdx) {
    elLevelsGrid.innerHTML = '';
    const completedSet = getCompletedSet();
    const pack = packs[packIdx];

    pack.levels.forEach((lvl, lvlIdx) => {
      const tile = document.createElement('div');
      const isDone = completedSet.has(lvl.id);
      const isCur = packIdx === currentPackIdx && lvlIdx === currentLevelIdx;

      tile.className = `level-tile ${isDone ? 'completed' : ''} ${isCur ? 'active' : ''}`;
      tile.innerHTML = `
        <span class="level-num">${lvl.number}</span>
        <span class="level-check">${isDone ? '✓ Done' : ''}</span>
      `;
      tile.addEventListener('click', () => {
        hideLevelsModal();
        loadLevel(packIdx, lvlIdx);
      });
      elLevelsGrid.appendChild(tile);
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    elBtnSound.addEventListener('click', () => {
      sound.toggleSound();
      updateSoundButton();
    });

    elBtnRules.addEventListener('click', () => {
      elRulesModal.classList.remove('hidden');
    });

    elBtnCloseRules.addEventListener('click', () => {
      elRulesModal.classList.add('hidden');
    });

    elBtnStartPlaying.addEventListener('click', () => {
      elRulesModal.classList.add('hidden');
    });

    elBtnLevels.addEventListener('click', showLevelsModal);
    elBtnCloseLevels.addEventListener('click', hideLevelsModal);

    elBtnUndo.addEventListener('click', handleUndo);
    elBtnReset.addEventListener('click', handleReset);
    elBtnHint.addEventListener('click', handleHint);
    elBtnCloseHint.addEventListener('click', hideHint);

    elToolLoop.addEventListener('click', () => setToolMode('loop'));
    elToolStone.addEventListener('click', () => setToolMode('stone'));
    elToolDot.addEventListener('click', () => setToolMode('dot'));

    // Victory Actions
    elBtnNextLevel.addEventListener('click', () => {
      elVictoryModal.classList.add('hidden');
      const pack = packs[currentPackIdx];
      if (currentLevelIdx + 1 < pack.levels.length) {
        loadLevel(currentPackIdx, currentLevelIdx + 1);
      } else if (currentPackIdx + 1 < packs.length) {
        loadLevel(currentPackIdx + 1, 0);
      } else {
        loadLevel(0, 0);
      }
    });

    elBtnReplay.addEventListener('click', () => {
      elVictoryModal.classList.add('hidden');
      loadLevel(currentPackIdx, currentLevelIdx);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        sound.toggleSound();
        updateSoundButton();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'h' || e.key === 'H') {
        handleHint();
      } else if (e.key === '1') {
        setToolMode('loop');
      } else if (e.key === '2') {
        setToolMode('stone');
      } else if (e.key === '3') {
        setToolMode('dot');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
