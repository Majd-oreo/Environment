// «نبتة» — the Be'ati environmental AI mascot.
// Pure SVG + CSS animations. States: idle | excited | thinking | happy | confused | wave

const STATES = ["idle", "excited", "thinking", "happy", "confused", "wave"];
const registry = new Map();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mascotSVG({ mini = false } = {}) {
  const extras = mini ? "" : `
    <g class="m-sparkles" aria-hidden="true">
      <path d="M34 78l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#9c5b4a"/>
      <path d="M168 58l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="#c3d39a"/>
      <circle cx="172" cy="118" r="3.5" fill="#9c5b4a"/>
    </g>
    <g class="m-orbit" aria-hidden="true">
      <circle cx="100" cy="137" r="84" fill="none" stroke="#9c5b4a" stroke-opacity=".22" stroke-dasharray="2 7" stroke-width="1.5"/>
      <circle cx="100" cy="53" r="5" fill="#9c5b4a"/>
      <circle cx="184" cy="137" r="4" fill="#c3d39a"/>
      <circle cx="41" cy="196" r="3.5" fill="#24402f"/>
    </g>`;

  const shadow = mini ? "" : `<g class="m-shadow"><ellipse cx="100" cy="222" rx="46" ry="6.5" fill="#24402f" opacity=".22"/></g>`;

  return `
<svg class="mascot is-idle" viewBox="${mini ? "18 4 164 210" : "0 0 200 232"}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="نبتة، المساعد البيئي">
  ${shadow}
  <g class="m-float">
    ${extras}
    <g class="m-arm-l"><ellipse cx="24" cy="152" rx="9" ry="16" transform="rotate(28 24 152)" fill="#c3d39a"/></g>
    <g class="m-arm-r"><ellipse cx="176" cy="152" rx="9" ry="16" transform="rotate(-28 176 152)" fill="#c3d39a"/></g>

    <g class="m-sprout">
      <path d="M100 72 C100 60 101.5 50 100 40" stroke="#24402f" stroke-width="3.6" stroke-linecap="round" fill="none"/>
      <g class="m-leaf-l"><path d="M100 50 C87 50 75 42 72 27 C87 26 98.5 35 100 50 Z" fill="#9c5b4a"/>
        <path d="M100 50 C92 45 84 38 79 31" stroke="#7f4537" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/></g>
      <g class="m-leaf-r"><path d="M100 42 C111 40 123 30 126 15 C111 15 101 26 100 42 Z" fill="#355a43"/>
        <path d="M100 42 C107 35 114 27 120 20" stroke="#24402f" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/></g>
    </g>

    <g class="m-body">
      <path d="M100 68 C147 68 173 103 173 143 C173 186 142 208 100 208 C58 208 27 186 27 143 C27 103 53 68 100 68 Z" fill="#d5e1b5"/>
      <path d="M100 68 C147 68 173 103 173 143 C173 186 142 208 100 208" fill="none" stroke="#b9c98c" stroke-width="2" opacity=".6"/>
      <ellipse cx="70" cy="96" rx="17" ry="8" transform="rotate(-28 70 96)" fill="#fff" opacity=".45"/>
      <path d="M100 196 c-6 -2 -9 -7 -8 -13 c6 0 10 4 8 13 z M100 196 c6 -2 9 -7 8 -13 c-6 0 -10 4 -8 13 z" fill="#9c5b4a" opacity=".55"/>

      <rect x="50" y="108" width="100" height="64" rx="32" fill="#24402f"/>
      <rect class="m-screen-glow" x="52" y="110" width="96" height="60" rx="30" fill="none" stroke="#d5e1b5" stroke-width="2.5"/>
      <rect class="m-scan" x="62" y="139" width="76" height="2.5" rx="1.25" fill="#d5e1b5" opacity=".75"/>

      <ellipse class="m-cheek" cx="66" cy="157" rx="7.5" ry="4" fill="#c27a66"/>
      <ellipse class="m-cheek" cx="134" cy="157" rx="7.5" ry="4" fill="#c27a66"/>

      <g class="m-eyes">
        <g class="m-eye"><ellipse cx="82" cy="138" rx="7" ry="9.5" fill="#ecf2dc"/><circle cx="84.5" cy="134.5" r="2.2" fill="#fff"/></g>
        <g class="m-eye"><ellipse cx="118" cy="138" rx="7" ry="9.5" fill="#ecf2dc"/><circle cx="120.5" cy="134.5" r="2.2" fill="#fff"/></g>
      </g>

      <g class="m-mouth" fill="none" stroke="#d5e1b5" stroke-width="3" stroke-linecap="round">
        <path class="m-mouth-idle" d="M93 155 Q100 160.5 107 155"/>
        <path class="m-mouth-happy" d="M89 152 Q100 166 111 152" />
        <path class="m-mouth-flat" d="M94 157 L106 157"/>
        <ellipse class="m-mouth-o" cx="100" cy="157" rx="3.6" ry="4.4" fill="#d5e1b5" stroke="none"/>
      </g>
    </g>
  </g>
</svg>`;
}

/** Render mascots into every [data-mascot] host. */
export function mountMascots(root = document) {
  root.querySelectorAll("[data-mascot]").forEach((host) => {
    if (host.dataset.mounted) return;
    host.innerHTML = mascotSVG({ mini: host.classList.contains("mascot-xs") });
    host.dataset.mounted = "1";
    const svg = host.querySelector("svg");
    registry.set(host.dataset.mascot, svg);
    if (host.dataset.mascot === "thinking") setState(svg, "thinking");
  });
  if (!reduceMotion) enableEyeTracking();
}

function setState(svg, state) {
  if (!svg) return;
  STATES.forEach((s) => svg.classList.remove(`is-${s}`));
  // restart CSS animations
  void svg.getBoundingClientRect();
  svg.classList.add(`is-${state}`);
}

/**
 * Change a mascot's state. If `revertAfter` (ms) is given, returns to idle afterwards.
 */
export function mascot(name, state, revertAfter = 0) {
  const svg = registry.get(name);
  if (!svg) return;
  clearTimeout(svg._revert);
  setState(svg, state);
  if (revertAfter) svg._revert = setTimeout(() => setState(svg, "idle"), revertAfter);
}

let tracking = false;
function enableEyeTracking() {
  if (tracking) return;
  tracking = true;
  let raf = 0;
  window.addEventListener("pointermove", (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      registry.forEach((svg) => {
        if (!svg.classList.contains("is-idle") && !svg.classList.contains("is-wave")) return;
        const r = svg.getBoundingClientRect();
        if (!r.width) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.6;
        const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 400));
        const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 400));
        const eyes = svg.querySelector(".m-eyes");
        if (eyes) eyes.style.transform = `translate(${(dx * 4).toFixed(2)}px, ${(dy * 3).toFixed(2)}px)`;
      });
    });
  }, { passive: true });
}
