// Registers Northbound's app-shell worker without coupling PWA support to the UI.

export async function registerServiceWorker() {
  const serviceWorkerContainer = globalThis.navigator?.serviceWorker;
  if (!serviceWorkerContainer) return null;

  const pageWasAlreadyControlled = Boolean(serviceWorkerContainer.controller);
  let updateReloadStarted = false;

  serviceWorkerContainer.addEventListener("controllerchange", () => {
    // A newly installed worker takes over immediately; one reload moves an open app
    // onto the matching shell version. First-time installation should not interrupt use.
    if (!pageWasAlreadyControlled || updateReloadStarted) return;
    updateReloadStarted = true;
    globalThis.location.reload();
  });

  try {
    return await serviceWorkerContainer.register("./service-worker.js", {
      scope: "./",
      type: "module",
      updateViaCache: "none",
    });
  } catch (error) {
    // PWA installation is progressive enhancement; storage and the online app still work.
    console.warn("Northbound could not register offline support.", error);
    return null;
  }
}
