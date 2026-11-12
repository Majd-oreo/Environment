// بيئتي — application bootstrap: routing, analysis flow, camera, history.
import { api } from "./api.js";
import { $, $$, h, toast, formatTime } from "./ui.js";
import { mountMascots, mascot } from "./mascot.js";
import { prepareImage, ImageError } from "./image.js";
import { renderReport, HARM } from "./report.js";
import { addHistory, getHistory, getEntry, clearHistory, onHistoryChange } from "./store.js";
import { initChat, setContext, focusChat } from "./chat.js";

const config = { maxUploadMb: 8, demo: false };

/* ============================================================== ROUTER */
const VIEWS = ["home", "analyze", "assistant", "history"];

function route() {
  const raw = location.hash.replace(/^#/, "");
  let [view, param] = raw.split("/");
  if (!VIEWS.includes(view) && view !== "report") view = "home";

  const target = view === "report" ? "analyze" : view;
  $$(".view").forEach((v) => { v.hidden = v.dataset.view !== target; });
  $$("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === target;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  closeNav();
  window.scrollTo(0, 0);

  if (view === "report" && param) showSavedReport(param);
  if (target === "assistant") focusChat();
  if (target === "home") mascot("hero", "wave", 1600);

  const titles = { home: "بيئتي — افهم أثرك البيئي", analyze: "تحليل صورة · بيئتي", assistant: "المساعد البيئي · بيئتي", history: "السجل · بيئتي" };
  document.title = titles[target];
}

/* ============================================================== HEADER */
const navToggle = $("#nav-toggle");
const nav = $("#main-nav");
function closeNav() { nav.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); }
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
window.addEventListener("scroll", () => $("#site-header").classList.toggle("scrolled", window.scrollY > 8), { passive: true });
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-scroll]");
  if (!a) return;
  e.preventDefault();
  document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
});

/* ============================================================ ANALYZE */
const el = {
  dropzone: $("#dropzone"), empty: $("#dz-empty"), preview: $("#dz-preview"), img: $("#preview-img"),
  remove: $("#preview-remove"), fileInput: $("#file-input"), cameraInput: $("#camera-input"),
  pick: $("#pick-btn"), camera: $("#camera-btn"), note: $("#note-input"), analyze: $("#analyze-btn"),
  say: $("#assistant-say"), placeholder: $("#result-placeholder"), analyzing: $("#analyzing"),
  progress: $("#progress-steps"), error: $("#error-state"), errorMsg: $("#error-message"),
  retry: $("#retry-btn"), reportRoot: $("#report-root"),
};

let current = null; // { blob, previewUrl, thumb }
let analyzing = false;
let progressTimer = null;

const SAY = {
  empty: "أرني ما لديك، وسأخبرك كيف تتعامل معه بطريقة صديقة للبيئة.",
  ready: "صورة رائعة! اضغط «حلّل الصورة» وسأبدأ فورًا.",
  analyzing: "أفحص المواد وأقيّم الأثر البيئي… لحظات من فضلك.",
  done: "جاهز! هذا تقريرك البيئي. يمكنك سؤالي عن أي تفصيل.",
  unclear: "لم أتمكن من رؤية العنصر بوضوح. جرّب صورة أقرب وإضاءة أفضل.",
  error: "حدثت مشكلة صغيرة. لنحاول مرة أخرى.",
};
const say = (k) => { el.say.textContent = SAY[k]; };

function showPanel(name) {
  el.placeholder.hidden = name !== "placeholder";
  el.analyzing.hidden = name !== "analyzing";
  el.error.hidden = name !== "error";
  el.reportRoot.hidden = name !== "report";
}

async function handleFile(file) {
  if (!file || analyzing) return;
  try {
    const prepared = await prepareImage(file, { maxBytes: config.maxUploadMb * 1024 * 1024 });
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    current = prepared;
    el.img.src = prepared.previewUrl;
    el.preview.hidden = false;
    el.empty.hidden = true;
    el.dropzone.classList.add("has-image");
    el.analyze.disabled = false;
    showPanel("placeholder");
    say("ready");
    mascot("analyze", "excited", 1200);
  } catch (err) {
    toast(err instanceof ImageError ? err.message : "تعذّر قراءة الصورة.", "error");
    mascot("analyze", "confused", 2200);
  }
}

function resetUpload() {
  if (analyzing) return;
  if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
  current = null;
  el.img.removeAttribute("src");
  el.preview.hidden = true;
  el.empty.hidden = false;
  el.dropzone.classList.remove("has-image", "scanning");
  el.analyze.disabled = true;
  el.note.value = "";
  el.fileInput.value = "";
  el.cameraInput.value = "";
  showPanel("placeholder");
  el.reportRoot.replaceChildren();
  say("empty");
  mascot("analyze", "idle");
}

function startProgress() {
  const items = $$("li", el.progress);
  items.forEach((li) => li.classList.remove("active", "done"));
  let i = 0;
  items[0].classList.add("active");
  progressTimer = setInterval(() => {
    if (i >= items.length - 1) return;
    items[i].classList.replace("active", "done");
    i += 1;
    items[i].classList.add("active");
  }, 2600);
}
function stopProgress() {
  clearInterval(progressTimer);
  $$("li", el.progress).forEach((li) => { li.classList.remove("active"); li.classList.add("done"); });
}

async function runAnalysis() {
  if (!current || analyzing) return;
  analyzing = true;
  el.analyze.disabled = true;
  el.remove.disabled = true;
  el.dropzone.classList.add("scanning");
  showPanel("analyzing");
  say("analyzing");
  mascot("analyze", "thinking");
  startProgress();
  if (window.innerWidth < 1025) el.analyzing.scrollIntoView({ behavior: "smooth", block: "center" });

  try {
    const res = await api.analyze(current.blob, el.note.value.trim());
    stopProgress();
    const entry = {
      id: res.id,
      createdAt: Date.now(),
      thumb: current.thumb,
      report: res.report,
      demo: !!res.demo,
      model: res.model,
    };
    addHistory(entry);
    setContext(entry.id);
    showReport(entry);
    const ok = res.report.is_analyzable;
    say(ok ? "done" : "unclear");
    mascot("analyze", ok ? "happy" : "confused", ok ? 3200 : 3000);
  } catch (err) {
    stopProgress();
    el.errorMsg.textContent = err.message || "حدث خطأ غير متوقع.";
    showPanel("error");
    say("error");
    mascot("analyze", "confused", 3000);
  } finally {
    analyzing = false;
    el.analyze.disabled = !current;
    el.remove.disabled = false;
    el.dropzone.classList.remove("scanning");
  }
}

function showReport(entry) {
  const node = renderReport(entry, {
    onAsk: () => { setContext(entry.id); location.hash = "#assistant"; },
    onNew: () => { resetUpload(); window.scrollTo({ top: 0, behavior: "smooth" }); el.dropzone.focus(); },
  });
  el.reportRoot.replaceChildren(node);
  showPanel("report");
  if (window.innerWidth < 1025) requestAnimationFrame(() => el.reportRoot.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function showSavedReport(id) {
  const entry = getEntry(id);
  if (!entry) { toast("لم يعد هذا التحليل متاحًا في الجلسة الحالية."); location.hash = "#history"; return; }
  resetUpload();
  showReport(entry);
  setContext(entry.id);
  say("done");
}

// Upload interactions
el.dropzone.addEventListener("click", (e) => {
  if (e.target.closest("#preview-remove") || current) return;
  el.fileInput.click();
});
el.dropzone.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && !current) { e.preventDefault(); el.fileInput.click(); }
});
["dragenter", "dragover"].forEach((t) => el.dropzone.addEventListener(t, (e) => {
  e.preventDefault();
  if (!analyzing) el.dropzone.classList.add("drag");
}));
["dragleave", "dragend", "drop"].forEach((t) => el.dropzone.addEventListener(t, () => el.dropzone.classList.remove("drag")));
el.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/")) || e.dataTransfer?.files?.[0];
  handleFile(file);
});
window.addEventListener("paste", (e) => {
  if ($('[data-view="analyze"]').hidden) return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) { e.preventDefault(); handleFile(file); }
});
el.fileInput.addEventListener("change", () => handleFile(el.fileInput.files[0]));
el.cameraInput.addEventListener("change", () => handleFile(el.cameraInput.files[0]));
el.pick.addEventListener("click", () => el.fileInput.click());
el.remove.addEventListener("click", (e) => { e.stopPropagation(); resetUpload(); });
el.analyze.addEventListener("click", runAnalysis);
el.retry.addEventListener("click", () => (current ? runAnalysis() : resetUpload()));

/* ============================================================= CAMERA */
const cam = { modal: $("#camera-modal"), video: $("#cam-video"), stream: null, facing: "environment" };
const isTouch = window.matchMedia("(pointer: coarse)").matches;

async function openCamera() {
  // On phones the native camera via <input capture> is the best experience.
  if (isTouch || !navigator.mediaDevices?.getUserMedia || !cam.modal.showModal) {
    el.cameraInput.click();
    return;
  }
  try {
    await startStream();
    cam.modal.showModal();
  } catch {
    toast("تعذّر الوصول إلى الكاميرا. يمكنك اختيار صورة من جهازك بدلًا من ذلك.", "error");
  }
}
async function startStream() {
  stopStream();
  cam.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: cam.facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false,
  });
  cam.video.srcObject = cam.stream;
  await cam.video.play();
}
function stopStream() {
  cam.stream?.getTracks().forEach((t) => t.stop());
  cam.stream = null;
}
function closeCamera() { stopStream(); if (cam.modal.open) cam.modal.close(); }

el.camera.addEventListener("click", openCamera);
$("#cam-close").addEventListener("click", closeCamera);
cam.modal.addEventListener("close", stopStream);
$("#cam-switch").addEventListener("click", async () => {
  cam.facing = cam.facing === "environment" ? "user" : "environment";
  try { await startStream(); } catch { toast("لا توجد كاميرا أخرى متاحة."); }
});
$("#cam-shoot").addEventListener("click", () => {
  const v = cam.video;
  if (!v.videoWidth) return;
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  c.toBlob((blob) => {
    closeCamera();
    if (blob) handleFile(new File([blob], "camera.jpg", { type: "image/jpeg" }));
  }, "image/jpeg", 0.92);
});

/* ============================================================ HISTORY */
function renderHistory(items = getHistory()) {
  const grid = $("#history-grid");
  const count = $("#history-count");
  count.hidden = items.length === 0;
  count.textContent = String(items.length);
  $("#history-empty").hidden = items.length > 0;
  $("#history-clear").hidden = items.length === 0;
  grid.replaceChildren(...items.map((e) => {
    const r = e.report;
    const level = r.is_analyzable ? r.harm_level : "unknown";
    return h("button", { class: "h-card", type: "button", onclick: () => { location.hash = `#report/${e.id}`; } },
      e.thumb ? h("img", { src: e.thumb, alt: "", loading: "lazy" }) : null,
      h("div", { class: "h-body" },
        h("h3", {}, r.is_analyzable ? r.item_name : "صورة غير واضحة"),
        h("div", { class: "h-meta" },
          h("span", { class: `harm-pill ${level}` }, `أثر ${HARM[level]}`),
          h("span", {}, formatTime(e.createdAt)))));
  }));
}
$("#history-clear").addEventListener("click", () => {
  if (confirm("هل تريد مسح سجل التحليلات لهذه الجلسة؟")) { clearHistory(); setContext(null, { resetConversation: true }); }
});
onHistoryChange(renderHistory);

/* =============================================================== BOOT */
async function boot() {
  $("#year").textContent = new Intl.NumberFormat("ar-JO", { useGrouping: false }).format(new Date().getFullYear());
  mountMascots();
  initChat();
  renderHistory();
  window.addEventListener("hashchange", route);
  route();

  try {
    const info = await api.health();
    config.maxUploadMb = info.max_upload_mb || config.maxUploadMb;
    config.demo = !!info.demo;
    $("#max-mb").textContent = new Intl.NumberFormat("ar-JO").format(config.maxUploadMb);
    $("#demo-banner").hidden = !info.demo;
    if (!info.ai_configured && !info.demo) {
      toast("خدمة التحليل غير مهيّأة على الخادم بعد.", "error", 6000);
    }
  } catch {
    /* offline or backend unavailable; errors surface when the user acts */
  }
}

boot();
