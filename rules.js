// ─── Check detection ──────────────────────────────────────────────────────────
function isThreatenedByChecker(row, col, board) {
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    // Landing square — where the checker would land after jumping over (row,col)
    const lr = row+dr, lc = col+dc;
    if (lr<0 || lr>=ROWS || lc<0 || lc>=COLS || board[lr]?.[lc]) continue;
    // Scan backward along the diagonal for a threatening checker
    let r = row-dr, c = col-dc, dist = 1;
    while (r>=0 && r<ROWS && c>=0 && c<COLS) {
      const p = board[r]?.[c];
      if (p) {
        if (p.team === 'checker') {
          if ( p.isKing && (dist===1 || p.isFlyingKing)) return true;
          if (!p.isKing && dist===1 && dr>0)             return true; // forward only
        }
        break;
      }
      r -= dr; c -= dc; dist++;
    }
  }
  return false;
}

function isKingInCheckAfterMove(piece, toRow, toCol, epCol) {
  const temp = state.board.map(row => [...row]);
  temp[piece.row][piece.col] = null;
  if (temp[toRow][toCol]?.team === 'checker') temp[toRow][toCol] = null;
  if (epCol !== undefined) temp[piece.row][epCol] = null;
  temp[toRow][toCol] = { ...piece, row: toRow, col: toCol };
  const king = piece.type === 'king'
    ? { row: toRow, col: toCol }
    : state.chessPieces.find(p => p.type==='king' && !p.dying);
  if (!king) return false;
  return isThreatenedByChecker(king.row, king.col, temp);
}

function getLegalMoves(piece) {
  const raw = PIECE_DEFS[piece.type].getMoves(piece.row, piece.col, state.board);
  // With 2+ kings no piece is restricted from moving into "check"
  if (state.chessPieces.filter(p => p.type === 'king' && !p.dying).length >= 2) return raw;
  return raw.filter(([mr, mc]) => {
    let epCol;
    if (piece.type==='pawn' && piece.row===3 && mc!==piece.col && !state.board[mr]?.[mc]) {
      const adj = state.board[piece.row]?.[mc];
      if (adj?.team==='checker' && state.enPassantCheckers.has(adj.id)) epCol = mc;
    }
    return !isKingInCheckAfterMove(piece, mr, mc, epCol);
  });
}

// ─── Checker moves ────────────────────────────────────────────────────────────
function getCheckerMoves(ck) {
  const moves  = [];
  const flying = ck.isKing && ck.isFlyingKing;
  const dirs   = ck.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[1,-1],[1,1]];

  for (const [dr, dc] of dirs) {
    if (flying) {
      let r = ck.row+dr, c = ck.col+dc;
      while (r>=0 && r<ROWS && c>=0 && c<COLS) {
        const t = state.board[r][c];
        if (!t) {
          moves.push({ row: r, col: c, capture: null });
        } else if (t.team === 'chess') {
          const lr = r+dr, lc = c+dc;
          if (lr>=0 && lr<ROWS && lc>=0 && lc<COLS && !state.board[lr][lc])
            moves.push({ row: lr, col: lc, capture: t });
          break;
        } else break;
        r += dr; c += dc;
      }
    } else {
      const nr = ck.row+dr, nc = ck.col+dc;
      if (nr<0 || nr>=ROWS || nc<0 || nc>=COLS) continue;
      const t = state.board[nr][nc];
      if (!t) {
        moves.push({ row: nr, col: nc, capture: null });
      } else if (t.team === 'chess') {
        const lr = nr+dr, lc = nc+dc;
        if (lr>=0 && lr<ROWS && lc>=0 && lc<COLS && !state.board[lr][lc])
          moves.push({ row: lr, col: lc, capture: t });
      }
    }
  }
  return moves;
}

// ─── Checker AI ───────────────────────────────────────────────────────────────
// One checker per player turn. Mandatory capture. Multi-jump after captures.

function runCheckerTurn() {
  if (state.phase !== 'checker_move') return;
  state.enPassantCheckers = new Set();
  syncBoard();

  const alive = state.checkers.filter(c => !c.dying);
  if (!alive.length) { checkerTurnDone(); return; }

  if (!alive.some(ck => getCheckerMoves(ck).length > 0)) {
    state.phase = 'wave_end';
    updateUI();
    showMessage('Stalemate!', 'The checkers have no moves. You earn $0 this wave.',
      () => showShop(0, state.wave+1));
    return;
  }

  const capturers = alive.filter(ck => getCheckerMoves(ck).some(m => m.capture && !m.capture.dying));
  const pool = capturers.length > 0 ? capturers : alive;
  const ck   = pool[Math.floor(Math.random() * pool.length)];
  animateSingleChecker(ck, capturers.length > 0);
}

function applyCheckerCapture(capture) {
  if (capture.trait === 'iron') {
    state.revivedPieces.push(capture); // comes back next wave, not lost permanently
  } else {
    state.capturedByCheckers.push(capture.type);
  }
  state.chessPieces = state.chessPieces.filter(p => p.id !== capture.id);
}

function animateSingleChecker(ck, mustCapture = false) {
  syncBoard();
  const moves    = getCheckerMoves(ck);
  const captures = moves.filter(m => m.capture && !m.capture.dying);
  // If mustCapture is true and no captures found, don't fall back to a regular move
  const chosen   = captures.length
    ? captures[Math.floor(Math.random() * captures.length)]
    : (!mustCapture && moves.length ? moves[Math.floor(Math.random() * moves.length)] : null);

  if (!chosen) { checkerTurnDone(); return; }

  const capture = chosen.capture;
  if (capture) capture.dying = true;
  state.board[ck.row][ck.col] = null;

  startAnim(ck, chosen.row, chosen.col, 280, () => {
    if (capture) applyCheckerCapture(capture);
    ck.row = chosen.row; ck.col = chosen.col;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      // Becomes flying king if any flying king is alive in the army
      ck.isFlyingKing = state.wave >= FLYING_KING_WAVE && state.checkers.some(c => c.isFlyingKing);
    }
    if (ck.row === 3) state.enPassantCheckers.add(ck.id);
    syncBoard(); updateUI(); renderStrips();

    if (capture) {
      const nextCaps = getCheckerMoves(ck).filter(m => m.capture && !m.capture.dying);
      if (nextCaps.length) { setTimeout(() => animateMultiJump(ck, checkerTurnDone), 150); return; }
    }
    checkerTurnDone();
  });
}

function animateMultiJump(ck, onDone) {
  syncBoard();
  const captures = getCheckerMoves(ck).filter(m => m.capture && !m.capture.dying);
  if (!captures.length) { onDone(); return; }

  const chosen  = captures[Math.floor(Math.random() * captures.length)];
  const capture = chosen.capture;
  capture.dying = true;
  state.board[ck.row][ck.col] = null;

  startAnim(ck, chosen.row, chosen.col, 220, () => {
    applyCheckerCapture(capture);
    ck.row = chosen.row; ck.col = chosen.col;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      // Becomes flying king if any flying king is alive in the army
      ck.isFlyingKing = state.wave >= FLYING_KING_WAVE && state.checkers.some(c => c.isFlyingKing);
    }
    if (ck.row === 3) state.enPassantCheckers.add(ck.id);
    syncBoard(); updateUI(); renderStrips();

    const next = getCheckerMoves(ck).filter(m => m.capture && !m.capture.dying);
    if (next.length) setTimeout(() => animateMultiJump(ck, onDone), 150);
    else             setTimeout(onDone, 60);
  });
}

function checkerTurnDone() {
  if (!state.chessPieces.some(p => p.type==='king' && !p.dying)) {
    gameLost();
    return;
  }
  state.phase = 'player';
  syncBoard();
  const hasMove = state.chessPieces.filter(p => !p.dying).some(p => getLegalMoves(p).length > 0);
  if (!hasMove) {
    state.phase = 'wave_end';
    updateUI();
    showMessage('Stalemate!', 'You have no valid moves. You earn $0 this wave.',
      () => showShop(0, state.wave+1));
  }
}
