// ─── Sliding helper ───────────────────────────────────────────────────────────
function slidingMoves(r, c, board, dirs) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let nr = r+dr, nc = c+dc;
    while (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) {
      if (board[nr][nc]) {
        if (board[nr][nc].team === 'checker' || board[nr][nc].team === 'go')
          moves.push([nr, nc]);
        break;
      }
      moves.push([nr, nc]);
      nr += dr; nc += dc;
    }
  }
  return moves;
}

// ─── Piece definitions ────────────────────────────────────────────────────────
const PIECE_DEFS = {
  pawn: {
    name: 'Pawn', symbol: 'P', value: 1,
    description: 'Moves one square forward. Can move two squares from its starting position. Captures diagonally. Promotes to Queen or Knight upon reaching the back rank.',
    getMoves(r, c, board) {
      const moves = [];
      if (r>0 && !board[r-1][c]) moves.push([r-1, c]);
      if (r===6 && !board[r-1][c] && !board[r-2][c]) moves.push([r-2, c]);
      for (const dc of [-1, 1])
        if (c+dc>=0 && c+dc<COLS && r>0 &&
            (board[r-1][c+dc]?.team==='checker' || board[r-1][c+dc]?.team==='go'))
          moves.push([r-1, c+dc]);
      if (r===3) {
        for (const dc of [-1, 1]) {
          if (c+dc<0 || c+dc>=COLS) continue;
          const adj = board[r][c+dc];
          if (adj?.team==='checker' && state.enPassantCheckers.has(adj.id))
            moves.push([r-1, c+dc]);
        }
      }
      return moves;
    }
  },
  knight: {
    name: 'Knight', symbol: 'N', value: 3,
    description: 'Moves in an L-shape: two squares in one direction then one square perpendicular. The only piece that can jump over others.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess')
          moves.push([nr, nc]);
      }
      return moves;
    }
  },
  bishop: {
    name: 'Bishop', symbol: 'B', value: 3,
    description: 'Slides any number of squares diagonally. Stays on its starting color throughout the game.',
    getMoves(r, c, board) { return slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1]]); }
  },
  rook: {
    name: 'Rook', symbol: 'R', value: 5,
    description: 'Slides any number of squares horizontally or vertically. A powerful long-range attacker.',
    getMoves(r, c, board) { return slidingMoves(r, c, board, [[-1,0],[1,0],[0,-1],[0,1]]); }
  },
  queen: {
    name: 'Queen', symbol: 'Q', value: 9,
    description: 'Slides any number of squares in any direction (horizontally, vertically, or diagonally). The most powerful piece on the board.',
    getMoves(r, c, board) {
      return slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    }
  },
  king: {
    name: 'King', symbol: 'K', value: 0,
    description: 'Moves one square in any direction. With only one king, losing it ends the game instantly. With two or more kings, check rules are suspended. Can castle with an unmoved rook in its canonical starting position.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess')
          moves.push([nr, nc]);
      }
      // Castling: king unmoved at canonical square [7,4]
      const king = board[r]?.[c];
      if (king && !king.moved && r === 7 && c === 4) {
        const rkK = board[7]?.[7];
        if (rkK?.type === 'rook' && rkK?.team === 'chess' && !rkK.moved &&
            !board[7][5] && !board[7][6])
          moves.push([7, 6]); // kingside
        const rkQ = board[7]?.[0];
        if (rkQ?.type === 'rook' && rkQ?.team === 'chess' && !rkQ.moved &&
            !board[7][1] && !board[7][2] && !board[7][3])
          moves.push([7, 2]); // queenside
      }
      return moves;
    }
  },
  amazon: {
    name: 'Amazon', symbol: 'A', value: 12,
    description: 'Combines the moves of a Queen and a Knight. The ultimate hybrid piece — slides in any direction AND leaps in an L-shape.',
    getMoves(r, c, board) {
      const moves = slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
      const seen  = new Set(moves.map(([mr, mc]) => mr * COLS + mc));
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess') {
          const key = nr * COLS + nc;
          if (!seen.has(key)) { seen.add(key); moves.push([nr, nc]); }
        }
      }
      return moves;
    }
  },
  archbishop: {
    name: 'Archbishop', symbol: 'AR', value: 7,
    description: 'Combines Bishop and Knight moves. Controls both colors and can leap over obstacles.',
    getMoves(r, c, board) {
      const moves = slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1]]);
      const seen  = new Set(moves.map(([mr, mc]) => mr * COLS + mc));
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess') {
          const key = nr * COLS + nc;
          if (!seen.has(key)) { seen.add(key); moves.push([nr, nc]); }
        }
      }
      return moves;
    }
  },
  chancellor: {
    name: 'Chancellor', symbol: 'CH', value: 8,
    description: 'Combines Rook and Knight moves. Dominates open files while threatening unexpected knight leaps.',
    getMoves(r, c, board) {
      const moves = slidingMoves(r, c, board, [[-1,0],[1,0],[0,-1],[0,1]]);
      const seen  = new Set(moves.map(([mr, mc]) => mr * COLS + mc));
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess') {
          const key = nr * COLS + nc;
          if (!seen.has(key)) { seen.add(key); moves.push([nr, nc]); }
        }
      }
      return moves;
    }
  },
  grasshopper: {
    name: 'Grasshopper', symbol: 'G', value: 3,
    description: 'Slides like a queen but MUST jump over exactly one piece and land directly behind it. Stronger in crowded positions.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) {
        let nr = r+dr, nc = c+dc;
        while (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) {
          if (board[nr][nc]) {
            const lr = nr+dr, lc = nc+dc;
            if (lr>=0 && lr<ROWS && lc>=0 && lc<COLS && board[lr][lc]?.team !== 'chess')
              moves.push([lr, lc]);
            break;
          }
          nr += dr; nc += dc;
        }
      }
      return moves;
    }
  },
  berolina_pawn: {
    name: 'Berolina Pawn', symbol: 'BP', value: 1,
    description: 'Mirror of the standard pawn: moves diagonally forward and captures straight ahead. Can move two squares diagonally from its starting rank.',
    getMoves(r, c, board) {
      const moves = [];
      for (const dc of [-1, 1]) {
        if (r > 0 && c+dc >= 0 && c+dc < COLS && !board[r-1][c+dc]) {
          moves.push([r-1, c+dc]);
          if (r === 6 && c+2*dc >= 0 && c+2*dc < COLS && !board[r-2][c+2*dc])
            moves.push([r-2, c+2*dc]);
        }
      }
      if (r > 0 && (board[r-1][c]?.team === 'checker' || board[r-1][c]?.team === 'go')) moves.push([r-1, c]);
      return moves;
    }
  },
  camel: {
    name: 'Camel', symbol: 'CA', value: 2,
    description: 'Leaps in a 3+1 L-shape (like a knight but with 3 squares instead of 2). Always lands on the opposite square color.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-3,-1],[-3,1],[3,-1],[3,1],[-1,-3],[-1,3],[1,-3],[1,3]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team !== 'chess')
          moves.push([nr, nc]);
      }
      return moves;
    }
  },
  nightrider: {
    name: 'Nightrider', symbol: 'NR', value: 4,
    description: 'Extends the knight: repeatedly leaps in the same knight direction. Blocked by friendly pieces; captures the first enemy it reaches.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        let nr = r+dr, nc = c+dc;
        while (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) {
          const t = board[nr][nc];
          if (!t) {
            moves.push([nr, nc]);
          } else if (t.team === 'checker' || t.team === 'go') {
            moves.push([nr, nc]);
            break;
          } else {
            break;
          }
          nr += dr; nc += dc;
        }
      }
      return moves;
    }
  },
};

// Front-row pieces go to row 6; all others go to row 7
function isFrontRowType(type) { return type === 'pawn' || type === 'berolina_pawn'; }

// ─── Player-controlled checker movement ───────────────────────────────────────
// Returns [[row, col], ...] for a chess-team checker piece.
// Forward direction is toward row 0 (opposite of enemy checkers).
function getPlayerCheckerMoves(piece, board) {
  const moves = [];
  const dirs  = piece.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[-1,-1],[-1,1]];

  if (piece.isFlyingKing) {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let r = piece.row+dr, c = piece.col+dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const t = board[r][c];
        if (!t) {
          moves.push([r, c]);
        } else if (t.team === 'checker') {
          // Slide past the captured piece to any empty landing square
          let lr = r+dr, lc = c+dc;
          while (lr >= 0 && lr < ROWS && lc >= 0 && lc < COLS) {
            if (board[lr][lc]) break;
            moves.push([lr, lc]);
            lr += dr; lc += dc;
          }
          break;
        } else {
          break; // friendly chess piece blocks
        }
        r += dr; c += dc;
      }
    }
    return moves;
  }

  for (const [dr, dc] of dirs) {
    const nr = piece.row+dr, nc = piece.col+dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const t = board[nr][nc];
    if (!t) {
      moves.push([nr, nc]);           // regular step
    } else if (t.team === 'checker') {
      const lr = nr+dr, lc = nc+dc;
      if (lr < 0 || lr >= ROWS || lc < 0 || lc >= COLS) continue;
      const land = board[lr][lc];
      if (!land) {
        moves.push([lr, lc]);         // single capture
      } else if (piece.isTripleKing && land.team === 'checker') {
        const lr2 = lr+dr, lc2 = lc+dc;
        if (lr2 >= 0 && lr2 < ROWS && lc2 >= 0 && lc2 < COLS && !board[lr2][lc2])
          moves.push([lr2, lc2]);     // double capture (triple king)
      }
    } else if (piece.isTripleKing && t.team === 'chess') {
      const lr = nr+dr, lc = nc+dc;  // hop over allied chess piece
      if (lr >= 0 && lr < ROWS && lc >= 0 && lc < COLS && !board[lr][lc])
        moves.push([lr, lc]);
    }
  }
  return moves;
}

// Unified move generator: handles both regular chess pieces and player checkers.
function getMovesForPiece(piece, board) {
  if (piece.type === 'checker' && piece.team === 'chess')
    return getPlayerCheckerMoves(piece, board);
  return PIECE_DEFS[piece.type].getMoves(piece.row, piece.col, board);
}

// ─── Chess starting slots (real chess positions) ───────────────────────────────
// Pawns spread center-out: d2, e2, c2, f2, b2, g2, a2, h2
const CHESS_SLOTS = {
  king:   [[7,4]],
  queen:  [[7,3]],
  rook:   [[7,0],[7,7]],
  bishop: [[7,2],[7,5]],
  knight: [[7,1],[7,6]],
  pawn:   [[6,3],[6,4],[6,2],[6,5],[6,1],[6,6],[6,0],[6,7]],
};

// ─── Checker piece info ────────────────────────────────────────────────────────
const CHECKER_DESCS = {
  checker: 'A basic checker piece. Moves diagonally forward and captures diagonally forward. Promotes to king upon reaching the opponent\'s back rank.',
  checker_king: 'A promoted checker that can move diagonally in all directions (forwards and backwards). Gains the ability to capture in any diagonal direction.',
  checker_flying_king: 'A rare flying king (from wave 5+). Slides multiple squares diagonally like a bishop, allowing long-range attacks and evasion.',
  checker_triple_king: 'A king that returned to its starting row. Can capture two consecutive enemy pieces in one jump and hop over allied pieces.',
  checker_mother: 'The Mother Checker — boss of the final wave. Spawns a new checker every two turns. Immune to capture until all other checkers are defeated.',
};

// ─── Wave config ──────────────────────────────────────────────────────────────
const WAVE_CONFIG = [
  { checkerCount: 3  },
  { checkerCount: 5  },
  { checkerCount: 6  },
  { checkerCount: 8  },
  { checkerCount: 10 },
  { checkerCount: 12 },
];

function getWaveConfig(wave) {
  if (wave <= WAVE_CONFIG.length) return WAVE_CONFIG[wave - 1];
  const last = WAVE_CONFIG[WAVE_CONFIG.length - 1];
  return { checkerCount: last.checkerCount + (wave - WAVE_CONFIG.length) * 2 };
}

// Fraction of checkers that start as kings (0→50% over waves 2–5, 50→100% over waves 5–10).
function kingFraction(wave) {
  if (wave <= 2) return 0;
  if (wave <= 5) return (wave - 2) / 3 * 0.5;
  return Math.min(1, 0.5 + (wave - 5) / 5 * 0.5);
}

// Fraction of kings that are flying kings (25% at wave 5, 50% at wave 10).
function flyingKingFraction(wave) {
  if (wave < FLYING_KING_WAVE) return 0;
  return Math.min(0.5, 0.25 + (wave - FLYING_KING_WAVE) / 5 * 0.25);
}

// Fraction of kings that are triple/double kings (25% at wave 8, 50% at wave 10).
function tripleKingFraction(wave) {
  if (wave < TRIPLE_KING_WAVE) return 0;
  return 1 - flyingKingFraction(wave); // all non-flying kings spawn as triple kings
}
