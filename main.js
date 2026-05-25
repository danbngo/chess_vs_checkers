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
  const autoSaves = getAutoSaves();
  document.getElementById('new-game-btn').textContent = autoSaves['checkers'] ? 'Continue' : 'New Game';
  document.getElementById('new-go-btn').textContent   = autoSaves['go']       ? 'Continue' : 'New Game';
}

document.getElementById('new-game-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  if (!loadAutoSave('checkers')) {
    state.campaign = 'checkers';
    startWave(1, initialChessPieces());
  }
};

document.getElementById('new-go-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  if (!loadAutoSave('go')) startGoWave(1, initialChessPieces());
};

renderTitleSaveSlots();
updateCampaignButtons();
