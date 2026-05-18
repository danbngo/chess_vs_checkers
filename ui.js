// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateUI() {
  document.getElementById('wave-label').textContent  = `Wave ${state.wave}`;
  document.getElementById('moves-label').textContent = `Moves: ${state.moveCount}`;
  document.getElementById('score-label').textContent = `$${state.dollars}`;
  const pot = state.waveCheckerCount > 0
    ? calcEarnings(state.moveCount, state.waveCheckerCount) : 0;
  document.getElementById('potential-label').textContent = pot > 0 ? `(+$${pot})` : '';
}

function showMessage(title, body, onContinue) {
  const overlay = document.getElementById('message-overlay');
  document.getElementById('message-title').textContent = title;
  document.getElementById('message-body').textContent  = body;
  overlay.classList.remove('hidden');
  document.getElementById('message-btn').onclick = () => {
    overlay.classList.add('hidden'); onContinue();
  };
}

// ─── Earnings & shop ──────────────────────────────────────────────────────────
function calcEarnings(moveCount, checkerCount) {
  const max   = Math.max(10, checkerCount * 12);
  const ratio = moveCount / Math.max(1, checkerCount);
  if (ratio <= 2) return max;
  if (ratio >= 5) return 1;
  const t = (ratio - 2) / 3;
  return Math.max(1, Math.round(max - t * (max-1)));
}

function pickTrait() {
  const r = Math.random();
  if (r < 0.20) return 'mercenary';
  if (r < 0.35) return 'iron';
  return null;
}

function waveShopAdditions(wave) {
  const livePieces = state.chessPieces.filter(p => !p.dying);
  let backSpace  = 8 - livePieces.filter(p => p.type !== 'pawn').length
                     - state.shop.filter(s => s.type !== 'pawn').length;
  let frontSpace = 8 - livePieces.filter(p => p.type === 'pawn').length
                     - state.shop.filter(s => s.type === 'pawn').length;

  if (backSpace <= 0 && frontSpace <= 0) return [];

  const backPool = ['knight', 'knight', 'bishop', 'bishop'];
  if (wave >= 3) backPool.push('rook', 'king');
  if (wave >= 5) backPool.push('queen');

  const count = Math.min(2 + Math.floor((wave - 1) / 2), 5);
  const picks = [];

  if (frontSpace > 0) { picks.push('pawn'); frontSpace--; }

  let tries = 0;
  while (picks.length < count && tries < 30) {
    tries++;
    const canBack  = backSpace > 0;
    const canFront = frontSpace > 0;
    if (!canBack && !canFront) break;
    if (canBack && (!canFront || Math.random() < 0.7)) {
      picks.push(backPool[Math.floor(Math.random() * backPool.length)]);
      backSpace--;
    } else {
      picks.push('pawn');
      frontSpace--;
    }
  }

  return picks.map(type => {
    const trait = pickTrait();
    const base  = PIECE_COSTS[type];
    const cost  = trait === 'mercenary' ? Math.max(1, Math.round(base * 0.5))
                : trait === 'iron'      ? base * 2
                : base;
    return { type, cost, trait };
  });
}

function showShop(earned, nextWave) {
  state.dollars += earned;
  state.shop.push(...waveShopAdditions(state.wave));
  state.phase = 'shop';

  document.getElementById('shop-title').textContent    = `Wave ${state.wave} Cleared!`;
  document.getElementById('shop-earnings').textContent =
    `+$${earned}  (${state.moveCount} moves · ${state.waveCheckerCount} checkers)`;

  const refresh = () => {
    document.getElementById('shop-balance').textContent = `Balance: $${state.dollars}`;
    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    const liveNonPawns = state.chessPieces.filter(p => !p.dying && p.type !== 'pawn').length;
    const livePawns    = state.chessPieces.filter(p => !p.dying && p.type === 'pawn').length;
    const backFull  = liveNonPawns >= 8;
    const frontFull = livePawns >= 8;

    // Track counts for canonical position label (best-guess slot for each type)
    const labelCounts = {};
    state.chessPieces.filter(p => !p.dying).forEach(p => {
      labelCounts[p.type] = (labelCounts[p.type] || 0) + 1;
    });

    state.shop.forEach((item, i) => {
      const isPawn = item.type === 'pawn';
      const full   = isPawn ? frontFull : backFull;

      const idx       = labelCounts[item.type] || 0;
      labelCounts[item.type] = idx + 1;
      const canonical = (CHESS_SLOTS[item.type] || [])[idx];
      const pos       = canonical ? toChessNotation(canonical[0], canonical[1]) : null;

      const div = document.createElement('div');
      div.className = 'shop-item';
      const nm  = document.createElement('div'); nm.className  = 'shop-item-name';
      nm.textContent = pos ? `${pos.toUpperCase()} ${PIECE_DEFS[item.type].name}` : PIECE_DEFS[item.type].name;
      if (item.trait) {
        const tr = document.createElement('div');
        tr.className = `shop-item-trait trait-${item.trait}`;
        tr.textContent = item.trait === 'mercenary' ? 'Mercenary' : 'Iron';
        div.appendChild(tr);
      }
      const cs  = document.createElement('div'); cs.className  = 'shop-item-cost';
      cs.textContent = `$${item.cost}`;
      const btn = document.createElement('button'); btn.className = 'shop-buy-btn';
      btn.textContent = full ? 'Full' : 'Buy';
      btn.disabled    = full || state.dollars < item.cost;
      btn.onclick = () => {
        if (full || state.dollars < item.cost) return;
        state.dollars -= item.cost;
        state.shop.splice(i, 1);
        state.chessPieces.push({ type: item.type, team: 'chess', id: newId(),
          dying: false, moved: false, row: 0, col: 0 });
        refresh();
      };
      div.append(nm, cs, btn);
      container.appendChild(div);
    });
  };

  refresh();
  document.getElementById('shop-continue').textContent = `Start Wave ${nextWave}`;
  document.getElementById('shop-continue').onclick = () => {
    document.getElementById('shop-overlay').classList.add('hidden');
    startWave(nextWave, state.chessPieces);
  };
  document.getElementById('shop-overlay').classList.remove('hidden');
}

// ─── Pawn promotion UI ────────────────────────────────────────────────────────
function showPromotion(piece, onChoice) {
  const opts = document.getElementById('piece-options');
  opts.innerHTML = '';
  for (const type of ['queen', 'knight']) {
    const btn = document.createElement('button');
    btn.className = 'piece-option-btn';
    btn.textContent = PIECE_DEFS[type].name;
    btn.onclick = () => {
      document.getElementById('piece-select').classList.add('hidden');
      onChoice(type);
    };
    opts.appendChild(btn);
  }
  document.getElementById('piece-select').classList.remove('hidden');
}

// ─── Wave / game events ───────────────────────────────────────────────────────
function waveWon() {
  state.phase = 'wave_end';
  updateUI();
  if (state.wave >= MAX_WAVE) {
    showMessage('Victory!',
      `You cleared all ${MAX_WAVE} waves! Final score: $${state.dollars}.`,
      () => {
        document.getElementById('title-screen').classList.remove('hidden');
        renderTitleSaveSlots();
      });
    return;
  }
  showShop(calcEarnings(state.moveCount, state.waveCheckerCount), state.wave + 1);
}

function gameLost() {
  state.phase = 'wave_end';
  showMessage('Defeated!', `Your king fell. You had $${state.dollars}.`, () => {
    state.dollars = 0; state.shop = []; state.moveCount = 0; state.nextId = 0;
    startWave(1, initialChessPieces());
  });
}

// ─── Save / Load ──────────────────────────────────────────────────────────────
const SAVE_KEY = 'cvsc_saves';

function getSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || [null, null, null]; }
  catch { return [null, null, null]; }
}

function saveGame(slot) {
  const saves = getSaves();
  saves[slot] = {
    wave: state.wave, dollars: state.dollars, moveCount: state.moveCount,
    waveCheckerCount: state.waveCheckerCount, shop: state.shop, nextId: state.nextId,
    chessPieces: state.chessPieces.map(p =>
      ({ type: p.type, team: p.team, row: p.row, col: p.col, moved: p.moved, id: p.id })),
    checkers: state.checkers.map(c =>
      ({ team: c.team, row: c.row, col: c.col, isKing: c.isKing, id: c.id })),
    capturedByChess:    state.capturedByChess,
    capturedByCheckers: state.capturedByCheckers,
    date: new Date().toLocaleString(),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); }
  catch { alert('Could not save — localStorage unavailable.'); }
}

function loadGame(slot) {
  const save = getSaves()[slot];
  if (!save) return;
  state.wave             = save.wave;
  state.dollars          = save.dollars          || 0;
  state.moveCount        = save.moveCount        || 0;
  state.waveCheckerCount = save.waveCheckerCount || 0;
  state.shop             = save.shop             || [];
  state.nextId           = save.nextId;
  state.chessPieces      = save.chessPieces.map(p => ({ ...p, dying: false }));
  state.checkers         = save.checkers.map(c  => ({ ...c, type: 'checker', dying: false }));
  state.capturedByChess    = save.capturedByChess    || [];
  state.capturedByCheckers = save.capturedByCheckers || [];
  state.selected = null; state.phase = 'player';
  state.enPassantCheckers = new Set();
  moveAnnotation = null;
  syncBoard(); updateUI(); renderStrips();
  document.getElementById('menu-overlay').classList.add('hidden');
}

function renderMenuSlots() {
  const saves     = getSaves();
  const container = document.getElementById('menu-slots');
  if (!container) return;
  container.innerHTML = '';
  saves.forEach((save, i) => {
    const slot = document.createElement('div');
    slot.className = 'save-slot';

    const info = document.createElement('div');
    info.className = 'slot-info';
    if (save) {
      info.innerHTML = `<strong>Wave ${save.wave}</strong> &mdash; $${save.dollars||0}<br><small>${save.date}</small>`;
    } else {
      info.textContent = 'Empty slot';
    }

    const btns = document.createElement('div');
    btns.className = 'slot-btns';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'slot-btn save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => { saveGame(i); renderMenuSlots(); };

    const loadBtn = document.createElement('button');
    loadBtn.className = 'slot-btn load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.disabled = !save;
    loadBtn.onclick = () => loadGame(i);

    btns.append(saveBtn, loadBtn);
    slot.append(info, btns);
    container.appendChild(slot);
  });
}

function openMenu() {
  renderMenuSlots();
  document.getElementById('menu-overlay').classList.remove('hidden');
}

document.getElementById('menu-btn').onclick = openMenu;

document.getElementById('menu-close').onclick = () => {
  document.getElementById('menu-overlay').classList.add('hidden');
};

document.getElementById('menu-exit-title').onclick = () => {
  document.getElementById('menu-overlay').classList.add('hidden');
  document.getElementById('shop-overlay').classList.add('hidden');
  document.getElementById('message-overlay').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  renderTitleSaveSlots();
};
