// Keep independent routes interactive while policy data loads or fails.
export function createPageLoader({ needsData, renderPage, renderLoading, renderError, loadData }) {
  let phase = 'loading';
  let data;
  let requestId = 0;
  function show() {
    if (!needsData() || phase === 'ready') renderPage(data);
    else if (phase === 'error') renderError();
    else renderLoading();
  }
  async function load() {
    const current = ++requestId;
    phase = 'loading';
    if (needsData()) show();
    try {
      const result = await loadData();
      if (current !== requestId) return;
      data = result;
      phase = 'ready';
    } catch {
      if (current !== requestId) return;
      phase = 'error';
    }
    // Do not remount a profile form and erase unsaved input on request completion.
    if (needsData()) show();
  }
  return { show, load };
}
