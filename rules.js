// ─── Check detection (multi-jump aware) ───────────────────────────────────────
// Returns true if any checker on `board` can reach (targetRow, targetCol) via
// one or more captures (including multi-jump chains).
function isThreatenedByChecker(targetRow, targetCol, board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ck = board[r]?.[c];
      if (ck?.team !== 'checker') continue;
      if (_ckCanReach(ck, r, c, targetRow, targetCol, new Set(), board)) return true;
    }
  }
  return false;
}

// DFS: can checker ck, currently at (curRow,curCol) with capturedIds already
// virtually removed, reach (targetRow,targetCol) via one or more captures?
// No cycle-detection needed: each recursive call adds ≥1 piece to capturedIds,
// bounding depth by the number of chess pieces.
function _ckCanReach(ck, curRow, curCol, targetRow, targetCol, capturedIds, board) {
  const dirs = ck.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[1,-1],[1,1]];

  if (ck.isFlyingKing) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      // Slide along diagonal; virtually-captured pieces are transparent
      let r = curRow+dr, c = curCol+dc;
      let capPiece = null, capR = -1, capC = -1;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const cell = board[r][c];
        if (!cell || (cell && capturedIds.has(cell.id))) { r += dr; c += dc; continue; }
        if (cell.team === 'chess') { capPiece = cell; capR = r; capC = c; }
        break; // blocked (or found capture target)
      }
      if (!capPiece) continue;
      // Any empty (or virtually-captured) square past the captured piece is a valid landing
      const newCap = new Set(capturedIds); newCap.add(capPiece.id);
      let lr = capR+dr, lc = capC+dc;
      while (lr >= 0 && lr < ROWS && lc >= 0 && lc < COLS) {
        const land = board[lr][lc];
        if (land && !capturedIds.has(land.id)) break; // real occupied square
        if (lr === targetRow && lc === targetCol) return true;
        if (_ckCanReach(ck, lr, lc, targetRow, targetCol, newCap, board)) return true;
        lr += dr; lc += dc;
      }
    }
    return false;
  }

  // Regular checker or non-flying king
  for (const [dr, dc] of dirs) {
    const nr = curRow+dr, nc = curCol+dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const mid = board[nr][nc];
    // Must jump over a real (not already captured) chess piece
    if (!mid || capturedIds.has(mid.id) || mid.team !== 'chess') continue;
    const lr = nr+dr, lc = nc+dc;
    if (lr < 0 || lr >= ROWS || lc < 0 || lc >= COLS) continue;
    const land = board[lr][lc];
    const landFree = !land || capturedIds.has(land.id);

    if (landFree) {
      // Standard single capture
      if (lr === targetRow && lc === targetCol) return true;
      const newCap = new Set(capturedIds); newCap.add(mid.id);
      if (_ckCanReach(ck, lr, lc, targetRow, targetCol, newCap, board)) return true;
    } else if (ck.isTripleKing && land.team === 'chess' && !capturedIds.has(land.id)) {
      // Triple king double-capture: jump over mid AND land (which is also a chess piece)
      const lr2 = lr+dr, lc2 = lc+dc;
      if (lr2 >= 0 && lr2 < ROWS && lc2 >= 0 && lc2 < COLS) {
        const land2 = board[lr2][lc2];
        if (!land2 || capturedIds.has(land2.id)) {
          if (lr2 === targetRow && lc2 === targetCol) return true;
          const newCap = new Set(capturedIds); newCap.add(mid.id); newCap.add(land.id);
          if (_ckCanReach(ck, lr2, lc2, targetRow, targetCol, newCap, board)) return true;
        }
      }
    }
  }
  return false;
}

// Returns all enemy checkers a player-controlled checker captures when moving to (toRow,toCol).
// Scans along the diagonal path; flying kings may pass multiple squares before the captured piece.
function findPlayerCheckerCaptures(piece, toRow, toCol, board) {
  if (Math.abs(toRow - piece.row) <= 1) return [];
  const dr = Math.sign(toRow - piece.row);
  const dc = Math.sign(toCol - piece.col);
  const captured = [];
  let r = piece.row + dr, c = piece.col + dc;
  while (r !== toRow || c !== toCol) {
    const p = board[r]?.[c];
    if (p?.team === 'checker') captured.push(p);
    r += dr; c += dc;
  }
  return captured;
}

function isKingInCheckAfterMove(piece, toRow, toCol, epCol) {
  const temp = state.board.map(row => [...row]);
  temp[piece.row][piece.col] = null;
  if (temp[toRow][toCol]?.team === 'checker') temp[toRow][toCol] = null;
  if (epCol !== undefined) temp[piece.row][epCol] = null;
  // Player checker jump captures: remove jumped-over enemy checkers from temp board
  if (piece.type === 'checker' && piece.team === 'chess') {
    for (const cap of findPlayerCheckerCaptures(piece, toRow, toCol, temp))
      temp[cap.row][cap.col] = null;
  }
  temp[toRow][toCol] = { ...piece, row: toRow, col: toCol };
  const king = piece.type === 'king'
    ? { row: toRow, col: toCol }
    : state.chessPieces.find(p => p.type==='king' && !p.dying);
  if (!king) return false;
  return isThreatenedByChecker(king.row, king.col, temp);
}

function getLegalMoves(piece) {
  const raw = getMovesForPiece(piece, state.board);

  if (state.campaign === 'go') {
    // Go campaign: no check rules, but no-suicide (chess group at destination must retain liberty)
    return raw.filter(([mr, mc]) => {
      const temp = state.board.map(row => [...row]);
      temp[piece.row][piece.col] = null;
      const target = temp[mr][mc];
      if (target?.team === 'go') {
        const goGroup = getGroup(mr, mc, temp, 'go');
        if (getGroupLiberties(goGroup, temp) > 0) return false;
      }
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
  let legal;
  if (state.chessPieces.filter(p => p.type === 'king' && !p.dying).length >= 2) {
    legal = raw;
  } else {
    legal = raw.filter(([mr, mc]) => {
      let epCol;
      if (piece.type==='pawn' && piece.row===3 && mc!==piece.col && !state.board[mr]?.[mc]) {
        const adj = state.board[piece.row]?.[mc];
        if (adj?.team==='checker' && state.enPassantCheckers.has(adj.id)) epCol = mc;
      }
      // Castling: king can't be in check and can't pass through a threatened square
      if (piece.type === 'king' && mr === piece.row && Math.abs(mc - piece.col) === 2) {
        if (isThreatenedByChecker(piece.row, piece.col, state.board)) return false;
        const interCol = (mc + piece.col) / 2;
        if (isThreatenedByChecker(mr, interCol, state.board)) return false;
      }
      return !isKingInCheckAfterMove(piece, mr, mc, epCol);
    });
  }

  // Mother checker immunity: capturable only when she is the last checker alive
  const otherCheckers = state.checkers.filter(c => !c.dying && !c.isMotherChecker);
  if (otherCheckers.length > 0)
    legal = legal.filter(([mr, mc]) => !state.board[mr]?.[mc]?.isMotherChecker);

  return legal;
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
// Returns true if any chess piece can move to (row, col) on the given board.
function isAttackedByChess(row, col, board) {
  for (const p of state.chessPieces) {
    if (p.dying) continue;
    if (getMovesForPiece(p, board).some(([mr, mc]) => mr === row && mc === col))
      return true;
  }
  return false;
}

// Returns true if a checker at (r, c) can capture any chess piece on the given board.
function canCaptureFromPos(ck, r, c, board) {
  const dirs = ck.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[1,-1],[1,1]];
  for (const [dr, dc] of dirs) {
    const nr = r+dr, nc = c+dc;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
    const t = board[nr][nc];
    if (t?.team !== 'chess') continue;
    const lr = nr+dr, lc = nc+dc;
    if (lr>=0&&lr<ROWS&&lc>=0&&lc<COLS&&!board[lr][lc]) return true;
  }
  return false;
}

function rateMove(ck, move) {
  if (move.capture) {
    let score = move.capture.type === 'king' ? 1000 : 100;
    if (move.capture2) score += move.capture2.type === 'king' ? 500 : 50;
    return score;
  }

  const tempBoard = state.board.map(row => [...row]);
  tempBoard[ck.row][ck.col] = null;
  tempBoard[move.row][move.col] = { ...ck, row: move.row, col: move.col };

  const destSafe       = !isAttackedByChess(move.row, move.col, tempBoard);
  const currentlyInDanger = isAttackedByChess(ck.row, ck.col, state.board);
  const canThreaten    = canCaptureFromPos(ck, move.row, move.col, tempBoard);

  const promotes = (!ck.isKing && move.row === ROWS - 1) ||
                   (ck.isKing && !ck.isTripleKing && !ck.isFlyingKing && move.row === 0 && state.wave >= TRIPLE_KING_WAVE);

  if (!destSafe)               return 1;   // moves into range of a chess piece — avoid
  if (currentlyInDanger && canThreaten) return 60; // escape + can threaten from safety
  if (currentlyInDanger)       return 50;  // escape from danger — beats attack positioning
  if (canThreaten)             return 30;  // safe square that threatens a chess piece
  if (promotes)                return 20;  // promotion — beats passive, loses to escape/attack
  return 10;                               // safe but passive
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
  if (capturers.length > 0) {
    const ck = capturers[Math.floor(Math.random() * capturers.length)];
    animateSingleChecker(ck, true);
    return;
  }

  // Score every (checker, move) pair and pick the globally best option.
  // Escape (30) beats neutral (10) beats doomed-all-unsafe (1), so threatened pieces
  // that can escape naturally win; doomed pieces correctly lose to neutral moves.
  let bestScore = -Infinity, bestOptions = [];
  for (const ck of alive) {
    for (const move of getCheckerMoves(ck)) {
      const score = rateMove(ck, move);
      if (score > bestScore)      { bestScore = score; bestOptions = [{ ck, move }]; }
      else if (score === bestScore) bestOptions.push({ ck, move });
    }
  }
  const { ck, move } = bestOptions[Math.floor(Math.random() * bestOptions.length)];
  animateSingleChecker(ck, false, move);
}

function applyCheckerCapture(capture) {
  if (capture.trait === 'iron') {
    state.revivedPieces.push(capture); // comes back next wave, not lost permanently
  } else {
    state.capturedByCheckers.push(capture.type);
  }
  state.chessPieces = state.chessPieces.filter(p => p.id !== capture.id);
}

function animateSingleChecker(ck, mustCapture = false, preChosenMove = null) {
  syncBoard();
  const moves    = getCheckerMoves(ck);
  const captures = moves.filter(m => m.capture && !m.capture.dying);

  let chosen = preChosenMove;
  if (!chosen) {
    let pool = moves;
    if (mustCapture && captures.length > 0) {
      pool = captures;
    } else if (mustCapture) {
      checkerTurnDone();
      return;
    }
    const rated = pool.map(m => ({ move: m, score: rateMove(ck, m) }));
    const maxScore = Math.max(...rated.map(r => r.score));
    const bestMoves = rated.filter(r => r.score === maxScore);
    chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
  }

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
    let promoted = false;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      if (state.wave >= FLYING_KING_WAVE && Math.random() < 0.5) {
        ck.isFlyingKing = true;
      } else if (state.wave >= TRIPLE_KING_WAVE) {
        ck.isTripleKing = true;
      }
      promoted = true;
    }
    if (ck.isKing && !ck.isTripleKing && !ck.isFlyingKing && ck.row === 0 && state.wave >= TRIPLE_KING_WAVE) ck.isTripleKing = true;
    if (ck.row === 3) state.enPassantCheckers.add(ck.id);
    syncBoard(); updateUI(); renderStrips();

    const cont = () => {
      if (capture && !promoted) {
        const nextCaps = getCheckerMoves(ck).filter(m => m.capture && !m.capture.dying);
        if (nextCaps.length) { setTimeout(() => animateMultiJump(ck, checkerTurnDone), 150); return; }
      }
      checkerTurnDone();
    };

    if (promoted && !state.seenKingWarning) {
      state.seenKingWarning = true;
      showMessage('Checker King!', 'A checker promoted to King — kings move and capture diagonally in all four directions, including backwards!', cont);
    } else {
      cont();
    }
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
    let promoted = false;
    if (!ck.isKing && ck.row === ROWS-1) {
      ck.isKing = true;
      if (state.wave >= FLYING_KING_WAVE && Math.random() < 0.5) {
        ck.isFlyingKing = true;
      } else if (state.wave >= TRIPLE_KING_WAVE) {
        ck.isTripleKing = true;
      }
      promoted = true;
    }
    if (ck.isKing && !ck.isTripleKing && !ck.isFlyingKing && ck.row === 0 && state.wave >= TRIPLE_KING_WAVE) ck.isTripleKing = true;
    if (ck.row === 3) state.enPassantCheckers.add(ck.id);
    syncBoard(); updateUI(); renderStrips();

    const cont = () => {
      const next = promoted ? [] : getCheckerMoves(ck).filter(m => m.capture && !m.capture.dying);
      if (next.length) setTimeout(() => animateMultiJump(ck, onDone), 150);
      else             setTimeout(onDone, 60);
    };

    if (promoted && !state.seenKingWarning) {
      state.seenKingWarning = true;
      showMessage('Checker King!', 'A checker promoted to King — kings move and capture diagonally in all four directions, including backwards!', cont);
    } else {
      cont();
    }
  });
}

function motherSpawn() {
  const mother = state.checkers.find(c => c.isMotherChecker && !c.dying);
  if (!mother) return;
  syncBoard();
  const empty = [];
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    const r = mother.row + dr, c = mother.col + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !state.board[r][c])
      empty.push([r, c]);
  }
  if (!empty.length) return;
  const [sr, sc] = empty[Math.floor(Math.random() * empty.length)];
  let isKing = false, isFlyingKing = false, isTripleKing = false;
  if (Math.random() < kingFraction(state.wave)) {
    isKing = true;
    if (state.wave >= FLYING_KING_WAVE && Math.random() < 0.5) isFlyingKing = true;
    else if (state.wave >= TRIPLE_KING_WAVE)                    isTripleKing = true;
  }
  state.checkers.push({
    type: 'checker', team: 'checker',
    row: sr, col: sc,
    isLight: Math.random() < 0.5,
    isKing, isFlyingKing, isTripleKing,
    isMotherChecker: false, dying: false, id: newId(),
  });
  syncBoard(); updateUI(); renderStrips();
}

function checkerTurnDone() {
  if (!state.chessPieces.some(p => p.type==='king' && !p.dying)) {
    gameLost();
    return;
  }
  motherSpawn();
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
