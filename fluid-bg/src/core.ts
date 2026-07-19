// fluid-bg core — framework-agnostic, side-effect-free.
//
// 0.2.0: renders NATIVELY on a canvas via fluid-core (bundled at build time,
// generated from the studio with a CI drift guard — the engines cannot drift
// from the app). No iframe, kilobytes not megabytes, zero rAF when static,
// pauses offscreen and in hidden tabs. The old iframe embed remains as an
// automatic fallback when WebGL is unavailable, or on request (mode:"iframe").
import { createFluid, parseShareHash } from "../../fluid-core/src/index.js";

/**
 * Public surface of a native mount (fluid-core's FluidMount, bundled at build
 * time). Declared locally so the published types are self-contained.
 */
export interface FluidBgMount {
  canvas: HTMLCanvasElement;
  play(): FluidBgMount;
  pause(): FluidBgMount;
  readonly playing: boolean;
  /** Studio share link for this piece. */
  shareUrl(base?: string, embed?: boolean): string;
  toDataURL(type?: string, quality?: number): string;
  destroy(): void;
}

export interface FluidBgOptions {
  /**
   * A Fluid share hash, e.g. `"#p=0.5,1.5,5.5,0.03,1,10,0,0,18,0,0,1.7778"`.
   * Copy one from the studio (Copy share link) or the gallery. Omit to use a
   * calm built-in default look.
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
  /** Override the Fluid origin (for a self-hosted instance; iframe mode only). */
  base?: string;
  /**
   * How to render. `"native"` (default) draws on a canvas in your page via the
   * bundled fluid-core engines; `"iframe"` embeds the hosted studio like 0.1.x.
   * Native automatically falls back to the iframe when WebGL is unavailable.
   */
  mode?: "native" | "iframe";
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
  if (!/^[0-9.,\-]*$/.test(h)) h = DEFAULT_HASH.replace(/^#p=/, "");   // share hashes are numeric-only — reject anything else
  const a = h.split(",");
  while (a.length <= EMBED_SLOT) a.push("0");
  a[EMBED_SLOT] = "1";
  return "#p=" + a.join(",");
}

/** Build the full embed URL for an options object (iframe mode). */
export function buildSrc(opts: FluidBgOptions = {}): string {
  let base = (opts.base || DEFAULT_BASE).replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = DEFAULT_BASE.replace(/\/+$/, "");   // only http(s) origins — reject javascript:/data: etc.
  return base + "/" + ensureEmbed(opts.hash);
}

/** True if an element paints an opaque background colour (a non-zero alpha). */
function hasOpaqueBackground(el: Element | null): boolean {
  if (!el) return false;
  const bg = getComputedStyle(el).backgroundColor;
  if (!bg || bg === "transparent") return false;
  const m = bg.match(/^rgba?\(([^)]+)\)/i);
  if (!m) return true; // a named/opaque colour (e.g. "black") — no rgba() to inspect
  const parts = m[1].split(",");
  const alpha = parts.length >= 4 ? parseFloat(parts[3]) : 1;
  return alpha > 0;
}

/**
 * A `fixed` background sits at a negative z-index, *behind* the page. If the
 * page itself paints an opaque background (on `<body>` or `<html>`), that colour
 * covers the background and you see nothing — usually a black or white screen
 * that looks like the package is broken. Warn the developer (once) with the
 * exact fix instead of leaving them to debug a blank page. No-op outside the
 * browser, and only relevant when the background is actually behind the page (z < 0).
 */
let warnedHidden = false;
export function warnIfBackgroundHidden(z: number): void {
  if (warnedHidden) return;
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return;
  if (z >= 0) return; // sitting in front of the page — nothing paints over it
  if (hasOpaqueBackground(document.body) || hasOpaqueBackground(document.documentElement)) {
    warnedHidden = true;
    console.warn(
      "[fluid-bg] A `fixed` background sits at z-index " + z + ", but the page " +
      "background (on <body>/<html>) is opaque and paints over it, so you'll see " +
      "nothing (often a black screen). Make the page background transparent — e.g. " +
      "`html, body { background: transparent }` — or raise the z-index above your " +
      "page background. See https://github.com/enonforetsam/fluid/tree/master/fluid-bg#using-fixed-keep-the-page-background-transparent"
    );
  }
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

/**
 * Mount the bundled fluid-core engines into `container` from a share hash.
 * Exported for advanced use; throws when WebGL is unavailable.
 */
export function mountNative(container: HTMLElement, hash?: string): FluidBgMount {
  const params = parseShareHash(ensureEmbed(hash)) || parseShareHash(DEFAULT_HASH)!;
  return createFluid(container, params) as unknown as FluidBgMount;
}

export interface FluidBgHandle {
  /** The element that contains the background (the created host when `fixed`, else the target). */
  el: HTMLElement;
  /** Remove the background from the DOM (and free its WebGL context). */
  destroy(): void;
  /** How this background is rendered: "native" canvas or the "iframe" fallback. */
  mode: "native" | "iframe";
  /** Pause the animation. Native mode only (undefined on the iframe fallback). */
  pause?: () => void;
  /** Resume the animation. Native mode only (undefined on the iframe fallback). */
  play?: () => void;
}

/** Fill `inner` with the chosen renderer; returns handle pieces. */
function renderInto(
  inner: HTMLElement,
  opts: FluidBgOptions
): { mode: "native" | "iframe"; cleanup: () => void; mount?: FluidBgMount } {
  if (opts.mode !== "iframe") {
    try {
      const mount = mountNative(inner, opts.hash);
      return { mode: "native", cleanup: () => mount.destroy(), mount };
    } catch (e) {
      /* WebGL unavailable (or blocked) — fall back to the hosted embed, which
         has its own 2D fallback. Never leave a blank hole. */
    }
  }
  const iframe = makeIframe(buildSrc(opts));
  inner.appendChild(iframe);
  return { mode: "iframe", cleanup: () => iframe.remove() };
}

/**
 * Imperatively mount a Fluid background.
 * @param target Element to fill (ignored layout-wise when `fixed`; defaults to `document.body`).
 */
export function fluidBackground(
  target?: Element | null,
  opts: FluidBgOptions = {}
): FluidBgHandle {
  if (opts.fixed) {
    const z = (opts.z == null || isNaN(Number(opts.z))) ? -1 : Number(opts.z);
    warnIfBackgroundHidden(z);
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:" +
      z + ";";
    (target || document.body).appendChild(host);
    const r = renderInto(host, opts);
    return {
      el: host,
      mode: r.mode,
      destroy: () => { r.cleanup(); host.remove(); },
      pause: r.mount ? () => { r.mount!.pause(); } : undefined,
      play: r.mount ? () => { r.mount!.play(); } : undefined,
    };
  }

  const host = (target as HTMLElement) || document.body;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const inner = document.createElement("div");
  inner.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none;";
  host.appendChild(inner);
  const r = renderInto(inner, opts);
  return {
    el: host,
    mode: r.mode,
    destroy: () => { r.cleanup(); inner.remove(); },
    pause: r.mount ? () => { r.mount!.pause(); } : undefined,
    play: r.mount ? () => { r.mount!.play(); } : undefined,
  };
}
