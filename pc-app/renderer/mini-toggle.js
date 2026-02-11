const button = document.getElementById("toggle");

if (button) {
  button.addEventListener("click", () => {
    const bridge = window.hmccOverlay;
    if (bridge && typeof bridge.showOverlayWindow === "function") {
      bridge.showOverlayWindow();
    }
  });
}
