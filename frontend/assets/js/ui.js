// Small DOM helpers. All dynamic text goes through textContent or escapeHTML.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Hyperscript-style element builder. Strings become text nodes (safe). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // only used with trusted/static markup
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Inline SVG icon from the sprite in index.html (trusted, static ids). */
export function icon(name, cls = "") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", `ico ${cls}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

export function toast(message, type = "info", ms = 4200) {
  const region = $("#toast-region");
  const t = h("div", { class: `toast ${type}`, role: type === "error" ? "alert" : "status" }, message);
  region.append(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 320);
  }, ms);
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

export function formatTime(ts) {
  try {
    return new Intl.DateTimeFormat("ar-JO", { hour: "numeric", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

/**
 * Minimal, safe Markdown → HTML for chat replies:
 * escapes everything first, then supports **bold**, `code`, bullet/numbered lists and paragraphs.
 */
export function miniMarkdown(text) {
  const lines = escapeHTML(text).replace(/\r/g, "").split("\n");
  const out = [];
  let list = null;
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^[-*•]\s+(.*)/))) {
      if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^(?:\d+|[٠-٩]+)[.)]\s+(.*)/))) {
      if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (!line) {
      close();
    } else {
      close();
      out.push(`<p>${inline(line.replace(/^#{1,6}\s*/, ""))}</p>`);
    }
  }
  close();
  return out.join("");
}
