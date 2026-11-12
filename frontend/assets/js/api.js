// Thin client for the Be'ati backend. No secrets live in the browser.

const BASE = (window.BEATI_API_BASE || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, code = "unknown", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, { method = "GET", body, headers, timeout = 90000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(BASE + path, { method, body, headers, signal: ctrl.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("استغرق الطلب وقتًا طويلًا. حاول مرة أخرى.", "timeout");
    throw new ApiError("تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.", "network");
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }

  if (!res.ok) {
    const msg = data?.error || (res.status === 413 ? "حجم الصورة كبير جدًا." : "حدث خطأ غير متوقع. حاول مرة أخرى.");
    throw new ApiError(msg, data?.code || `http_${res.status}`, res.status);
  }
  if (!data) throw new ApiError("وصل رد غير صالح من الخادم.", "bad_json", res.status);
  return data;
}

export const api = {
  health: () => request("/api/health", { timeout: 10000 }),

  analyze(blob, note = "") {
    const fd = new FormData();
    fd.append("image", blob, "photo.jpg");
    if (note) fd.append("note", note.slice(0, 200));
    return request("/api/analyze", { method: "POST", body: fd, timeout: 120000 });
  },

  chat(messages, context = null) {
    return request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context }),
      timeout: 90000,
    });
  },
};
