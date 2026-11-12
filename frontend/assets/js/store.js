// Session-scoped storage for analysis history and chat.
// sessionStorage clears when the tab closes — nothing is kept on the server.

const HISTORY_KEY = "beati.history.v1";
const CHAT_KEY = "beati.chat.v1";
const MAX_ITEMS = 12;

function read(key, fallback) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded or storage blocked
  }
}

const listeners = new Set();
export const onHistoryChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(getHistory()));

export const getHistory = () => read(HISTORY_KEY, []);
export const getEntry = (id) => getHistory().find((e) => e.id === id) || null;

export function addHistory(entry) {
  let items = [entry, ...getHistory().filter((e) => e.id !== entry.id)].slice(0, MAX_ITEMS);
  // If storage is full, drop the oldest items until it fits.
  while (!write(HISTORY_KEY, items) && items.length > 1) items = items.slice(0, -1);
  emit();
}

export function clearHistory() {
  try { sessionStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  emit();
}

export const getChat = () => read(CHAT_KEY, { messages: [], contextId: null });
export const saveChat = (state) => write(CHAT_KEY, state);
