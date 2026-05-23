// ─── Game state ───────────────────────────────────────────────────────────────
let state = {
  campaign: 'checkers',
  wave: 1,
  dollars: 0,
  moveCount: 0,
  waveCheckerCount: 0,
  shop: [],
  board: null,
  chessPieces: [],
  checkers: [],
  goPieces: [],
  selected: null,
  phase: 'player',
  nextId: 0,
  enPassantCheckers: new Set(),
  capturedByChess: [],
  capturedByCheckers: [],
  capturedByGo: [],
  capturedGoByChess: [],
  revivedPieces: [],
  seenKingWarning: false,
  seenLightWarning: false,
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function newId()  { return state.nextId++; }
function emptyBoard() { return Array.from({length: ROWS}, () => Array(COLS).fill(null)); }
function toChessNotation(row, col) { return String.fromCharCode(97 + col) + (8 - row); }

function syncBoard() {
  state.board = emptyBoard();
  for (const p of state.chessPieces) if (!p.dying) state.board[p.row][p.col] = p;
  for (const c of state.checkers)    if (!c.dying) state.board[c.row][c.col] = c;
  for (const g of state.goPieces)                  state.board[g.row][g.col] = g;
}

// ─── Placement helpers ────────────────────────────────────────────────────────
function fisherYates(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function checkerStartPositions(count, allowLight) {
  // Dark squares: (r+c) % 2 === 1. Light squares: (r+c) % 2 === 0.
  // Primary rows 0-1, overflow rows 2-3.
  const darkPri  = [], darkOv  = [];
  const lightPri = [], lightOv = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) {
    ((r+c)%2===1 ? darkPri : lightPri).push([r,c]);
  }
  for (let r = 2; r < 4; r++) for (let c = 0; c < COLS; c++) {
    ((r+c)%2===1 ? darkOv : lightOv).push([r,c]);
  }
  fisherYates(darkPri);  fisherYates(darkOv);
  fisherYates(lightPri); fisherYates(lightOv);

  if (!allowLight) {
    return [...darkPri, ...darkOv].slice(0, count).map(pos => ({ pos, isLight: false }));
  }

  // Each piece independently has 50% chance of being light (red).
  // Shuffle the result so king/non-king index assignment gets a random mix.
  const darkPool  = [...darkPri,  ...darkOv];
  const lightPool = [...lightPri, ...lightOv];
  let di = 0, li = 0;
  const result = [];
  for (let i = 0; i < count; i++) {
    const goLight = (Math.random() < 0.5 && li < lightPool.length) || di >= darkPool.length;
    if (goLight) result.push({ pos: lightPool[li++], isLight: true  });
    else         result.push({ pos: darkPool[di++],  isLight: false });
  }
  fisherYates(result);
  return result;
}

// ─── Placement ────────────────────────────────────────────────────────────────
// Non-pawns go to row 7 (canonical chess positions first, then left-to-right overflow).
// Pawns go to row 6 (canonical center-out positions first, then left-to-right overflow).
function assignPlacements(pieces) {
  const takenBack  = new Set();
  const takenFront = new Set();
  const result     = [];
  const typeCounts = {};

  for (const p of pieces.filter(q => !isFrontRowType(q.type))) {
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
  for (const p of pieces.filter(q => isFrontRowType(q.type))) {
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

  const allowLight = wave >= 2;
  const ckSlots    = checkerStartPositions(cfg.checkerCount, allowLight);
  const total       = ckSlots.length;
  const kingCount   = Math.round(total * kingFraction(wave));
  const tripleCount = Math.round(kingCount * tripleKingFraction(wave));
  const flyingCount = Math.min(
    kingCount - tripleCount,
    Math.round(kingCount * flyingKingFraction(wave))
  );

  state.checkers = ckSlots.map(({ pos: [r, c], isLight }, i) => {
    const isKing       = i < kingCount;
    const isTripleKing = isKing && i < tripleCount;
    const isFlyingKing = isKing && !isTripleKing && (i - tripleCount) < flyingCount;
    return { type: 'checker', team: 'checker', row: r, col: c, isLight, isKing, isFlyingKing, isTripleKing, dying: false, id: newId() };
  });

  state.waveCheckerCount = state.checkers.length;
  syncBoard(); updateUI(); renderStrips();

  // Mother Checker: boss of the final wave, placed at row 0 near center
  if (wave === MAX_WAVE) {
    const centerCols = [3, 4, 2, 5, 1, 6, 0, 7];
    let mRow = -1, mCol = -1;
    outer: for (let r = 0; r <= 1; r++)
      for (const col of centerCols)
        if (!state.board[r][col]) { mRow = r; mCol = col; break outer; }
    if (mRow >= 0) {
      state.checkers.push({
        type: 'checker', team: 'checker',
        row: mRow, col: mCol,
        isLight: Math.random() < 0.5,
        isKing: false, isFlyingKing: false, isTripleKing: false,
        isMotherChecker: true, dying: false, id: newId(),
      });
      state.waveCheckerCount++;
      syncBoard(); updateUI(); renderStrips();
    }
    showMessage('Mother Checker!',
      'The Mother Checker commands the final wave. She spawns a new checker every turn and cannot be captured until all other checkers are defeated!', () => {});
  }

  if (allowLight && !state.seenLightWarning) {
    state.seenLightWarning = true;
    showMessage('Red Checkers!',
      'Some checkers now start on white squares. Red checkers move on the opposite diagonal — watch both colors!', () => {});
  }
  if (!state.seenKingWarning && state.checkers.some(c => c.isKing)) {
    state.seenKingWarning = true;
    showMessage('Checker Kings!',
      'The checker army now fields Kings. Kings move and capture diagonally in all four directions — including backwards!', () => {});
  }
  if (wave === FLYING_KING_WAVE) {
    showMessage('Flying Kings!',
      'Some checker kings can now slide diagonally any distance — like a bishop. Their numbers grow each wave. When a checker promotes, it has a 50% chance of becoming a Flying King.', () => {});
  }
  if (wave === TRIPLE_KING_WAVE) {
    showMessage('Double Kings!',
      'Some checker kings have returned to their home row to become Double Kings. They can capture two enemies in one jump and hop over allied pieces.', () => {});
  }
}

function initialChessPieces() {
  return [
    { type: 'pawn', team: 'chess' },
    { type: 'pawn', team: 'chess' },
    { type: 'king', team: 'chess' },
    { type: 'pawn', team: 'chess' },
    { type: 'pawn', team: 'chess' },
  ];
}
