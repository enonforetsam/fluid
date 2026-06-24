// fluid-bg core — framework-agnostic, side-effect-free.
// Builds the embed URL and mounts an iframe pointing at the hosted Fluid studio.
// There is NO shader here: the iframe always renders the studio's latest engines,
// so this package never drifts from the app.

export interface FluidBgOptions {
  /**
   * A Fluid share hash, e.g. `"#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778"`.
   * Copy one from the studio (Copy share link) or the gallery. The embed flag
   * is set for you. Omit to use a calm built-in default look.
   */
  hash?: string;
  /**
   * Pin as a fixed, full-viewport background behind everything
   * (position:fixed, z-index -1, pointer-events:none). Default `false`,
   * which fills the target/parent element instead.
   */
  fixed?: boolean;
  /** z-index to use when `fixed`. Default `-1`. */
  z?: number;
  /** Override the Fluid origin (for a self-hosted instance). */
  base?: string;
}

/** Default Fluid origin. */
export const DEFAULT_BASE = "https://fluid.krackeddevs.com";
/** Aurora Flow, embed flag set — a calm default background. */
export const DEFAULT_HASH = "#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778,0,1,1";
/** Share-hash slot 13 is the embed (canvas-only) flag — Fluid's format is append-only. */
const EMBED_SLOT = 13;

/**
 * Ensure a `#p=` hash carries the embed (canvas-only) flag, without touching any
 * other parameter. Accepts a hash with or without the leading `#`/`p=`.
 */
export function ensureEmbed(hash?: string): string {
  let h = hash || DEFAULT_HASH;
  if (h.charAt(0) === "#") h = h.slice(1);
  if (h.indexOf("p=") === 0) h = h.slice(2);
  const a = h.split(",");
  while (a.length <= EMBED_SLOT) a.push("0");
  a[EMBED_SLOT] = "1";
  return "#p=" + a.join(",");
}

/** Build the full embed URL for an options object. */
export function buildSrc(opts: FluidBgOptions = {}): string {
  const base = (opts.base || DEFAULT_BASE).replace(/\/+$/, "");
  return base + "/" + ensureEmbed(opts.hash);
}

function makeIframe(src: string): HTMLIFrameElement {
  const f = document.createElement("iframe");
  f.src = src;
  f.title = "Fluid background";
  f.loading = "lazy";
  f.setAttribute("aria-hidden", "true");
  f.setAttribute("tabindex", "-1");
  f.style.cssText =
    "border:0;display:block;width:100%;height:100%;pointer-events:none;";
  return f;
}

export interface FluidBgHandle {
  /** The element that contains the iframe (the created host when `fixed`, else the target). */
  el: HTMLElement;
  /** Remove the background from the DOM. */
  destroy(): void;
}

/**
 * Imperatively mount a Fluid background.
 * @param target Element to fill (ignored layout-wise when `fixed`; defaults to `document.body`).
 */
export function fluidBackground(
  target?: Element | null,
  opts: FluidBgOptions = {}
): FluidBgHandle {
  const iframe = makeIframe(buildSrc(opts));

  if (opts.fixed) {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:" +
      (opts.z == null ? -1 : opts.z) + ";";
    host.appendChild(iframe);
    (target || document.body).appendChild(host);
    return { el: host, destroy: () => host.remove() };
  }

  const host = (target as HTMLElement) || document.body;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  iframe.style.cssText =
    "border:0;display:block;position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
  host.appendChild(iframe);
  return { el: host, destroy: () => iframe.remove() };
}
