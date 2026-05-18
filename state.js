// ─── Game state ───────────────────────────────────────────────────────────────
let state = {
  wave: 1,
  dollars: 0,
  moveCount: 0,
  waveCheckerCount: 0,
  shop: [],
  board: null,
  chessPieces: [],
  checkers: [],
  selected: null,
  phase: 'player',
  nextId: 0,
  enPassantCheckers: new Set(),
  capturedByChess: [],
  capturedByCheckers: [],
  revivedPieces: [],  // iron pieces waiting to return next wave
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function newId()  { return state.nextId++; }
function emptyBoard() { return Array.from({length: ROWS}, () => Array(COLS).fill(null)); }
function toChessNotation(row, col) { return String.fromCharCode(97 + col) + (8 - row); }

function syncBoard() {
  state.board = emptyBoard();
  for (const p of state.chessPieces) if (!p.dying) state.board[p.row][p.col] = p;
  for (const c of state.checkers)    if (!c.dying) state.board[c.row][c.col] = c;
}

// ─── Placement helpers ────────────────────────────────────────────────────────
function fisherYates(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function checkerStartPositions(count) {
  const pri = [], ov = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) if ((r+c)%2===1) pri.push([r,c]);
  for (let r = 2; r < 4; r++) for (let c = 0; c < COLS; c++) if ((r+c)%2===1) ov.push([r,c]);
  fisherYates(pri); fisherYates(ov);
  return [...pri, ...ov].slice(0, count);
}

// ─── Placement ────────────────────────────────────────────────────────────────
// Non-pawns go to row 7 (canonical chess positions first, then left-to-right overflow).
// Pawns go to row 6 (canonical center-out positions first, then left-to-right overflow).
function assignPlacements(pieces) {
  const takenBack  = new Set();
  const takenFront = new Set();
  const result     = [];
  const typeCounts = {};

  for (const p of pieces.filter(q => q.type !== 'pawn')) {
    const idx       = typeCounts[p.type] ?? 0;
    typeCounts[p.type] = idx + 1;
    const canonical = (CHESS_SLOTS[p.type] || [])[idx];
    if (canonical && !takenBack.has(canonical[1])) {
      takenBack.add(canonical[1]);
      result.push({ piece: p, row: 7, col: canonical[1] });
    } else {
      let col = -1;
      for (let c = 0; c < 8; c++) { if (!takenBack.has(c)) { col = c; break; } }
      if (col >= 0) { takenBack.add(col); result.push({ piece: p, row: 7, col }); }
    }
  }

  let pawnIdx = 0;
  for (const p of pieces.filter(q => q.type === 'pawn')) {
    const canonical = (CHESS_SLOTS.pawn || [])[pawnIdx++];
    if (canonical && !takenFront.has(canonical[1])) {
      takenFront.add(canonical[1]);
      result.push({ piece: p, row: 6, col: canonical[1] });
    } else {
      let col = -1;
      for (let c = 0; c < 8; c++) { if (!takenFront.has(c)) { col = c; break; } }
      if (col >= 0) { takenFront.add(col); result.push({ piece: p, row: 6, col }); }
    }
  }

  return result;
}

// ─── Wave setup ───────────────────────────────────────────────────────────────
function startWave(wave, chessPieces) {
  const cfg = getWaveConfig(wave);
  Object.assign(state, {
    wave, phase: 'player', selected: null,
    enPassantCheckers: new Set(),
    capturedByChess: [],
    capturedByCheckers: [],
    moveCount: 0,
  });
  moveAnnotation = null;

  const revived = state.revivedPieces.splice(0);   // iron pieces from last wave
  // Promoted pawns revert to pawns at wave start
  const toPlace = [...chessPieces.filter(p => !p.dying), ...revived]
    .map(p => p.promotedFrom ? { ...p, type: p.promotedFrom, promotedFrom: null } : p);
  state.chessPieces = assignPlacements(toPlace)
    .map(({ piece, row, col }) => ({
      ...piece, row, col, moved: false, dying: false, id: piece.id ?? newId(),
    }));

  const ckPos = checkerStartPositions(cfg.checkerCount);
  state.checkers = ckPos.map(([r, c], i) => ({
    type: 'checker', team: 'checker', row: r, col: c,
    isKing: !!(cfg.kingsAt && i < cfg.kingsAt),
    dying: false, id: newId(),
  }));

  state.waveCheckerCount = state.checkers.length;
  syncBoard(); updateUI(); renderStrips();

  if (wave === FLYING_KING_WAVE)
    showMessage('Flying Kings!',
      'Checker kings can now slide diagonally any distance and threaten from afar.', () => {});
}

function initialChessPieces() {
  return [
    { type: 'pawn', team: 'chess' },
    { type: 'pawn', team: 'chess' },
    { type: 'king', team: 'chess' },
    { type: 'pawn', team: 'chess' },
  ];
}
