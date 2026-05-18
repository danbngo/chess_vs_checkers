// ─── Images ───────────────────────────────────────────────────────────────────
const IMAGES    = {};
const tintCache = {};

for (const [key, src] of [
  ['pawn',         'images/pawn.png'],
  ['knight',       'images/knight.png'],
  ['bishop',       'images/bishop.png'],
  ['queen',        'images/queen.png'],
  ['king',         'images/king.png'],
  ['checker',      'images/checker.png'],
  ['checker_king', 'images/checker_king.png'],
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
  state.capturedByChess.forEach(({ isKing }, i) => {
    drawMiniPiece(rctx, isKing ? 'checker_king' : 'checker', cx, topPad + i*gap + MINI/2, TINT_CHECKER);
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
  const king = state.chessPieces.find(p => p.type==='king' && !p.dying);
  if (!king || !isThreatenedByChecker(king.row, king.col, state.board)) return;
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
  const r = CELL * 0.38;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = activeAnims.has(p.id) ? 14 : 6;
  if (imgReady(p.type)) {
    drawPieceImage(p.type, x, y, TINT_CHESS);
  } else {
    switch (p.type) {
      case 'pawn':   drawPawnShape(x, y, r, CLR.chess);   break;
      case 'knight': drawKnightShape(x, y, r, CLR.chess); break;
      case 'bishop': drawBishopShape(x, y, r, CLR.chess); break;
      case 'rook':   drawRookShape(x, y, r, CLR.chess);   break;
      case 'queen':  drawQueenShape(x, y, r, CLR.chess);  break;
      case 'king':   drawKingShape(x, y, r, CLR.chess);   break;
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#333'; ctx.font = `bold ${Math.round(r*0.7)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(PIECE_DEFS[p.type].symbol, x, y);
  }
  ctx.restore();
}

function drawChecker(c) {
  const { x, y } = getPieceRenderPos(c);
  const r = CELL * 0.38;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = activeAnims.has(c.id) ? 14 : 6;
  const imgKey = c.isKing ? 'checker_king' : 'checker';
  if (imgReady(imgKey)) {
    drawPieceImage(imgKey, x, y, TINT_CHECKER);
  } else {
    ctx.beginPath(); ctx.ellipse(x, y+5, r, r*0.3, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    const g = ctx.createRadialGradient(x-r*0.3, y-r*0.3, r*0.1, x, y, r);
    g.addColorStop(0, '#e74c3c'); g.addColorStop(1, '#c0392b');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#7b0000'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r*0.65, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,160,160,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    if (c.isKing) {
      ctx.shadowBlur = 0; ctx.fillStyle = '#f39c12';
      ctx.font = `bold ${Math.round(r*0.7)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♔', x, y);
    }
  }
  ctx.restore();
}

// ─── Vector fallback shapes ───────────────────────────────────────────────────
function drawPawnShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.7, r*0.25, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath(); ctx.rect(x-r*0.15, y-r*0.2, r*0.3, r*0.7);
  ctx.fillStyle = clr.body; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y-r*0.3, r*0.38, 0, Math.PI*2);
  const g = ctx.createRadialGradient(x-r*0.1, y-r*0.4, 0, x, y-r*0.3, r*0.38);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawKnightShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.75, r*0.25, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x-r*0.2, y+r*0.5);   ctx.lineTo(x-r*0.45, y+r*0.1);
  ctx.lineTo(x-r*0.5, y-r*0.2);   ctx.lineTo(x-r*0.3,  y-r*0.6);
  ctx.lineTo(x+r*0.1, y-r*0.8);   ctx.lineTo(x+r*0.45, y-r*0.5);
  ctx.lineTo(x+r*0.5, y-r*0.1);   ctx.lineTo(x+r*0.35, y+r*0.5); ctx.closePath();
  const g = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawBishopShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.7, r*0.25, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x-r*0.45, y+r*0.5);
  ctx.bezierCurveTo(x-r*0.45, y, x-r*0.2, y-r*0.5, x, y-r*0.9);
  ctx.bezierCurveTo(x+r*0.2, y-r*0.5, x+r*0.45, y, x+r*0.45, y+r*0.5); ctx.closePath();
  const g = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y-r*0.85, r*0.15, 0, Math.PI*2);
  ctx.fillStyle = clr.accent; ctx.fill(); ctx.stroke();
}
function drawRookShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.75, r*0.25, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath(); ctx.rect(x-r*0.4, y-r*0.5, r*0.8, r*1.0);
  const g = ctx.createLinearGradient(x-r, y, x+r, y);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.rect(x+i*r*0.28-r*0.14, y-r*0.85, r*0.25, r*0.38);
    ctx.fillStyle = clr.body; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  }
}
function drawQueenShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.78, r*0.28, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x-r*0.5, y+r*0.5);
  ctx.bezierCurveTo(x-r*0.5, y-r*0.1, x-r*0.25, y-r*0.4, x, y-r*0.6);
  ctx.bezierCurveTo(x+r*0.25, y-r*0.4, x+r*0.5, y-r*0.1, x+r*0.5, y+r*0.5); ctx.closePath();
  const g = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  for (const [ox, oy] of [[-r*0.4,-r*0.55],[0,-r*0.75],[r*0.4,-r*0.55]]) {
    ctx.beginPath(); ctx.arc(x+ox, y+oy, r*0.13, 0, Math.PI*2);
    ctx.fillStyle = '#ffd700'; ctx.fill(); ctx.stroke();
  }
}
function drawKingShape(x, y, r, clr) {
  ctx.beginPath(); ctx.ellipse(x, y+r*0.6, r*0.78, r*0.28, 0, 0, Math.PI*2);
  ctx.fillStyle = clr.outline; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x-r*0.48, y+r*0.5);
  ctx.bezierCurveTo(x-r*0.48, y-r*0.1, x-r*0.22, y-r*0.4, x, y-r*0.55);
  ctx.bezierCurveTo(x+r*0.22, y-r*0.4, x+r*0.48, y-r*0.1, x+r*0.48, y+r*0.5); ctx.closePath();
  const g = ctx.createLinearGradient(x-r, y-r, x+r, y+r);
  g.addColorStop(0, '#fff'); g.addColorStop(1, clr.body);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = clr.outline; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y-r*0.5);    ctx.lineTo(x, y-r*0.9);          ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-r*0.22, y-r*0.72); ctx.lineTo(x+r*0.22, y-r*0.72); ctx.stroke();
}
