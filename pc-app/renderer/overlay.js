const mapValue = document.getElementById("map-value");
const modeValue = document.getElementById("mode-value");
const playersValue = document.getElementById("players-value");

async function refreshNow() {
  const state = await window.api.overlayGetState();
  renderState(state);
}

function formatPlayers(current, max) {
  if (!max) return String(current ?? 0);
  return `${current ?? 0} / ${max}`;
}

function renderState(state) {
  mapValue.textContent = state.map || "Unknown";
  modeValue.textContent = state.mode || "Unknown";
  playersValue.textContent = formatPlayers(state.currentPlayers, state.maxPlayers);
}

window.api.onDataUpdated(async () => {
  await refreshNow();
});

(async () => {
  await refreshNow();
})();
