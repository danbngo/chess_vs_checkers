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
const PIECE_COSTS    = {
  pawn: 8, knight: 25, bishop: 25, rook: 40, queen: 70, king: 60,
  amazon: 110, archbishop: 55, chancellor: 70, grasshopper: 22,
  berolina_pawn: 10, camel: 18, nightrider: 38,
};
const FLYING_KING_WAVE  = 5;
const TRIPLE_KING_WAVE  = 8;
const MAX_WAVE = 10;

// ─── Colours ──────────────────────────────────────────────────────────────────
const CLR = {
  lightSquare: '#f0d9b5',
  darkSquare:  '#b58863',
  highlight:   'rgba(0,200,100,0.45)',
  attackHL:    'rgba(50,120,220,0.55)',
  illegalHL:   'rgba(220,50,50,0.45)',
  selected:    'rgba(50,150,255,0.5)',
};

const TINT_CHESS         = 'rgba(255,255,255,0.55)';
const TINT_CHECKER       = 'rgba(0,0,0,0.5)';
const TINT_CHECKER_LIGHT = 'rgba(220,80,40,0.65)';
const TINT_AMAZON        = 'rgba(160,80,220,0.65)';
const TINT_ARCHBISHOP    = 'rgba(0,210,90,0.65)';
const TINT_CHANCELLOR    = 'rgba(0,200,220,0.65)';
const TINT_GRASSHOPPER   = 'rgba(170,220,0,0.65)';
const TINT_BEROLINA      = 'rgba(255,150,40,0.65)';
const TINT_CAMEL         = 'rgba(180,120,55,0.65)';
const TINT_NIGHTRIDER    = 'rgba(110,50,230,0.65)';
