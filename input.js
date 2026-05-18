// ─── Hover tooltip ────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx   = e.clientX - rect.left;
  const my   = e.clientY - rect.top;
  const col  = Math.floor(mx / CELL);
  const row  = Math.floor(my / CELL);
  const p    = state.board?.[row]?.[col];
  hoverTooltip = (p?.team === 'chess') ? { piece: p, mx, my } : null;
});

canvas.addEventListener('mouseleave', () => { hoverTooltip = null; });

// ─── Player input ─────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (state.phase !== 'player' || isAnyAnimating()) return;
  const rect = canvas.getBoundingClientRect();
  const col  = Math.floor((e.clientX - rect.left) / CELL);
  const row  = Math.floor((e.clientY - rect.top)  / CELL);

  if (state.selected) {
    const { piece, moves } = state.selected;
    const hit = moves.find(([mr, mc]) => mr===row && mc===col);
    if (hit) { executeChessMove(piece, row, col); return; }
  }
  const clicked = state.board[row]?.[col];
  if (clicked?.team === 'chess') {
    state.selected = { piece: clicked, moves: getLegalMoves(clicked) };
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

  state.moveCount++;
  state.selected = null; state.phase = 'animating';
  state.enPassantCheckers = new Set();
  state.board[piece.row][piece.col] = null;
  if (target)    target.dying    = true;
  if (epCapture) epCapture.dying = true;

  startAnim(piece, toRow, toCol, 280, () => {
    piece.row = toRow; piece.col = toCol; piece.moved = true;

    const finishMove = (wasPromotion) => {
      if (target) {
        state.checkers = state.checkers.filter(c => c.id !== target.id);
        state.capturedByChess.push({ isKing: target.isKing, isLight: target.isLight ?? false });
      }
      if (epCapture) {
        state.checkers = state.checkers.filter(c => c.id !== epCapture.id);
        state.capturedByChess.push({ isKing: epCapture.isKing, isLight: epCapture.isLight ?? false });
      }
      // Raider: earns $1 per capture
      if (piece.trait === 'raider' && (target || epCapture)) {
        state.dollars++;
      }
      // Mercenary: 1/3 chance to desert after making a capture
      if (piece.trait === 'mercenary' && (target || epCapture)) {
        if (Math.random() < 1/3) {
          state.chessPieces = state.chessPieces.filter(p => p.id !== piece.id);
        }
      }
      syncBoard(); updateUI(); renderStrips();

      const ann = evaluateMove(piece, fromRow, fromCol, wasThreatenedBefore,
        target ?? epCapture, wasPromotion);
      showMoveAnnotation(ann, toCol, toRow);

      if (state.checkers.filter(c => !c.dying).length === 0) {
        waveWon();
      } else {
        state.phase = 'checker_move';
        setTimeout(runCheckerTurn, 350);
      }
    };

    // Pawn reaching back rank: show promotion choice (queen or knight)
    if (piece.type === 'pawn' && piece.row === 0) {
      showPromotion(piece, (newType) => {
        piece.type         = newType;
        piece.promotedFrom = 'pawn'; // remembered so it reverts at wave end
        finishMove(true);
      });
    } else {
      finishMove(false);
    }
  });
}
