// ─── Hover tooltip ────────────────────────────────────────────────────────────
let hoverTimer = null;
let hoverPos = null;

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const col  = Math.floor(mx / CELL);
  const row  = Math.floor(my / CELL);
  const p    = state.board?.[row]?.[col];

  if (!p || (p.team !== 'chess' && p.team !== 'checker' && p.team !== 'go')) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    hoverTooltip = null;
    return;
  }

  hoverPos = { piece: p, mx, my };
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { hoverTooltip = hoverPos; }, 1000);
});

canvas.addEventListener('mouseleave', () => {
  clearTimeout(hoverTimer);
  hoverTimer = null;
  hoverTooltip = null;
});

// ─── Player input ─────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (state.phase !== 'player' || isAnyAnimating()) return;
  const rect = canvas.getBoundingClientRect();
  const col  = Math.floor((e.clientX - rect.left) / CELL);
  const row  = Math.floor((e.clientY - rect.top)  / CELL);

  if (state.selected?.type === 'chess') {
    const { piece, moves } = state.selected;
    const hit = moves.find(([mr, mc]) => mr===row && mc===col);
    if (hit) { executeChessMove(piece, row, col); return; }
  }
  const clicked = state.board[row]?.[col];
  if (clicked?.team === 'chess') {
    state.selected = { type: 'chess', piece: clicked, moves: getLegalMoves(clicked) };
  } else if (clicked?.team === 'checker') {
    state.selected = { type: 'checker', piece: clicked, moves: getCheckerMoves(clicked) };
  } else if (clicked?.team === 'go') {
    const group = getGroup(clicked.row, clicked.col, state.board, 'go');
    const reach = findReachableSquares();
    const enclosed = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!reach[r][c] && state.board[r][c]?.team !== 'go') enclosed.push([r, c]);
    state.selected = { type: 'go', piece: clicked, group, enclosed };
  } else {
    state.selected = null;
  }
});

// ─── Chess move execution ─────────────────────────────────────────────────────
function executeChessMove(piece, toRow, toCol) {
  const target              = state.board[toRow][toCol];
  const fromRow             = piece.row, fromCol = piece.col;
  const wasThreatenedBefore = isThreatenedByChecker(fromRow, fromCol, state.board);

  let epCapture = null;
  if (piece.type === 'pawn' && !target && toCol !== piece.col && piece.row === 3) {
    const adj = state.board[piece.row][toCol];
    if (adj?.team === 'checker' && state.enPassantCheckers.has(adj.id)) epCapture = adj;
  }

  // Player checker jump captures (chameleon-transformed pieces moving diagonally 2+ squares)
  let playerCheckerCaptures = [];
  if (piece.type === 'checker' && piece.team === 'chess') {
    playerCheckerCaptures = findPlayerCheckerCaptures(piece, toRow, toCol, state.board);
    for (const cap of playerCheckerCaptures) cap.dying = true;
  }

  // Castling: detect and prepare rook movement
  let castleRook = null, castleRookToCol = -1;
  if (piece.type === 'king' && fromRow === 7 && Math.abs(toCol - fromCol) === 2) {
    const rookFromCol = toCol > fromCol ? 7 : 0;
    castleRookToCol   = toCol > fromCol ? 5 : 3;
    castleRook = state.board[7]?.[rookFromCol] ?? null;
    if (castleRook) state.board[7][rookFromCol] = null;
  }

  state.moveCount++;
  state.selected = null; state.phase = 'animating';
  if (state.campaign !== 'go') state.enPassantCheckers = new Set();
  state.board[piece.row][piece.col] = null;
  if (target?.team === 'go') state.goPieces = state.goPieces.filter(g => g.id !== target.id);
  else if (target)    target.dying    = true;
  if (epCapture) epCapture.dying = true;

  if (castleRook) startAnim(castleRook, 7, castleRookToCol, 280, () => {});
  startAnim(piece, toRow, toCol, 280, () => {
    piece.row = toRow; piece.col = toCol; piece.moved = true;
    if (castleRook) { castleRook.col = castleRookToCol; castleRook.moved = true; }

    const finishMove = (wasPromotion) => {
      if (target?.team === 'go') {
        state.capturedGoByChess.push({ id: target.id });
      } else if (target?.team === 'checker') {
        state.checkers = state.checkers.filter(c => c.id !== target.id);
        state.capturedByChess.push({ isKing: target.isKing, isLight: target.isLight ?? false });
      }
      if (epCapture) {
        state.checkers = state.checkers.filter(c => c.id !== epCapture.id);
        state.capturedByChess.push({ isKing: epCapture.isKing, isLight: epCapture.isLight ?? false });
      }
      // Player checker jump captures
      for (const cap of playerCheckerCaptures) {
        state.checkers = state.checkers.filter(c => c.id !== cap.id);
        state.capturedByChess.push({ isKing: cap.isKing, isLight: cap.isLight ?? false });
      }

      const anyCapture = target?.team === 'checker' || epCapture || playerCheckerCaptures.length > 0;

      // Chameleon: transform into the captured checker (highest-rank capture wins)
      if (piece.trait === 'chameleon') {
        const checkerCaptures = [
          ...(target?.team === 'checker' ? [target] : []),
          ...(epCapture?.team === 'checker' ? [epCapture] : []),
          ...playerCheckerCaptures,
        ];
        if (checkerCaptures.length > 0) {
          const rank = c => (c.isFlyingKing ? 3 : c.isTripleKing ? 2 : c.isKing ? 1 : 0);
          const best = checkerCaptures.reduce((b, c) => rank(c) > rank(b) ? c : b);
          if (!piece.promotedFrom) piece.promotedFrom = piece.type; // remember original for reversion
          piece.type        = 'checker';
          piece.isKing      = best.isKing      ?? false;
          piece.isFlyingKing = best.isFlyingKing ?? false;
          piece.isTripleKing = best.isTripleKing ?? false;
        }
      }

      // Player checker promotion: non-king reaching row 0 promotes to king
      if (piece.type === 'checker' && piece.team === 'chess' && !piece.isKing && piece.row === 0) {
        piece.isKing = true;
        if (state.wave >= FLYING_KING_WAVE && Math.random() < 0.5) piece.isFlyingKing = true;
        else if (state.wave >= TRIPLE_KING_WAVE)                    piece.isTripleKing = true;
      }

      // Raider: earns $3 per capture
      if (piece.trait === 'raider' && anyCapture) state.dollars += 3;
      // Mercenary: 1/3 chance to desert after making a capture
      if (piece.trait === 'mercenary' && anyCapture && Math.random() < 1/3)
        state.chessPieces = state.chessPieces.filter(p => p.id !== piece.id);

      syncBoard();
      if (state.campaign === 'go') applyGoCaptures();
      updateUI(); renderStrips();

      const ann = evaluateMove(piece, fromRow, fromCol, wasThreatenedBefore,
        target ?? epCapture ?? playerCheckerCaptures[0], wasPromotion);
      showMoveAnnotation(ann, toCol, toRow);

      const allEnemiesDead = state.campaign === 'go'
        ? state.goPieces.length === 0
        : state.checkers.filter(c => !c.dying).length === 0;

      if (allEnemiesDead) {
        waveWon();
      } else if (state.campaign === 'go') {
        if (state.moveCount % 2 === 1) {
          state.phase = 'go_move';
          setTimeout(runGoTurn, 350);
        } else {
          goTurnDone();
        }
      } else {
        state.phase = 'checker_move';
        setTimeout(runCheckerTurn, 350);
      }
    };

    // Pawn/berolina pawn reaching back rank: show promotion choice (queen or knight)
    if (isFrontRowType(piece.type) && piece.row === 0) {
      const origType = piece.type;
      showPromotion(piece, (newType) => {
        piece.type         = newType;
        piece.promotedFrom = origType;
        finishMove(true);
      });
    } else {
      finishMove(false);
    }
  });
}
