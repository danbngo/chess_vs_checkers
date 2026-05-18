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
  const target             = state.board[toRow][toCol];
  const fromRow            = piece.row, fromCol = piece.col;
  const wasThreatenedBefore = isThreatenedByChecker(fromRow, fromCol, state.board);

  let epCapture = null;
  if (piece.type==='pawn' && !target && toCol!==piece.col && piece.row===3) {
    const adj = state.board[piece.row][toCol];
    if (adj?.team==='checker' && state.enPassantCheckers.has(adj.id)) epCapture = adj;
  }

  state.moveCount++;
  state.selected = null; state.phase = 'animating';
  state.enPassantCheckers = new Set();
  state.board[piece.row][piece.col] = null;
  if (target)    target.dying    = true;
  if (epCapture) epCapture.dying = true;

  startAnim(piece, toRow, toCol, 280, () => {
    piece.row = toRow; piece.col = toCol; piece.moved = true;

    // Track original type before possible promotion, but store it so next wave respawns correctly.
    const origType = piece.type;
    if (piece.type === 'pawn' && piece.row === 0) piece.type = 'queen';
    const wasPromotion = origType==='pawn' && piece.type==='queen';

    if (target) {
      state.checkers = state.checkers.filter(c => c.id !== target.id);
      state.capturedByChess.push({ isKing: target.isKing });
    }
    if (epCapture) {
      state.checkers = state.checkers.filter(c => c.id !== epCapture.id);
      state.capturedByChess.push({ isKing: epCapture.isKing });
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
  });
}
