requestAnimationFrame(gameLoop);

function renderTitleSaveSlots() {
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
    info.innerHTML = `<strong>Wave ${save.wave}</strong> &mdash; $${save.dollars||0}<br><small>${save.date}</small>`;

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

document.getElementById('new-game-btn').onclick = () => {
  document.getElementById('title-screen').classList.add('hidden');
  startWave(1, initialChessPieces());
};

renderTitleSaveSlots();
