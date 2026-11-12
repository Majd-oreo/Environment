// Follow-up assistant chat (context-aware of the latest / selected analysis).
import { api } from "./api.js";
import { $, h, miniMarkdown, toast } from "./ui.js";
import { mascotSVG } from "./mascot.js";
import { getChat, saveChat, getEntry } from "./store.js";

const GENERAL_SUGGESTIONS = [
  "كيف أبدأ بفرز النفايات في المنزل؟",
  "ما الفرق بين البلاستيك القابل للتدوير وغير القابل؟",
  "كيف أتخلص من البطاريات القديمة بأمان؟",
  "ما البدائل الصديقة للبيئة للأكياس البلاستيكية؟",
];

const contextSuggestions = (name) => [
  `أين يمكنني تسليم ${name} في الأردن؟`,
  `ما أفضل طريقة لإعادة استخدام ${name}؟`,
  "ما البدائل الأفضل للبيئة؟",
  "هل هناك خطر صحي عند التعامل معه؟",
];

let state = getChat(); // { messages: [{role, content}], contextId }
let busy = false;
let els = {};

const avatar = () => h("div", { class: "msg-avatar", html: mascotSVG({ mini: true }) });

function bubble(msg) {
  const b = h("div", { class: "bubble" });
  if (msg.role === "assistant") b.innerHTML = miniMarkdown(msg.content); // escaped inside miniMarkdown
  else b.textContent = msg.content;
  return h("div", { class: `msg ${msg.role}` }, msg.role === "assistant" ? avatar() : null, b);
}

function welcome() {
  const entry = state.contextId ? getEntry(state.contextId) : null;
  const text = entry
    ? `حلّلتُ **${entry.report.item_name}** للتو. اسألني أي شيء عنه: كيف تعيد استخدامه، أين تسلّمه، أو ما البدائل الأفضل.`
    : "أهلًا! أنا **نبتة**، مساعدك البيئي. اسألني عن تدوير أي مادة، أو البدائل الصديقة للبيئة، أو كيف تقلل نفاياتك اليومية.";
  return bubble({ role: "assistant", content: text });
}

function renderContext() {
  const entry = state.contextId ? getEntry(state.contextId) : null;
  els.context.replaceChildren();
  if (entry) {
    els.context.hidden = false;
    els.context.append(
      entry.thumb ? h("img", { src: entry.thumb, alt: "" }) : null,
      h("span", {}, "نتحدث عن: ", h("strong", {}, entry.report.item_name)),
      h("button", { type: "button", onclick: () => setContext(null) }, "إزالة السياق"),
    );
    els.label.textContent = "المحادثة مرتبطة بآخر تحليل لك.";
  } else {
    els.context.hidden = true;
    els.label.textContent = "اسأل عن التدوير، البدائل، أو أثر أي مادة.";
  }
  const sug = entry ? contextSuggestions(entry.report.item_name) : GENERAL_SUGGESTIONS;
  els.suggest.replaceChildren(...sug.map((s) => h("button", { class: "suggest", type: "button", onclick: () => send(s) }, s)));
  els.suggest.hidden = state.messages.length > 2;
}

function renderLog() {
  els.log.replaceChildren(welcome(), ...state.messages.map(bubble));
  els.log.scrollTop = els.log.scrollHeight;
}

export function setContext(entryId, { resetConversation = false } = {}) {
  if (resetConversation || entryId !== state.contextId) state.messages = [];
  state.contextId = entryId;
  saveChat(state);
  if (els.log) { renderContext(); renderLog(); }
}

async function send(text) {
  const content = (text ?? els.input.value).trim();
  if (!content || busy) return;
  busy = true;
  els.send.disabled = true;
  els.input.value = "";
  autoGrow();

  state.messages.push({ role: "user", content });
  els.log.append(bubble({ role: "user", content }));
  els.suggest.hidden = true;
  const typing = h("div", { class: "msg assistant" }, avatar(),
    h("div", { class: "bubble", "aria-label": "نبتة يكتب" }, h("span", { class: "typing" }, h("span"), h("span"), h("span"))));
  els.log.append(typing);
  els.log.scrollTop = els.log.scrollHeight;

  try {
    const entry = state.contextId ? getEntry(state.contextId) : null;
    const { reply } = await api.chat(state.messages.slice(-16), entry?.report || null);
    state.messages.push({ role: "assistant", content: reply });
    typing.replaceWith(bubble({ role: "assistant", content: reply }));
  } catch (err) {
    state.messages.pop(); // let the user retry the same question
    typing.remove();
    els.input.value = content;
    toast(err.message || "تعذّر إرسال الرسالة.", "error");
  } finally {
    saveChat(state);
    busy = false;
    els.send.disabled = false;
    els.log.scrollTop = els.log.scrollHeight;
    els.input.focus();
  }
}

function autoGrow() {
  els.input.style.height = "auto";
  const full = els.input.scrollHeight;
  els.input.style.height = Math.min(full, 160) + "px";
  els.input.style.overflowY = full > 160 ? "auto" : "hidden";
}

export function initChat() {
  els = {
    log: $("#chat-log"), form: $("#chat-form"), input: $("#chat-input"), send: $("#chat-send"),
    suggest: $("#chat-suggest"), context: $("#chat-context"), label: $("#chat-context-label"),
  };
  els.form.addEventListener("submit", (e) => { e.preventDefault(); send(); });
  els.input.addEventListener("input", autoGrow);
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $("#chat-clear").addEventListener("click", () => setContext(state.contextId, { resetConversation: true }));
  renderContext();
  renderLog();
}

export function focusChat() {
  renderContext();
  els.log.scrollTop = els.log.scrollHeight;
  if (window.matchMedia("(pointer: fine)").matches) els.input.focus();
}
