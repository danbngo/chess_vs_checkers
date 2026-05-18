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

function waveShopAdditions(wave) {
  const pool = ['pawn'];
  if (wave >= 1) pool.push('knight');
  if (wave >= 2) pool.push('bishop');
  if (wave >= 3) pool.push('rook');
  if (wave >= 5) pool.push('queen');
  const count = Math.min(2 + Math.floor((wave-1) / 2), 5);
  const picks = ['pawn'];
  for (let i = 1; i < count; i++) picks.push(pool[Math.floor(Math.random() * pool.length)]);
  return picks.map(type => ({ type, cost: PIECE_COSTS[type] }));
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

    const slotIdx = {};
    state.chessPieces.filter(p => !p.dying).forEach(p => {
      slotIdx[p.type] = (slotIdx[p.type] || 0) + 1;
    });

    state.shop.forEach((item, i) => {
      const idx   = slotIdx[item.type] || 0;
      const slots = CHESS_SLOTS[item.type] || [];
      const full  = idx >= slots.length;
      const pos   = full ? null : toChessNotation(slots[idx][0], slots[idx][1]);
      slotIdx[item.type] = idx + 1;

      const div = document.createElement('div');
      div.className = 'shop-item';
      const nm  = document.createElement('div'); nm.className  = 'shop-item-name';
      nm.textContent = pos ? `${pos.toUpperCase()} ${PIECE_DEFS[item.type].name}` : PIECE_DEFS[item.type].name;
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

// ─── Wave / game events ───────────────────────────────────────────────────────
function waveWon() {
  state.phase = 'wave_end';
  updateUI();
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
  catch { alert('Could not save — localStorage unavailable.'); return; }
  renderSavePanel();
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
  document.getElementById('save-panel').classList.add('hidden');
}

function renderSavePanel() {
  const saves     = getSaves();
  const container = document.getElementById('save-slots');
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

    const btns    = document.createElement('div');
    btns.className = 'slot-btns';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'slot-btn save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => saveGame(i);

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

document.getElementById('save-load-toggle').onclick = () => {
  const panel = document.getElementById('save-panel');
  renderSavePanel();
  panel.classList.toggle('hidden');
};
