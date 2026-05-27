// ─── Responsive board sizing ──────────────────────────────────────────────────
let _resizeTimer = null;

function resizeBoard() {
  const headerH    = document.getElementById('header').offsetHeight;
  const STRIP_THICK = 48;
  const isPortrait  = window.innerWidth < window.innerHeight && window.innerWidth <= 700;

  let availW, availH;
  if (isPortrait) {
    // Strips go below canvas — no side width overhead
    availW = window.innerWidth - 6;                                      // 6 = canvas border (3px×2)
    availH = window.innerHeight - (headerH + 8 + 8 + 6 + (STRIP_THICK + 4) * 2); // two strips + borders
  } else {
    // Strips beside canvas
    availW = window.innerWidth  - (STRIP_THICK * 2 + 8 + 6);
    availH = window.innerHeight - (headerH + 8 + 8 + 6);
  }

  CELL = Math.max(28, Math.min(90, Math.floor(Math.min(availW / COLS, availH / ROWS))));

  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;

  if (isPortrait) {
    leftStrip.width   = COLS * CELL; leftStrip.height  = STRIP_THICK;
    rightStrip.width  = COLS * CELL; rightStrip.height = STRIP_THICK;
  } else {
    leftStrip.width   = STRIP_THICK; leftStrip.height  = ROWS * CELL;
    rightStrip.width  = STRIP_THICK; rightStrip.height = ROWS * CELL;
  }

  if (typeof renderStrips === 'function') renderStrips();
}

window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(resizeBoard, 80);
});

resizeBoard();
requestAnimationFrame(gameLoop);

// ─── Difficulty selection ─────────────────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
  });
});

function renderTitleSaveSlots() {
  updateCampaignButtons();
  const saves     = getSaves();
  const container = document.getElementById('title-save-slots');
  container.innerHTML = '';

  const hasSave = saves.some(s => s !== null);
  document.getElementById('title-saves').classList.toggle('hidden', !hasSave);

  saves.forEach((save, i) => {
    if (!save) return;
    const slot = document.createElement('div');
    slot.className = 'save-slot';

    const info = document.createElement('div');
    info.className = 'slot-info';
    const diff = save.difficulty ? ` · ${save.difficulty.charAt(0).toUpperCase() + save.difficulty.slice(1)}` : '';
    info.innerHTML = `<strong>Wave ${save.wave}${diff}</strong> &mdash; $${save.dollars||0}<br><small>${save.date}</small>`;

    const btns = document.createElement('div');
    btns.className = 'slot-btns';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'slot-btn load-btn';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      loadGame(i);
      document.getElementById('title-screen').classList.add('hidden');
    };

    btns.appendChild(loadBtn);
    slot.append(info, btns);
    container.appendChild(slot);
  });
}

function updateCampaignButtons() {
  const autoSaves   = getAutoSaves();
  const hasCheckers = !!autoSaves['checkers'];
  const hasGo       = !!autoSaves['go'];

  document.getElementById('new-game-btn').textContent = hasCheckers ? 'Continue' : 'New Game';
  document.getElementById('new-go-btn').textContent   = hasGo       ? 'Continue' : 'New Game';

  document.getElementById('new-game-fresh-btn').classList.toggle('hidden', !hasCheckers);
  document.getElementById('new-go-fresh-btn').classList.toggle('hidden', !hasGo);
}

document.getElementById('new-game-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  if (!loadAutoSave('checkers')) {
    state.campaign = 'checkers';
    startWave(1, initialChessPieces());
  }
};

document.getElementById('new-game-fresh-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  state.campaign = 'checkers';
  startWave(1, initialChessPieces());
};

document.getElementById('new-go-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  if (!loadAutoSave('go')) startGoWave(1, initialChessPieces());
};

document.getElementById('new-go-fresh-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  startGoWave(1, initialChessPieces());
};

renderTitleSaveSlots();
updateCampaignButtons();
