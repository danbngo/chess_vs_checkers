// ─── Standard Go group utilities ─────────────────────────────────────────────
// A "group" is all same-team stones connected orthogonally.
// A group's "liberties" are the empty squares adjacent to any stone in the group.

function getGroup(startR, startC, board, team) {
  const group = [];
  const visited = new Set();
  const q = [[startR, startC]];
  let head = 0;
  while (head < q.length) {
    const [r, c] = q[head++];
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    const key = r * COLS + c;
    if (visited.has(key)) continue;
    if (board[r]?.[c]?.team !== team) continue;
    visited.add(key);
    group.push([r, c]);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]])
      q.push([r+dr, c+dc]);
  }
  return group;
}

function getGroupLiberties(group, board) {
  const libs = new Set();
  for (const [r, c] of group)
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r+dr, nc = c+dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !board[nr]?.[nc])
        libs.add(nr * COLS + nc);
    }
  return libs.size;
}

function findDeadGroups(team, board) {
  const visited = new Set();
  const dead = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (board[r][c]?.team !== team) continue;
    const key = r * COLS + c;
    if (visited.has(key)) continue;
    const group = getGroup(r, c, board, team);
    group.forEach(([gr, gc]) => visited.add(gr * COLS + gc));
    if (getGroupLiberties(group, board) === 0) dead.push(group);
  }
  return dead;
}

// ─── Territory ────────────────────────────────────────────────────────────────
// Go territory = squares not reachable from the board boundary through non-go squares.
// Includes go stones themselves + everything enclosed by them.

function findReachableSquares() {
  const reach = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  const q = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if ((r===0||r===ROWS-1||c===0||c===COLS-1) && state.board[r][c]?.team !== 'go') {
      reach[r][c] = true; q.push([r, c]);
    }
  let head = 0;
  while (head < q.length) {
    const [r, c] = q[head++];
    for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr=r+dr, nc=c+dc;
      if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!reach[nr][nc]&&state.board[nr][nc]?.team!=='go') {
        reach[nr][nc]=true; q.push([nr,nc]);
      }
    }
  }
  return reach;
}

function countGoTerritory() {
  const reach = findReachableSquares();
  let count = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (!reach[r][c]) count++;
  return count;
}

// ─── Capture application ──────────────────────────────────────────────────────
function applyGoCaptures() {
  // Remove go groups with 0 liberties (chess has surrounded them)
  const dead = findDeadGroups('go', state.board);
  if (!dead.length) return false;
  for (const group of dead)
    for (const [r, c] of group) {
      const stone = state.board[r][c];
      state.goPieces = state.goPieces.filter(g => g.id !== stone.id);
      state.capturedGoByChess.push({ id: stone.id });
    }
  syncBoard(); renderStrips();
  return true;
}

function applyChessCaptures() {
  // Remove chess groups with 0 liberties (go has surrounded them)
  const dead = findDeadGroups('chess', state.board);
  if (!dead.length) return false;
  let kingDied = false;
  for (const group of dead)
    for (const [r, c] of group) {
      const piece = state.board[r][c];
      if (piece.type === 'king') kingDied = true;
      state.capturedByGo.push(piece.type);
      state.chessPieces = state.chessPieces.filter(p => p.id !== piece.id);
    }
  syncBoard(); renderStrips();
  return kingDied;
}

// ─── Go AI ────────────────────────────────────────────────────────────────────
function isGoSuicide(r, c, board) {
  // Placing at (r,c) is suicide if the resulting go group has 0 liberties
  // and does not simultaneously capture any chess groups (the one exception).
  const temp = board.map(row => [...row]);
  temp[r][c] = { team: 'go', row: r, col: c, id: -1 };
  // Apply any chess captures the placement triggers
  const deadChess = findDeadGroups('chess', temp);
  for (const group of deadChess) for (const [gr, gc] of group) temp[gr][gc] = null;
  const group = getGroup(r, c, temp, 'go');
  return getGroupLiberties(group, temp) === 0;
}

function goAIPlace() {
  syncBoard();
  const empties = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (!state.board[r][c]) empties.push([r, c]);
  if (!empties.length) return false;

  const valid = empties.filter(([r, c]) => !isGoSuicide(r, c, state.board));
  if (!valid.length) return false;

  // Prefer squares adjacent to existing go stones to build connected groups
  const adj = valid.filter(([r, c]) =>
    [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc]) => state.board[r+dr]?.[c+dc]?.team === 'go')
  );
  const pool = adj.length > 0 && Math.random() < 0.7 ? adj : valid;
  const [r, c] = pool[Math.floor(Math.random() * pool.length)];
  state.goPieces.push({ team: 'go', row: r, col: c, id: newId() });
  return true;
}

function runGoTurn() {
  if (state.phase !== 'go_move') return;

  const placed = goAIPlace();
  syncBoard();

  if (placed) {
    const kingDied = applyChessCaptures();
    updateUI();

    if (kingDied) { gameLost(); return; }
    if (!state.chessPieces.some(p => !p.dying)) { gameLost(); return; }

    // Go territory domination: if go controls more than half the board, go wins
    const goArea = countGoTerritory();
    if (goArea > 32) {
      state.phase = 'wave_end';
      showMessage('Territory Dominated!',
        `Go stones control ${goArea} of 64 squares — your army is overwhelmed.`,
        () => {
          state.dollars = 0; state.shop = []; state.moveCount = 0; state.nextId = 0;
          startGoWave(1, initialChessPieces());
        });
      return;
    }
  }

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

  // Place starting stones, retrying if they would immediately create dead chess groups
  let attempts = 0;
  do {
    state.goPieces = goStartPositions(cfg.startStones)
      .map(([r, c]) => ({ team: 'go', row: r, col: c, id: newId() }));
    syncBoard();
    attempts++;
  } while (attempts < 10 && findDeadGroups('chess', state.board).length > 0);

  state.waveCheckerCount = cfg.startStones;
  syncBoard(); updateUI(); renderStrips();
}
