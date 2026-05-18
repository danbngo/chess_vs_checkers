// ─── Images ───────────────────────────────────────────────────────────────────
const IMAGES    = {};
const tintCache = {};

for (const [key, src] of [
  ['pawn',         'images/pawn.png'],
  ['knight',       'images/knight.png'],
  ['bishop',       'images/bishop.png'],
  ['queen',        'images/queen.png'],
  ['king',         'images/king.png'],
  ['checker',             'images/checker.png'],
  ['checker_king',        'images/checker_king.png'],
  ['checker_flying_king', 'images/checker_flying_king.png'],
  ['checker_triple_king', 'images/checker_triple_king.png'],
  ['amazon',        'images/amazon.png'],
  ['archbishop',    'images/archbishop.png'],
  ['chancellor',    'images/chancellor.png'],
  ['grasshopper',   'images/grasshopper.png'],
  ['berolina_pawn', 'images/berolina_pawn.png'],
  ['camel',         'images/camel.png'],
  ['nightrider',    'images/nightrider.png'],
]) {
  const img = new Image();
  img.onload = () => {
    for (const k of Object.keys(tintCache)) {
      if (k.startsWith(key + '|')) delete tintCache[k];
    }
    renderStrips();
  };
  img.src = src;
  IMAGES[key] = img;
}

function imgReady(key) {
  const img = IMAGES[key];
  return img && img.complete && img.naturalWidth > 0;
}

function getTinted(key, tintColor) {
  const cKey = key + '|' + tintColor;
  if (tintCache[cKey]) return tintCache[cKey];
  if (!imgReady(key)) return null;
  const img = IMAGES[key];
  const off = document.createElement('canvas');
  off.width = img.naturalWidth; off.height = img.naturalHeight;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0);
  octx.globalCompositeOperation = 'source-atop';
  octx.fillStyle = tintColor;
  octx.fillRect(0, 0, off.width, off.height);
  tintCache[cKey] = off;
  return off;
}

// ─── Animation ────────────────────────────────────────────────────────────────
const activeAnims = new Map();

function startAnim(piece, toRow, toCol, duration, onComplete) {
  activeAnims.set(piece.id, {
    fromRow: piece.row, fromCol: piece.col,
    toRow, toCol,
    startTime: performance.now(),
    duration, onComplete,
  });
}

function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

function getPieceRenderPos(piece) {
  const anim = activeAnims.get(piece.id);
  if (!anim) return { x: piece.col*CELL + CELL/2, y: piece.row*CELL + CELL/2 };
  const t = easeInOut(Math.min(1, (performance.now() - anim.startTime) / anim.duration));
  return {
    x: (anim.fromCol + (anim.toCol - anim.fromCol)*t) * CELL + CELL/2,
    y: (anim.fromRow + (anim.toRow - anim.fromRow)*t) * CELL + CELL/2,
  };
}

function isAnyAnimating() { return activeAnims.size > 0; }

function gameLoop() {
  const now  = performance.now();
  const done = [];
  for (const [id, anim] of activeAnims)
    if (now >= anim.startTime + anim.duration) done.push([id, anim]);
  for (const [id, anim] of done) { activeAnims.delete(id); anim.onComplete(); }
  render();
  requestAnimationFrame(gameLoop);
}

// ─── Hover tooltip ────────────────────────────────────────────────────────────
let hoverTooltip = null; // { piece, mx, my }

function drawTooltip() {
  if (!hoverTooltip) return;
  const { piece, mx, my } = hoverTooltip;
  const def = PIECE_DEFS[piece.type];
  if (!def) return;

  const pos       = toChessNotation(piece.row, piece.col).toUpperCase();
  const traitName = piece.trait
    ? piece.trait.charAt(0).toUpperCase() + piece.trait.slice(1)
    : null;

  const lines = [
    { text: `${def.name}  ${pos}`, bold: true, color: '#fff' },
    { text: 'Owner: Chess', bold: false, color: '#aac8ff' },
  ];
  if (traitName) {
    const traitColor = { Mercenary: '#ffd700', Iron: '#82d2ff', Raider: '#ff6400' }[traitName] || '#ccc';
    lines.push({ text: `Trait: ${traitName}`, bold: false, color: traitColor });
  }
  if (def.description) {
    const words = def.description.split(' ');
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 34) {
        lines.push({ text: line.trim(), bold: false, color: '#ddd' });
        line = w;
      } else {
        line += (line ? ' ' : '') + w;
      }
    }
    if (line) lines.push({ text: line.trim(), bold: false, color: '#ddd' });
  }

  ctx.save();
  ctx.font = '13px sans-serif';
  const lineH = 17, padX = 10, padY = 8;
  const maxW  = lines.reduce((m, l) => {
    ctx.font = l.bold ? 'bold 13px sans-serif' : '13px sans-serif';
    return Math.max(m, ctx.measureText(l.text).width);
  }, 0);
  const bw = maxW + padX * 2, bh = lines.length * lineH + padY * 2;

  let bx = mx + 14, by = my - bh / 2;
  if (bx + bw > canvas.width)  bx = mx - bw - 14;
  if (by < 2)                  by = 2;
  if (by + bh > canvas.height) by = canvas.height - bh - 2;

  ctx.fillStyle = 'rgba(15,20,35,0.93)';
  ctx.strokeStyle = 'rgba(120,160,255,0.5)';
  ctx.lineWidth = 1;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(bx+r, by); ctx.lineTo(bx+bw-r, by); ctx.arcTo(bx+bw, by, bx+bw, by+r, r);
  ctx.lineTo(bx+bw, by+bh-r); ctx.arcTo(bx+bw, by+bh, bx+bw-r, by+bh, r);
  ctx.lineTo(bx+r, by+bh); ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
  ctx.lineTo(bx, by+r); ctx.arcTo(bx, by, bx+r, by, r);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  lines.forEach((l, i) => {
    ctx.font = l.bold ? 'bold 13px sans-serif' : '13px sans-serif';
    ctx.fillStyle = l.color;
    ctx.textBaseline = 'top';
    ctx.fillText(l.text, bx + padX, by + padY + i * lineH);
  });
  ctx.restore();
}

// ─── Move annotation ──────────────────────────────────────────────────────────
let moveAnnotation = null;

const ANNOTATION = {
  '!!': { label: 'Brilliant!',  color: '#00ee66', bg: 'rgba(0,60,20,0.92)'  },
  '!':  { label: 'Good move',   color: '#44dd44', bg: 'rgba(0,50,10,0.88)'  },
  '!?': { label: 'Interesting', color: '#aadd00', bg: 'rgba(40,50,0,0.88)'  },
  '?!': { label: 'Dubious',     color: '#ffaa00', bg: 'rgba(70,35,0,0.88)'  },
  '?':  { label: 'Mistake',     color: '#ff6600', bg: 'rgba(80,20,0,0.88)'  },
  '??': { label: 'Blunder!',    color: '#ff2222', bg: 'rgba(90,0,0,0.92)'   },
};

function evaluateMove(piece, fromRow, fromCol, wasThreatenedBefore, captured, wasPromotion) {
  const board = state.board;
  const isKing = piece.type === 'king';
  const nowThreatened = isThreatenedByChecker(piece.row, piece.col, board);
  const threatenedCount = state.chessPieces.filter(
    p => !p.dying && isThreatenedByChecker(p.row, p.col, board)
  ).length;

  if (isKing && nowThreatened) return '??';
  if (!captured && nowThreatened && threatenedCount >= 2) return '??';
  if (!captured && nowThreatened) return '?';
  if (wasPromotion) return nowThreatened ? '!?' : '!!';
  if (captured && wasThreatenedBefore && !nowThreatened) return '!!';
  if (captured?.isKing && !nowThreatened) return '!!';
  if (captured && nowThreatened) return '!?';
  if (captured && !nowThreatened) return '!';
  let nearRisk = 0;
  for (const dcc of [-2, 0, 2]) {
    const nr = piece.row-2, nc = piece.col+dcc;
    if (nr>=0 && nc>=0 && nc<COLS && board[nr]?.[nc]?.team==='checker') nearRisk++;
  }
  if (nearRisk >= 2) return '?!';
  return '';
}

function showMoveAnnotation(text, col, row) {
  if (!text) return;
  moveAnnotation = { text, x: col*CELL+CELL/2, y: row*CELL+6, startTime: performance.now() };
}

function drawAnnotation() {
  if (!moveAnnotation) return;
  const t = (performance.now() - moveAnnotation.startTime) / 2400;
  if (t >= 1) { moveAnnotation = null; return; }
  const alpha = t < 0.65 ? 1 : 1 - (t-0.65)/0.35;
  const yOff  = -t * 40;
  const { text, x, y } = moveAnnotation;
  const style = ANNOTATION[text] || { color: '#fff', bg: 'rgba(0,0,0,0.7)' };

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(text).width, px = 10, py = 6;
  const bx = x-tw/2-px, by = y+yOff-24-py, bw = tw+px*2, bh = 24+py*2, rad = 6;
  ctx.fillStyle = style.bg;
  ctx.beginPath();
  ctx.moveTo(bx+rad, by);    ctx.lineTo(bx+bw-rad, by);     ctx.arcTo(bx+bw, by,    bx+bw, by+rad,  rad);
  ctx.lineTo(bx+bw, by+bh-rad); ctx.arcTo(bx+bw, by+bh, bx+bw-rad, by+bh, rad);
  ctx.lineTo(bx+rad, by+bh);    ctx.arcTo(bx,    by+bh, bx,    by+bh-rad, rad);
  ctx.lineTo(bx, by+rad);        ctx.arcTo(bx,    by,    bx+rad, by,       rad);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = style.color;
  ctx.fillText(text, x, y+yOff);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textBaseline = 'top';
  ctx.fillText(ANNOTATION[text]?.label || '', x, y+yOff+2);
  ctx.restore();
}

// ─── Capture strips ───────────────────────────────────────────────────────────
function drawMiniPiece(drawCtx, key, cx, cy, tintColor) {
  if (!imgReady(key)) return;
  const img = IMAGES[key];
  const ratio = img.naturalWidth / img.naturalHeight;
  let w, h;
  if (ratio >= 1) { w = MINI; h = MINI/ratio; }
  else            { h = MINI; w = MINI*ratio; }
  const src = tintColor ? (getTinted(key, tintColor) || img) : img;
  drawCtx.drawImage(src, cx-w/2, cy-h/2, w, h);
}

function renderStrips() {
  const sw = leftStrip.width, sh = leftStrip.height;
  const cx = sw/2, gap = MINI+3, topPad = 14;

  lctx.clearRect(0, 0, sw, sh);
  lctx.fillStyle = '#111827'; lctx.fillRect(0, 0, sw, sh);
  lctx.save();
  lctx.font = 'bold 8px sans-serif'; lctx.textAlign = 'center';
  lctx.fillStyle = '#e94560'; lctx.fillText('LOST', cx, 9);
  lctx.restore();
  state.capturedByCheckers.forEach((type, i) => {
    drawMiniPiece(lctx, type, cx, topPad + i*gap + MINI/2, TINT_CHESS);
  });

  rctx.clearRect(0, 0, sw, sh);
  rctx.fillStyle = '#111827'; rctx.fillRect(0, 0, sw, sh);
  rctx.save();
  rctx.font = 'bold 8px sans-serif'; rctx.textAlign = 'center';
  rctx.fillStyle = '#44dd44'; rctx.fillText('TOOK', cx, 9);
  rctx.restore();
  state.capturedByChess.forEach(({ isKing, isLight }, i) => {
    const tint = isLight ? TINT_CHECKER_LIGHT : TINT_CHECKER;
    drawMiniPiece(rctx, isKing ? 'checker_king' : 'checker', cx, topPad + i*gap + MINI/2, tint);
  });
}

// ─── Board rendering ──────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawCheckIndicator();
  drawHighlights();

  const animIds = new Set(activeAnims.keys());
  for (const p of state.chessPieces) if (!animIds.has(p.id)) drawChessPiece(p);
  for (const c of state.checkers)    if (!animIds.has(c.id)) drawChecker(c);
  for (const p of state.chessPieces) if ( animIds.has(p.id)) drawChessPiece(p);
  for (const c of state.checkers)    if ( animIds.has(c.id)) drawChecker(c);

  drawAnnotation();
  drawTooltip();
}

function drawBoard() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r+c)%2===0 ? CLR.lightSquare : CLR.darkSquare;
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    }
}

function drawCheckIndicator() {
  if (state.phase !== 'player') return;
  const kings = state.chessPieces.filter(p => p.type === 'king' && !p.dying);
  if (kings.length !== 1) return; // multi-king: no check rules; 0 kings: already game over
  const king = kings[0];
  if (!isThreatenedByChecker(king.row, king.col, state.board)) return;
  const pulse = 0.28 + 0.18 * Math.sin(performance.now() / 180);
  ctx.fillStyle = `rgba(255,0,0,${pulse})`;
  ctx.fillRect(king.col*CELL, king.row*CELL, CELL, CELL);
}

function drawHighlights() {
  if (!state.selected) return;
  const { piece, moves } = state.selected;
  ctx.fillStyle = CLR.selected;
  ctx.fillRect(piece.col*CELL, piece.row*CELL, CELL, CELL);

  // Red: geometrically reachable but blocked by check
  const rawMoves = PIECE_DEFS[piece.type].getMoves(piece.row, piece.col, state.board);
  const legalSet = new Set(moves.map(([r, c]) => r*COLS+c));
  ctx.fillStyle = CLR.illegalHL;
  for (const [mr, mc] of rawMoves)
    if (!legalSet.has(mr*COLS+mc)) ctx.fillRect(mc*CELL, mr*CELL, CELL, CELL);

  // Blue: legal captures. Green: legal non-captures.
  for (const [mr, mc] of moves) {
    const target = state.board[mr]?.[mc];
    let isCapture = target?.team === 'checker';
    const isEP = !isCapture && piece.type==='pawn' && piece.row===3 && mc!==piece.col && !target &&
      state.enPassantCheckers.has(state.board[piece.row]?.[mc]?.id);
    if (isEP) isCapture = true;

    ctx.fillStyle = isCapture ? CLR.attackHL : CLR.highlight;
    ctx.fillRect(mc*CELL, mr*CELL, CELL, CELL);

    if (isCapture) {
      if (isEP) {
        ctx.strokeStyle = 'rgba(80,140,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(mc*CELL+CELL/2, piece.row*CELL+CELL/2, CELL*0.38, 0, Math.PI*2);
        ctx.stroke(); ctx.setLineDash([]);
      }
    } else {
      ctx.beginPath(); ctx.arc(mc*CELL+CELL/2, mr*CELL+CELL/2, 12, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,180,80,0.6)'; ctx.fill();
    }
  }
}

// ─── Piece drawing ────────────────────────────────────────────────────────────
const TRAIT_OUTLINE = { mercenary: 'rgba(255,215,0,0.92)', iron: 'rgba(130,210,255,0.92)', raider: 'rgba(255,100,0,0.92)' };

// Fallback image key + distinctive tint for each variant, used until dedicated art is loaded.
const VARIANT_RENDER = {
  amazon:        { fallback: 'queen',  tint: TINT_AMAZON      },
  archbishop:    { fallback: 'bishop', tint: TINT_ARCHBISHOP  },
  chancellor:    { fallback: 'rook',   tint: TINT_CHANCELLOR  },
  grasshopper:   { fallback: 'queen',  tint: TINT_GRASSHOPPER },
  berolina_pawn: { fallback: 'pawn',   tint: TINT_BEROLINA    },
  camel:         { fallback: 'knight', tint: TINT_CAMEL       },
  nightrider:    { fallback: 'knight', tint: TINT_NIGHTRIDER  },
};

// Draw the piece tinted with outlineColor at 4 diagonal offsets to create an outline effect.
function drawOutline(key, x, y, outlineColor) {
  const img = IMAGES[key];
  const tinted = getTinted(key, outlineColor);
  if (!tinted) return;
  const pad = 6, maxW = CELL-pad*2, maxH = CELL-pad*2;
  const ratio = img.naturalWidth / img.naturalHeight;
  let w, h;
  if (ratio >= 1) { w = maxW; h = maxW/ratio; }
  else            { h = maxH; w = maxH*ratio; }
  const off = 2;
  for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]])
    ctx.drawImage(tinted, x - w/2 + dx*off, y - h/2 + dy*off, w, h);
}

function drawPieceImage(key, x, y, tintColor) {
  const img = IMAGES[key];
  const pad = 6, maxW = CELL-pad*2, maxH = CELL-pad*2;
  const ratio = img.naturalWidth / img.naturalHeight;
  let w, h;
  if (ratio >= 1) { w = maxW; h = maxW/ratio; }
  else            { h = maxH; w = maxH*ratio; }
  const src = tintColor ? (getTinted(key, tintColor) || img) : img;
  ctx.drawImage(src, x-w/2, y-h/2, w, h);
}

function drawChessPiece(p) {
  const { x, y } = getPieceRenderPos(p);
  const vr     = VARIANT_RENDER[p.type];
  const imgKey = vr && !imgReady(p.type) ? vr.fallback : p.type;
  const tint   = vr ? vr.tint : TINT_CHESS;
  if (!imgReady(imgKey)) return;
  const outlineColor = TRAIT_OUTLINE[p.trait];
  if (outlineColor) drawOutline(imgKey, x, y, outlineColor);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = activeAnims.has(p.id) ? 14 : 6;
  drawPieceImage(imgKey, x, y, tint);
  ctx.restore();
}

function drawChecker(c) {
  const { x, y } = getPieceRenderPos(c);
  const imgKey = c.isTripleKing ? 'checker_triple_king'
               : c.isFlyingKing ? 'checker_flying_king'
               : c.isKing       ? 'checker_king'
               :                  'checker';
  if (!imgReady(imgKey)) return;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = activeAnims.has(c.id) ? 14 : 6;
  drawPieceImage(imgKey, x, y, c.isLight ? TINT_CHECKER_LIGHT : TINT_CHECKER);
  ctx.restore();
}
