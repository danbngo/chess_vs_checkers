// ─── Sliding helper ───────────────────────────────────────────────────────────
function slidingMoves(r, c, board, dirs) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let nr = r+dr, nc = c+dc;
    while (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) {
      if (board[nr][nc]) {
        if (board[nr][nc].team === 'checker') moves.push([nr, nc]);
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
        if (c+dc>=0 && c+dc<COLS && r>0 && board[r-1][c+dc]?.team==='checker')
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
    description: 'Moves one square in any direction. With only one king, losing it ends the game instantly. With two or more kings, check rules are suspended.',
    getMoves(r, c, board) {
      const moves = [];
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && board[nr][nc]?.team!=='chess')
          moves.push([nr, nc]);
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
      if (r > 0 && board[r-1][c]?.team === 'checker') moves.push([r-1, c]);
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
          } else if (t.team === 'checker') {
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

// ─── Wave config ──────────────────────────────────────────────────────────────
const WAVE_CONFIG = [
  { checkerCount: 3  },
  { checkerCount: 5  },
  { checkerCount: 6  },
  { checkerCount: 8  },
  { checkerCount: 10 },
  { checkerCount: 12, kingsAt: 4 },
];

function getWaveConfig(wave) {
  if (wave <= WAVE_CONFIG.length) return WAVE_CONFIG[wave-1];
  const last = WAVE_CONFIG[WAVE_CONFIG.length-1];
  return { checkerCount: last.checkerCount + (wave - WAVE_CONFIG.length)*2, kingsAt: last.kingsAt };
}
