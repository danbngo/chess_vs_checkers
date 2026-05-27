// ─── Images ───────────────────────────────────────────────────────────────────
const IMAGES    = {};
const tintCache = {};

for (const [key, src] of [
  ['pawn',         'images/pawn.png'],
  ['knight',       'images/knight.png'],
  ['bishop',       'images/bishop.png'],
  ['rook',         'images/rook.png'],
  ['queen',        'images/queen.png'],
  ['king',         'images/king.png'],
  ['checker',             'images/checker.png'],
  ['checker_king',        'images/checker_king.png'],
  ['checker_flying_king', 'images/checker_flying_king.png'],
  ['checker_triple_king', 'images/checker_triple_king.png'],
  ['checker_mother',      'images/checkers_mother.png'],
  ['amazon',        'images/amazon.png'],
  ['archbishop',    'images/archbishop.png'],
  ['chancellor',    'images/chancellor.png'],
  ['grasshopper',   'images/grasshopper.png'],
  ['berolina_pawn', 'images/berolina_pawn.png'],
  ['camel',         'images/camel.png'],
  ['nightrider',    'images/nightrider.png'],
  ['go_piece',      'images/go_piece.png'],
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
  const pos = toChessNotation(piece.row, piece.col).toUpperCase();

  const traitColors = { Mercenary: '#ffd700', Iron: '#82d2ff', Raider: '#ff6400', Chameleon: '#c070ff' };

  let lines = [];
  if (piece.team === 'chess' && piece.type === 'checker') {
    // Chameleon-transformed player checker
    const typeStr = piece.isTripleKing ? 'Triple King' : piece.isFlyingKing ? 'Flying King'
                  : piece.isKing ? 'Checker King' : 'Checker';
    const typeKey = piece.isTripleKing ? 'checker_triple_king' : piece.isFlyingKing ? 'checker_flying_king'
                  : piece.isKing ? 'checker_king' : 'checker';
    const traitName = piece.trait ? piece.trait.charAt(0).toUpperCase() + piece.trait.slice(1) : null;
    lines = [
      { text: `${typeStr}  ${pos}`, bold: true, color: '#c070ff' },
      { text: 'Owner: Chess (Chameleon)', bold: false, color: '#aac8ff' },
    ];
    if (traitName) lines.push({ text: `Trait: ${traitName}`, bold: false, color: traitColors[traitName] || '#ccc' });
    const desc = CHECKER_DESCS[typeKey];
    if (desc) {
      const words = desc.split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 34) { lines.push({ text: line.trim(), bold: false, color: '#ddd' }); line = w; }
        else line += (line ? ' ' : '') + w;
      }
      if (line) lines.push({ text: line.trim(), bold: false, color: '#ddd' });
    }
  } else if (piece.team === 'chess') {
    const def = PIECE_DEFS[piece.type];
    if (!def) return;
    const traitName = piece.trait
      ? piece.trait.charAt(0).toUpperCase() + piece.trait.slice(1)
      : null;
    lines = [
      { text: `${def.name}  ${pos}`, bold: true, color: '#fff' },
      { text: 'Owner: Chess', bold: false, color: '#aac8ff' },
    ];
    if (traitName) {
      lines.push({ text: `Trait: ${traitName}`, bold: false, color: traitColors[traitName] || '#ccc' });
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
  } else if (piece.team === 'checker') {
    const typeStr = piece.isMotherChecker ? 'Mother Checker'
                  : piece.isTripleKing   ? 'Triple King'
                  : piece.isFlyingKing   ? 'Flying King'
                  : piece.isKing         ? 'Checker King'
                  :                        'Checker';
    const typeKey = piece.isMotherChecker ? 'checker_mother'
                  : piece.isTripleKing   ? 'checker_triple_king'
                  : piece.isFlyingKing   ? 'checker_flying_king'
                  : piece.isKing         ? 'checker_king'
                  :                        'checker';
    lines = [
      { text: `${typeStr}  ${pos}`, bold: true, color: '#fff' },
      { text: 'Owner: Checkers', bold: false, color: '#ff8888' },
    ];
    const desc = CHECKER_DESCS[typeKey];
    if (desc) {
      const words = desc.split(' ');
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
  } else if (piece.team === 'go') {
    lines = [
      { text: `Go Stone  ${pos}`, bold: true, color: '#fff' },
      { text: 'Owner: Go', bold: false, color: '#aaaa88' },
    ];
  }

  if (!lines.length) return;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  const lineH = 17, padX = 10, padY = 8;
  const maxW  = lines.reduce((m, l) => {
    ctx.font = l.bold ? 'bold 13px sans-serif' : '13px sans-serif';
    return Math.max(m, ctx.measureText(l.text).width);
  }, 0);
  const bw = maxW + padX * 2, bh = lines.length * lineH + padY * 2;

  const isPortrait = window.innerWidth < window.innerHeight && window.innerWidth <= 700;
  const isLandscapeMobile = window.innerWidth <= 700 && window.innerWidth >= window.innerHeight;
  let bx, by;
  if (isPortrait) {
    bx = canvas.width / 2 - bw / 2;
    by = canvas.height - bh - 4;
  } else if (isLandscapeMobile) {
    bx = canvas.width - bw - 4;
    by = Math.min(Math.max(my - bh / 2, 2), canvas.height - bh - 2);
  } else {
    bx = mx + 14; by = my - bh / 2;
    if (bx + bw > canvas.width)  bx = mx - bw - 14;
    if (by < 2)                  by = 2;
    if (by + bh > canvas.height) by = canvas.height - bh - 2;
  }

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
let eventAnnotation = null;

function showEventAnnotation(label, sublabel, col, row, color, bg) {
  eventAnnotation = { label, sublabel, color, bg,
    x: col * CELL + CELL / 2, y: row * CELL + 6, startTime: performance.now() };
}

function drawEventAnnotation() {
  if (!eventAnnotation) return;
  const t = (performance.now() - eventAnnotation.startTime) / 2400;
  if (t >= 1) { eventAnnotation = null; return; }
  const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
  const yOff  = -t * 40;
  const { label, sublabel, color, bg, x, y } = eventAnnotation;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(label).width, px = 10, py = 6;
  const bx = x - tw / 2 - px, by = y + yOff - 24 - py, bw = tw + px * 2, bh = 24 + py * 2, rad = 6;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(bx + rad, by);       ctx.lineTo(bx + bw - rad, by);        ctx.arcTo(bx + bw, by,       bx + bw, by + rad,    rad);
  ctx.lineTo(bx + bw, by + bh - rad); ctx.arcTo(bx + bw, by + bh, bx + bw - rad, by + bh, rad);
  ctx.lineTo(bx + rad, by + bh);      ctx.arcTo(bx,       by + bh, bx,       by + bh - rad, rad);
  ctx.lineTo(bx, by + rad);           ctx.arcTo(bx,       by,      bx + rad, by,             rad);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + yOff);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textBaseline = 'top';
  ctx.fillText(sublabel, x, y + yOff + 2);
  ctx.restore();
}

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
  if (leftStrip.width > leftStrip.height) {
    renderStripsHorizontal();
  } else {
    renderStripsVertical();
  }
}

function renderStripsVertical() {
  const sw = leftStrip.width, sh = leftStrip.height;
  const cx = sw/2, gap = MINI+3, topPad = 14;

  // Left strip: chess pieces lost to enemy action
  lctx.clearRect(0, 0, sw, sh);
  lctx.fillStyle = '#111827'; lctx.fillRect(0, 0, sw, sh);
  lctx.save();
  lctx.font = 'bold 8px sans-serif'; lctx.textAlign = 'center';
  lctx.fillStyle = '#e94560'; lctx.fillText('LOST', cx, 9);
  lctx.restore();
  const lostList = state.campaign === 'go' ? state.capturedByGo : state.capturedByCheckers;
  lostList.forEach((type, i) => {
    drawMiniPiece(lctx, type, cx, topPad + i*gap + MINI/2, TINT_CHESS);
  });

  // Right strip: enemies captured by chess
  rctx.clearRect(0, 0, sw, sh);
  rctx.fillStyle = '#111827'; rctx.fillRect(0, 0, sw, sh);
  rctx.save();
  rctx.font = 'bold 8px sans-serif'; rctx.textAlign = 'center';
  rctx.fillStyle = '#44dd44'; rctx.fillText('TOOK', cx, 9);
  rctx.restore();
  if (state.campaign === 'go') {
    state.capturedGoByChess.forEach((_, i) => {
      const cy = topPad + i*gap + MINI/2, r = MINI/2 - 2;
      rctx.fillStyle = '#111';
      rctx.beginPath(); rctx.arc(cx, cy, r, 0, Math.PI*2); rctx.fill();
    });
  } else {
    state.capturedByChess.forEach(({ isKing, isLight }, i) => {
      const tint = isLight ? TINT_CHECKER_LIGHT : TINT_CHECKER;
      drawMiniPiece(rctx, isKing ? 'checker_king' : 'checker', cx, topPad + i*gap + MINI/2, tint);
    });
  }
}

function renderStripsHorizontal() {
  const sw = leftStrip.width, sh = leftStrip.height;
  const cy = sh / 2, gap = MINI + 3, leftPad = 36; // 36px reserved for label

  // Left strip: chess pieces lost to enemy action
  lctx.clearRect(0, 0, sw, sh);
  lctx.fillStyle = '#111827'; lctx.fillRect(0, 0, sw, sh);
  lctx.save();
  lctx.font = 'bold 8px sans-serif'; lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
  lctx.fillStyle = '#e94560'; lctx.fillText('LOST', 18, cy);
  lctx.restore();
  const lostList = state.campaign === 'go' ? state.capturedByGo : state.capturedByCheckers;
  lostList.forEach((type, i) => {
    drawMiniPiece(lctx, type, leftPad + i * gap + MINI / 2, cy, TINT_CHESS);
  });

  // Right strip: enemies captured by chess
  rctx.clearRect(0, 0, sw, sh);
  rctx.fillStyle = '#111827'; rctx.fillRect(0, 0, sw, sh);
  rctx.save();
  rctx.font = 'bold 8px sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
  rctx.fillStyle = '#44dd44'; rctx.fillText('TOOK', 18, cy);
  rctx.restore();
  if (state.campaign === 'go') {
    state.capturedGoByChess.forEach((_, i) => {
      const cx = leftPad + i * gap + MINI / 2, r = MINI / 2 - 2;
      rctx.fillStyle = '#111';
      rctx.beginPath(); rctx.arc(cx, cy, r, 0, Math.PI * 2); rctx.fill();
    });
  } else {
    state.capturedByChess.forEach(({ isKing, isLight }, i) => {
      const tint = isLight ? TINT_CHECKER_LIGHT : TINT_CHECKER;
      drawMiniPiece(rctx, isKing ? 'checker_king' : 'checker', leftPad + i * gap + MINI / 2, cy, tint);
    });
  }
}

// ─── Go piece rendering ───────────────────────────────────────────────────────
function drawGoPiece(g) {
  const { x, y } = getPieceRenderPos(g);
  if (!imgReady('go_piece')) return;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 6;
  drawPieceImage('go_piece', x, y, '#1a1a1a');
  ctx.restore();
}

// ─── Go territory overlay ─────────────────────────────────────────────────────
function drawGoTerritoryOverlay() {
  if (state.campaign !== 'go') return;
  const reach = findReachableSquares();
  ctx.fillStyle = 'rgba(180,30,30,0.22)';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!reach[r][c] && !state.board[r]?.[c]) // enclosed empty squares only
        ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
}

// ─── Board rendering ──────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawGoTerritoryOverlay();
  if (state.campaign !== 'go') drawCheckIndicator();
  drawHighlights();
  drawThreatTints();

  for (const g of state.goPieces) drawGoPiece(g);

  const animIds = new Set(activeAnims.keys());
  for (const p of state.chessPieces) if (!animIds.has(p.id)) drawChessPiece(p);
  for (const c of state.checkers)    if (!animIds.has(c.id)) drawChecker(c);
  for (const p of state.chessPieces) if ( animIds.has(p.id)) drawChessPiece(p);
  for (const c of state.checkers)    if ( animIds.has(c.id)) drawChecker(c);

  drawAnnotation();
  drawEventAnnotation();
  drawTooltip();
}

function drawBoard() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r+c)%2===0 ? CLR.lightSquare : CLR.darkSquare;
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    }

  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const onLight = 'rgba(100,60,20,0.7)';
  const onDark  = 'rgba(240,210,160,0.7)';

  // Rank numbers (8–1) in top-left corner of left-column squares
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = (r % 2 === 0) ? onLight : onDark;
    ctx.fillText(String(8 - r), 3, r * CELL + 2);
  }

  // File letters (a–h) in bottom-right corner of bottom-row squares
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = ((ROWS - 1 + c) % 2 === 0) ? onLight : onDark;
    ctx.fillText(String.fromCharCode(97 + c), (c + 1) * CELL - 3, ROWS * CELL - 2);
  }
  ctx.restore();
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

function drawThreatTints() {
  if (state.campaign === 'go' || !state.board) return;
  ctx.fillStyle = 'rgba(220,50,50,0.22)';
  for (const p of state.chessPieces) {
    if (p.dying) continue;
    if (isThreatenedByChecker(p.row, p.col, state.board))
      ctx.fillRect(p.col*CELL, p.row*CELL, CELL, CELL);
  }
  for (const c of state.checkers) {
    if (c.dying) continue;
    if (isAttackedByChess(c.row, c.col, state.board))
      ctx.fillRect(c.col*CELL, c.row*CELL, CELL, CELL);
  }
}

function drawHighlights() {
  if (!state.selected) return;
  const { type, piece } = state.selected;

  if (type === 'chess') {
    const { moves } = state.selected;
    ctx.fillStyle = CLR.selected;
    ctx.fillRect(piece.col*CELL, piece.row*CELL, CELL, CELL);

    // Red: geometrically reachable but blocked by check
    const rawMoves = getMovesForPiece(piece, state.board);
    const legalSet = new Set(moves.map(([r, c]) => r*COLS+c));
    ctx.fillStyle = CLR.illegalHL;
    for (const [mr, mc] of rawMoves)
      if (!legalSet.has(mr*COLS+mc)) ctx.fillRect(mc*CELL, mr*CELL, CELL, CELL);

    // Blue: legal captures. Red: threatened destination. Green: safe move.
    for (const [mr, mc] of moves) {
      const target = state.board[mr]?.[mc];
      let isCapture = target?.team === 'checker' || target?.team === 'go';
      const isEP = !isCapture && piece.type==='pawn' && piece.row===3 && mc!==piece.col && !target &&
        state.enPassantCheckers.has(state.board[piece.row]?.[mc]?.id);
      if (isEP) isCapture = true;
      // Player checker: capture is a jump (nothing at landing square, but checker along path)
      if (!isCapture && piece.type === 'checker' && piece.team === 'chess')
        isCapture = findPlayerCheckerCaptures(piece, mr, mc, state.board).length > 0;

      let hlColor = CLR.highlight;
      if (isCapture) {
        hlColor = CLR.attackHL;
      } else if (state.campaign !== 'go') {
        const tempBoard = state.board.map(row => [...row]);
        tempBoard[piece.row][piece.col] = null;
        tempBoard[mr][mc] = { ...piece, row: mr, col: mc };
        if (isThreatenedByChecker(mr, mc, tempBoard)) hlColor = 'rgba(220,50,50,0.55)';
      }
      ctx.fillStyle = hlColor;
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

  } else if (type === 'checker') {
    const { moves } = state.selected;
    ctx.fillStyle = CLR.selected;
    ctx.fillRect(piece.col*CELL, piece.row*CELL, CELL, CELL);

    for (const move of moves) {
      if (move.capture) {
        // Pieces that would be captured
        ctx.fillStyle = 'rgba(220,50,50,0.55)';
        ctx.fillRect(move.capture.col*CELL, move.capture.row*CELL, CELL, CELL);
        if (move.capture2) ctx.fillRect(move.capture2.col*CELL, move.capture2.row*CELL, CELL, CELL);
        // Landing square after capture
        ctx.fillStyle = CLR.attackHL;
        ctx.fillRect(move.col*CELL, move.row*CELL, CELL, CELL);
      } else {
        // Normal movement square
        ctx.fillStyle = 'rgba(255,160,40,0.45)';
        ctx.fillRect(move.col*CELL, move.row*CELL, CELL, CELL);
      }
    }

  } else if (type === 'go') {
    const { group, enclosed } = state.selected;
    // Territory this group helps enclose
    ctx.fillStyle = 'rgba(255,200,60,0.3)';
    for (const [r, c] of enclosed)
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    // Connected group members
    for (const [r, c] of group) {
      ctx.fillStyle = (r === piece.row && c === piece.col) ? CLR.selected : 'rgba(50,180,255,0.4)';
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    }
  }
}

// ─── Piece drawing ────────────────────────────────────────────────────────────
const TRAIT_OUTLINE = { mercenary: 'rgba(255,215,0,0.92)', iron: 'rgba(130,210,255,0.92)', raider: 'rgba(255,100,0,0.92)', chameleon: 'rgba(180,80,255,0.92)' };

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

// Render a piece icon into a small canvas (used by the shop).
function drawShopIcon(iconCanvas, type, trait) {
  const ictx = iconCanvas.getContext('2d');
  const sz   = iconCanvas.width;
  ictx.clearRect(0, 0, sz, sz);
  const vr     = VARIANT_RENDER[type];
  const imgKey = vr && !imgReady(type) ? vr.fallback : type;
  const tint   = vr ? vr.tint : TINT_CHESS;
  if (!imgReady(imgKey)) return;
  const img   = IMAGES[imgKey];
  const pad   = 5, maxD = sz - pad * 2;
  const ratio = img.naturalWidth / img.naturalHeight;
  const w  = ratio >= 1 ? maxD : maxD * ratio;
  const h  = ratio >= 1 ? maxD / ratio : maxD;
  const dx = sz / 2 - w / 2, dy = sz / 2 - h / 2;
  if (trait && TRAIT_OUTLINE[trait]) {
    const ol = getTinted(imgKey, TRAIT_OUTLINE[trait]);
    if (ol) for (const [ox, oy] of [[-1,-1],[-1,1],[1,-1],[1,1]])
      ictx.drawImage(ol, dx + ox, dy + oy, w, h);
  }
  ictx.drawImage(getTinted(imgKey, tint) || img, dx, dy, w, h);
}

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

  // Chameleon-transformed player checker: render as checker with chess team tint
  if (p.type === 'checker') {
    const imgKey = p.isTripleKing  ? 'checker_triple_king'
                 : p.isFlyingKing  ? 'checker_flying_king'
                 : p.isKing        ? 'checker_king'
                 :                   'checker';
    if (!imgReady(imgKey)) return;
    const outlineColor = TRAIT_OUTLINE[p.trait];
    if (outlineColor) drawOutline(imgKey, x, y, outlineColor);
    ctx.save();
    ctx.shadowColor = 'rgba(160,80,255,0.85)';
    ctx.shadowBlur  = activeAnims.has(p.id) ? 16 : 10;
    drawPieceImage(imgKey, x, y, TINT_CHESS);
    ctx.restore();
    return;
  }

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
  const imgKey = c.isMotherChecker ? 'checker_mother'
               : c.isTripleKing   ? 'checker_triple_king'
               : c.isFlyingKing   ? 'checker_flying_king'
               : c.isKing         ? 'checker_king'
               :                    'checker';
  if (!imgReady(imgKey)) return;
  ctx.save();
  ctx.shadowColor = c.isMotherChecker ? 'rgba(180,0,220,0.8)' : 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = c.isMotherChecker ? 18 : activeAnims.has(c.id) ? 14 : 6;
  drawPieceImage(imgKey, x, y, c.isLight ? TINT_CHECKER_LIGHT : TINT_CHECKER);
  ctx.restore();
}
