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

  if (state.campaign === 'go') {
    // Go campaign: no check rules, but no-suicide (chess group at destination must retain liberty)
    return raw.filter(([mr, mc]) => {
      const temp = state.board.map(row => [...row]);
      temp[piece.row][piece.col] = null;
      temp[mr][mc] = { ...piece, row: mr, col: mc };
      // Capture any go groups that become dead after this chess move
      const deadGo = findDeadGroups('go', temp);
      for (const group of deadGo) for (const [r, c] of group) temp[r][c] = null;
      // No-suicide: the chess group at the destination must have at least 1 liberty
      const group = getGroup(mr, mc, temp, 'chess');
      return getGroupLiberties(group, temp) > 0;
    });
  }

  // Checkers campaign: standard check/check-avoidance logic
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
        if (lr>=0 && lr<ROWS && lc>=0 && lc<COLS) {
          const t2 = state.board[lr][lc];
          if (!t2) {
            moves.push({ row: lr, col: lc, capture: t });
          } else if (ck.isTripleKing && t2.team === 'chess') {
            // Double capture: jump over two consecutive enemies
            const r3 = lr+dr, c3 = lc+dc;
            if (r3>=0 && r3<ROWS && c3>=0 && c3<COLS && !state.board[r3][c3])
              moves.push({ row: r3, col: c3, capture: t, capture2: t2 });
          }
        }
      } else if (ck.isTripleKing) {
        // Friendly hop over allied checker (never mandatory, piece is not sacrificed)
        const lr = nr+dr, lc = nc+dc;
        if (lr>=0 && lr<ROWS && lc>=0 && lc<COLS && !state.board[lr][lc])
          moves.push({ row: lr, col: lc, capture: null, isFriendlyHop: true });
      }
    }
  }
  return moves;
}

// ─── Checker AI ───────────────────────────────────────────────────────────
function rateMove(ck, move) {
  let score = 0;

  if (move.capture) {
    // Captures are rated highest
    if (move.capture.type === 'king') {
      score = 1000; // King capture is the best
    } else {
      score = 100;  // Any other capture
    }
    // Bonus for additional captures (double captures)
    if (move.capture2) {
      if (move.capture2.type === 'king') {
        score += 500; // Double-capturing king is excellent
      } else {
        score += 50;  // Double capture bonus
      }
    }
  } else {
    // Non-capture move scoring
    // Create temp board after this move to evaluate the position
    const tempBoard = state.board.map(row => [...row]);
    tempBoard[ck.row][ck.col] = null;
    tempBoard[move.row][move.col] = { ...ck, row: move.row, col: move.col };

    // Check if destination would threaten any chess pieces (could capture next turn)
    const threatsFromDest = [];
    for (const [dr, dc] of ck.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[1,-1],[1,1]]) {
      const nr = move.row + dr, nc = move.col + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const t = tempBoard[nr][nc];
      if (!t || t.team !== 'chess') continue;
      const lr = nr + dr, lc = nc + dc;
      if (lr >= 0 && lr < ROWS && lc >= 0 && lc < COLS && !tempBoard[lr][lc]) {
        threatsFromDest.push(t);
      }
    }

    // Check if destination is threatened by any chess piece
    const isThreatened = isThreatenedByChecker(move.row, move.col, tempBoard);

    if (threatsFromDest.length > 0) {
      // Can threaten a piece from this position
      if (isThreatened) {
        score = 5;  // Threatens but also threatened (risky)
      } else {
        score = 50; // Threatens and safe (good position)
      }
    } else if (isThreatened) {
      score = 1; // Exposed to attack (bad)
    } else {
      score = 10; // Safe but passive
    }
  }

  return score;
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

  // Filter pool based on mustCapture rule
  let pool = moves;
  if (mustCapture && captures.length > 0) {
    pool = captures;
  } else if (mustCapture) {
    // Must capture but no captures available - end turn
    checkerTurnDone();
    return;
  }

  // Rate all moves in pool and pick the best-rated one(s)
  const rated = pool.map(m => ({ move: m, score: rateMove(ck, m) }));
  const maxScore = Math.max(...rated.map(r => r.score));
  const bestMoves = rated.filter(r => r.score === maxScore);
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;

  if (!chosen) { checkerTurnDone(); return; }

  const capture  = chosen.capture;
  const capture2 = chosen.capture2 ?? null;
  if (capture)  capture.dying  = true;
  if (capture2) capture2.dying = true;
  state.board[ck.row][ck.col] = null;

  startAnim(ck, chosen.row, chosen.col, 280, () => {
    if (capture)  applyCheckerCapture(capture);
    if (capture2) applyCheckerCapture(capture2);
    ck.row = chosen.row; ck.col = chosen.col;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      ck.isFlyingKing = state.wave >= FLYING_KING_WAVE && state.checkers.some(c => c.isFlyingKing);
    }
    if (ck.isKing && !ck.isTripleKing && ck.row === 0) ck.isTripleKing = true;
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

  // Rate captures and pick the best-rated one(s)
  const rated = captures.map(m => ({ move: m, score: rateMove(ck, m) }));
  const maxScore = Math.max(...rated.map(r => r.score));
  const bestMoves = rated.filter(r => r.score === maxScore);
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
  const capture  = chosen.capture;
  const capture2 = chosen.capture2 ?? null;
  capture.dying = true;
  if (capture2) capture2.dying = true;
  state.board[ck.row][ck.col] = null;

  startAnim(ck, chosen.row, chosen.col, 220, () => {
    applyCheckerCapture(capture);
    if (capture2) applyCheckerCapture(capture2);
    ck.row = chosen.row; ck.col = chosen.col;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      ck.isFlyingKing = state.wave >= FLYING_KING_WAVE && state.checkers.some(c => c.isFlyingKing);
    }
    if (ck.isKing && !ck.isTripleKing && ck.row === 0) ck.isTripleKing = true;
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
