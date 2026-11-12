// Renders a structured environmental report (validated JSON from the backend) as RTL UI.
import { h, icon, arNum, formatTime } from "./ui.js";

export const TRI = { yes: "نعم", no: "لا", conditional: "بشروط", unknown: "غير مؤكد" };
export const HARM = { low: "منخفض", moderate: "متوسط", high: "مرتفع", hazardous: "خطِر", unknown: "غير محدد" };
const HARM_COLOR = { low: "#3f7a52", moderate: "#a8742a", high: "#b04a37", hazardous: "#8e2f2a", unknown: "#8f8c83" };
const CONF = { high: "ثقة عالية", medium: "ثقة متوسطة", low: "ثقة منخفضة" };
const RECYCLE = {
  yes: "قابل للتدوير",
  no: "غير قابل للتدوير عادةً",
  conditional: "قابل للتدوير بشروط",
  unknown: "غير مؤكد",
};
export const CATEGORY = {
  plastic: ["بلاستيك", "#7a9fb6"], paper: ["ورق", "#c9b38a"], cardboard: ["كرتون", "#a9825a"],
  glass: ["زجاج", "#7fb3a6"], metal: ["معدن", "#8d939b"], organic: ["مادة عضوية", "#6f9a4f"],
  e_waste: ["نفايات إلكترونية", "#4b5563"], textile: ["نسيج", "#b07d9a"], wood: ["خشب", "#8a6a45"],
  ceramic: ["سيراميك", "#c9a48c"], rubber: ["مطاط", "#3d3d3d"], hazardous: ["مواد خطرة", "#8e2f2a"],
  composite: ["مواد مركّبة", "#9c5b4a"], unknown: ["غير محدد", "#b8b4aa"],
};
const CLASS_ITEMS = [
  ["recyclable", "قابل للتدوير", false],
  ["reusable", "قابل لإعادة الاستخدام", false],
  ["biodegradable", "قابل للتحلل الحيوي", false],
  ["eco_friendly", "صديق للبيئة", false],
  ["hazardous", "خطِر", true],
];

const card = (title, ico, body, { terra = false, span = false } = {}) =>
  h("section", { class: `card${span ? " span-2" : ""}` },
    h("header", { class: "card-head" },
      h("span", { class: `c-ico${terra ? " terra" : ""}` }, icon(ico)),
      h("h3", {}, title)),
    body);

const bullets = (items, cls = "") => h("ul", { class: `list ${cls}`.trim(), role: "list" }, items.map((t) => h("li", {}, t)));
const numbered = (items) => h("ol", { class: "steps-list", role: "list" }, items.map((t) => h("li", {}, h("span", {}, t))));
const nonEmpty = (a) => Array.isArray(a) && a.length > 0;

function gauge(level, score) {
  const L = Math.PI * 60;
  const color = HARM_COLOR[level] || HARM_COLOR.unknown;
  const wrap = h("div", { class: "gauge", role: "img", "aria-label": `مستوى الضرر البيئي: ${HARM[level] || "غير محدد"}، ${score} من 100` });
  wrap.innerHTML = `
    <svg viewBox="0 0 150 88" aria-hidden="true">
      <path class="g-track" d="M15 78 A60 60 0 0 1 135 78" fill="none" stroke-width="12" stroke-linecap="round"/>
      <path class="g-val" d="M15 78 A60 60 0 0 1 135 78" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${L}" stroke-dashoffset="${L}"/>
    </svg>`;
  const val = wrap.querySelector(".g-val");
  const pct = level === "unknown" ? 0 : Math.max(0, Math.min(100, Number(score) || 0));
  requestAnimationFrame(() => requestAnimationFrame(() => val.setAttribute("stroke-dashoffset", String(L * (1 - pct / 100)))));
  wrap.append(
    h("div", {},
      h("div", { class: "g-num", style: { color } }, level === "unknown" ? "—" : arNum(pct)),
      h("div", { class: "g-cap" }, "مستوى الضرر البيئي: ", h("strong", { style: { color } }, HARM[level] || "غير محدد"))),
  );
  return wrap;
}

function classificationGrid(c) {
  return h("div", { class: "class-grid" }, CLASS_ITEMS.map(([key, label, inverted]) => {
    const v = c?.[key] || "unknown";
    let ic = { yes: "check", no: "x", conditional: "minus", unknown: "question" }[v];
    if (inverted) ic = { yes: "warn", no: "check", conditional: "minus", unknown: "question" }[v];
    return h("div", { class: `cls ${v}${inverted ? " bad" : ""}` },
      h("span", { class: "cls-ico" }, icon(ic)),
      h("span", { class: "cls-name" }, label),
      h("span", { class: "cls-val" }, TRI[v]));
  }));
}

function materialsList(materials) {
  if (!nonEmpty(materials)) return h("p", { class: "muted" }, "لم يتم تحديد المواد بدقة.");
  return h("div", { class: "materials" }, materials.map((m) => {
    const [catLabel, color] = CATEGORY[m.category] || CATEGORY.unknown;
    return h("div", { class: "material" },
      h("span", { class: "mat-dot", style: { background: color }, title: catLabel }),
      h("div", {},
        h("div", { class: "m-name" }, m.name),
        h("div", { class: "m-en" }, catLabel, m.name_en ? [" · ", h("bdi", { dir: "ltr" }, m.name_en)] : null)),
      m.share ? h("span", { class: "m-share" }, m.share) : null);
  }));
}

function unclearView(entry, { onNew }) {
  const r = entry.report;
  return h("div", { class: "report" },
    h("div", { class: "card unclear" },
      entry.thumb ? h("img", { class: "report-thumb", src: entry.thumb, alt: "" }) : null,
      h("h2", {}, "لم أتمكن من التعرّف على العنصر بثقة"),
      h("p", {}, r.unclear_reason || "الصورة غير واضحة بما يكفي لتحليل المادة."),
      nonEmpty(r.extra_tips) ? bullets(r.extra_tips) : bullets([
        "التقط الصورة في إضاءة جيدة",
        "اجعل العنصر يملأ معظم الإطار",
        "أظهر الملصق أو رمز التدوير إن وُجد",
      ]),
      h("button", { class: "btn btn-primary", type: "button", onclick: onNew }, icon("refresh"), "جرّب صورة أخرى")));
}

/**
 * @param {{report: object, thumb?: string, demo?: boolean, model?: string, createdAt?: number}} entry
 * @param {{onAsk: Function, onNew: Function}} handlers
 */
export function renderReport(entry, handlers) {
  const r = entry.report;
  if (!r.is_analyzable) return unclearView(entry, handlers);

  const chips = [
    h("span", { class: `chip conf-${r.confidence}` }, CONF[r.confidence] || ""),
    ...new Set((r.materials || []).map((m) => m.category)),
  ].map((x) => (typeof x === "string" ? h("span", { class: "chip" }, (CATEGORY[x] || CATEGORY.unknown)[0]) : x));
  if (entry.demo) chips.push(h("span", { class: "chip demo" }, "نتيجة تجريبية"));

  const hero = h("section", { class: "card report-hero" },
    entry.thumb ? h("img", { class: "report-thumb", src: entry.thumb, alt: `صورة ${r.item_name}` }) : h("div", { class: "report-thumb" }),
    h("div", { class: "report-title" },
      h("div", { class: "label" }, "اسم العنصر"),
      h("h2", {}, r.item_name),
      r.item_name_en ? h("span", { class: "en" }, r.item_name_en) : null,
      h("div", { class: "chips" }, chips),
      h("p", { class: "summary" }, r.summary)),
    gauge(r.harm_level, r.harm_score));

  const blocks = [hero];

  if (r.confidence_note && r.confidence !== "high") {
    blocks.push(h("div", { class: "alert info", role: "note" }, icon("question"),
      h("div", {}, h("h3", {}, "ملاحظة حول دقة التحليل"), h("p", {}, r.confidence_note))));
  }

  if (r.requires_special_handling || nonEmpty(r.safety_warnings)) {
    blocks.push(h("div", { class: "alert", role: "alert" }, icon("warn"),
      h("div", {},
        h("h3", {}, "تنبيه سلامة: يحتاج هذا العنصر معالجة خاصة"),
        nonEmpty(r.safety_warnings) ? h("ul", {}, r.safety_warnings.map((w) => h("li", {}, w)))
          : h("p", {}, "لا ترمِه مع النفايات المنزلية، وسلّمه لجهة مختصة أو نقطة جمع معتمدة."))));
  }

  // ---- detail cards
  const cards = [];
  cards.push(card("التصنيف البيئي", "shield", classificationGrid(r.classification), { span: true }));
  cards.push(card("نوع المادة", "flask", materialsList(r.materials)));

  const impact = h("div", {}, h("p", {}, r.environmental_impact));
  if (nonEmpty(r.pollution_risks)) impact.append(h("p", { class: "sub-h" }, "مخاطر التلوث المحتملة"), bullets(r.pollution_risks, "terra"));
  const d = r.decomposition || {};
  impact.append(h("div", { class: "decomp" }, icon("history"),
    h("div", {},
      h("strong", {}, "مدة التحلل: "),
      d.known && d.estimate ? d.estimate : "لا توجد تقديرات موثوقة محددة",
      d.note ? h("div", { class: "muted" }, d.note) : null)));
  cards.push(card("لماذا يؤثر على البيئة؟", "leaf", impact, { terra: true }));

  const rc = r.recycling || {};
  const recycleBody = h("div", {},
    h("span", { class: `recycle-status ${rc.status || "unknown"}` }, icon("recycle"), RECYCLE[rc.status] || RECYCLE.unknown),
    h("p", {}, rc.explanation || ""),
    nonEmpty(rc.preparation_steps) ? [h("p", { class: "sub-h" }, "جهّزه للتدوير"), bullets(rc.preparation_steps)] : null,
    rc.local_availability_jordan ? h("div", { class: "local-box" }, icon("pin"),
      h("div", {}, h("strong", {}, "في الأردن"), rc.local_availability_jordan)) : null);
  cards.push(card("هل يمكن إعادة تدويره؟", "recycle", recycleBody));

  if (nonEmpty(r.disposal_steps)) cards.push(card("كيف أتخلص منه بطريقة صحيحة؟", "trash", numbered(r.disposal_steps)));
  if (nonEmpty(r.reuse_ideas)) cards.push(card("أفكار لإعادة استخدامه", "refresh", bullets(r.reuse_ideas)));
  if (nonEmpty(r.alternatives)) {
    cards.push(card("بدائل صديقة للبيئة", "swap", h("div", { class: "alt-list" },
      r.alternatives.map((a) => h("div", { class: "alt" }, h("strong", {}, a.title), h("span", {}, a.why))))));
  }
  if (nonEmpty(r.reduce_tips)) cards.push(card("كيف أقلل استخدامه؟", "minus", bullets(r.reduce_tips)));
  if (nonEmpty(r.extra_tips)) cards.push(card("نصائح بيئية إضافية", "spark", bullets(r.extra_tips), { terra: true }));

  const nonSpan = cards.filter((c) => !c.classList.contains("span-2"));
  if (nonSpan.length % 2 === 1) nonSpan[nonSpan.length - 1].classList.add("span-2");
  blocks.push(h("div", { class: "report-grid" }, cards));

  blocks.push(h("div", { class: "report-actions" },
    h("p", {}, "لديك سؤال عن هذا العنصر؟"),
    h("button", { class: "btn btn-light", type: "button", onclick: handlers.onAsk }, icon("chat"), "اسأل نبتة"),
    h("button", { class: "btn btn-ghost", type: "button", onclick: handlers.onNew }, icon("refresh"), "حلّل صورة أخرى")));

  blocks.push(h("p", { class: "report-meta" },
    "تحليل مولّد بالذكاء الاصطناعي",
    entry.createdAt ? ` · ${formatTime(entry.createdAt)}` : "",
    " · للمواد الخطرة اتبع تعليمات الجهات الرسمية."));

  return h("article", { class: "report", "aria-label": `التقرير البيئي: ${r.item_name}` }, blocks);
}
