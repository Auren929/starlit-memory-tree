/** Optional integration for any self-hosted chat frontend. */
export function memoryTreeUrl(treeBaseUrl, memoryId) {
  if (typeof memoryId !== 'string' || !memoryId.trim()) throw new Error('Stable memory ID required');
  const url = new URL(treeBaseUrl, window.location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Tree URL must use HTTP or HTTPS');
  url.searchParams.set('star', memoryId);
  return url.toString();
}

/** Render the memories actually recalled for one response. */
export function renderRecallLinks(container, recalled, treeBaseUrl) {
  container.replaceChildren();
  for (const item of recalled || []) {
    if (!item || typeof item.id !== 'string' || !item.id) continue;
    const link = document.createElement('a');
    link.href = memoryTreeUrl(treeBaseUrl, item.id);
    link.textContent = `✦ ${item.name || '一段记忆'}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.appendChild(link);
  }
}
