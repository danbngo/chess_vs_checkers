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
    getMoves(r, c, board) { return slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1]]); }
  },
  rook: {
    name: 'Rook', symbol: 'R', value: 5,
    getMoves(r, c, board) { return slidingMoves(r, c, board, [[-1,0],[1,0],[0,-1],[0,1]]); }
  },
  queen: {
    name: 'Queen', symbol: 'Q', value: 9,
    getMoves(r, c, board) {
      return slidingMoves(r, c, board, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    }
  },
  king: {
    name: 'King', symbol: 'K', value: 0,
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
};

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

function getChessSlot(type, index) {
  return (CHESS_SLOTS[type] || [])[index] ?? [5, index % COLS];
}

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
