// ─── Go wave config ───────────────────────────────────────────────────────────
function getGoWaveConfig(wave) {
  return { startStones: Math.min(2 + wave * 3, 38) };
}

function goStartPositions(count) {
  const occupied = new Set(state.chessPieces.map(p => p.row * COLS + p.col));
  const avail = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!occupied.has(r * COLS + c)) avail.push([r, c]);
  fisherYates(avail);
  return avail.slice(0, count);
}

// ─── Enclosure detection ──────────────────────────────────────────────────────
// BFS outward from the board boundary through non-go squares.
// Any chess piece square not reached is enclosed and removed.
function findReachableSquares() {
  const reach = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  const q = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) {
      if (state.board[r][c]?.team !== 'go') { reach[r][c] = true; q.push([r, c]); }
    }
  }
  let head = 0;
  while (head < q.length) {
    const [r, c] = q[head++];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r+dr, nc = c+dc;
      if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !reach[nr][nc] && state.board[nr][nc]?.team !== 'go') {
        reach[nr][nc] = true; q.push([nr, nc]);
      }
    }
  }
  return reach;
}

function checkAndApplyEnclosure() {
  syncBoard();
  const reach = findReachableSquares();
  const enclosed = state.chessPieces.filter(p => !p.dying && !reach[p.row][p.col]);
  if (!enclosed.length) return false;
  const kingEnclosed = enclosed.some(p => p.type === 'king');
  for (const p of enclosed) { state.capturedByGo.push(p.type); p.dying = true; }
  state.chessPieces = state.chessPieces.filter(p => !p.dying);
  syncBoard(); renderStrips();
  return kingEnclosed;
}

// ─── Go AI ────────────────────────────────────────────────────────────────────
function goAIPlace() {
  syncBoard();
  const empties = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (!state.board[r][c]) empties.push([r, c]);
  if (!empties.length) return false;

  // Prefer squares adjacent to existing go stones to build connected walls
  const adj = empties.filter(([r, c]) =>
    [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc]) => state.board[r+dr]?.[c+dc]?.team === 'go')
  );
  const pool = adj.length > 0 && Math.random() < 0.7 ? adj : empties;
  const [r, c] = pool[Math.floor(Math.random() * pool.length)];
  state.goPieces.push({ team: 'go', row: r, col: c, id: newId() });
  return true;
}

function runGoTurn() {
  if (state.phase !== 'go_move') return;

  goAIPlace();
  syncBoard();
  const kingDied = checkAndApplyEnclosure();
  updateUI(); renderStrips();

  if (kingDied) { gameLost(); return; }
  if (!state.chessPieces.some(p => !p.dying)) { gameLost(); return; }
  goTurnDone();
}

function goTurnDone() {
  if (!state.chessPieces.some(p => p.type === 'king' && !p.dying)) { gameLost(); return; }
  state.phase = 'player';
  syncBoard();
  const hasMove = state.chessPieces.filter(p => !p.dying).some(p => getLegalMoves(p).length > 0);
  if (!hasMove) {
    state.phase = 'wave_end';
    updateUI();
    showMessage('Stalemate!', 'You have no valid moves. You earn $0 this wave.',
      () => showShop(0, state.wave + 1));
  }
}

// ─── Go wave setup ────────────────────────────────────────────────────────────
function startGoWave(wave, chessPieces) {
  const cfg = getGoWaveConfig(wave);
  Object.assign(state, {
    campaign: 'go',
    wave, phase: 'player', selected: null,
    enPassantCheckers: new Set(),
    capturedByGo: [],
    capturedGoByChess: [],
    capturedByChess: [],
    capturedByCheckers: [],
    checkers: [],
    moveCount: 0,
  });
  moveAnnotation = null;

  const revived = state.revivedPieces.splice(0);
  const toPlace = [...chessPieces.filter(p => !p.dying), ...revived]
    .map(p => p.promotedFrom ? { ...p, type: p.promotedFrom, promotedFrom: null } : p);
  state.chessPieces = assignPlacements(toPlace)
    .map(({ piece, row, col }) => ({
      ...piece, row, col, moved: false, dying: false, id: piece.id ?? newId(),
    }));

  // Place starting stones; regenerate if they would immediately enclose chess pieces
  let attempts = 0;
  do {
    state.goPieces = goStartPositions(cfg.startStones)
      .map(([r, c]) => ({ team: 'go', row: r, col: c, id: newId() }));
    syncBoard();
    attempts++;
  } while (attempts < 10 && state.chessPieces.some(p => !findReachableSquares()[p.row][p.col]));

  state.waveCheckerCount = cfg.startStones; // reuse for earnings formula
  syncBoard(); updateUI(); renderStrips();
}
