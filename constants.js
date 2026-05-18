// ─── Board / Canvas ───────────────────────────────────────────────────────────
const COLS = 8, ROWS = 8;
const CELL = 80;
const MINI = 22;

const canvas    = document.getElementById('game-canvas');
const ctx       = canvas.getContext('2d');
canvas.width    = COLS * CELL;
canvas.height   = ROWS * CELL;

const leftStrip  = document.getElementById('left-strip');
const rightStrip = document.getElementById('right-strip');
const lctx = leftStrip.getContext('2d');
const rctx = rightStrip.getContext('2d');

// ─── Tuning ───────────────────────────────────────────────────────────────────
const PIECE_COSTS    = { pawn: 8, knight: 25, bishop: 25, rook: 40, queen: 70 };
const FLYING_KING_WAVE = 5;

// ─── Colours ──────────────────────────────────────────────────────────────────
const CLR = {
  lightSquare: '#f0d9b5',
  darkSquare:  '#b58863',
  highlight:   'rgba(0,200,100,0.45)',
  attackHL:    'rgba(50,120,220,0.55)',
  illegalHL:   'rgba(220,50,50,0.45)',
  selected:    'rgba(50,150,255,0.5)',
  chess:       { body: '#e8e8e8', outline: '#222', accent: '#aaa' },
  checker:     { body: '#c0392b', outline: '#7b0000', accent: '#e74c3c' },
};

const TINT_CHESS   = 'rgba(255,255,255,0.55)';
const TINT_CHECKER = 'rgba(0,0,0,0.5)';
