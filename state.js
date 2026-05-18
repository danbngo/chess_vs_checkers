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

  const typeCounts = {};
  // Filter dying pieces defensively — they must never carry into the next wave.
  state.chessPieces = chessPieces.filter(p => !p.dying).map(p => {
    if (!typeCounts[p.type]) typeCounts[p.type] = 0;
    const [row, col] = getChessSlot(p.type, typeCounts[p.type]++);
    return { ...p, row, col, moved: false, dying: false, id: p.id ?? newId() };
  });

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
