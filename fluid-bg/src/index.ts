// fluid-bg — main entry. Re-exports the core API and registers the
// <fluid-bg> custom element automatically in the browser.
export * from "./core";
import { fluidBackground, warnIfBackgroundHidden, type FluidBgHandle } from "./core";

/**
 * `<fluid-bg hash="#p=…" fixed z="-1" mode="native" base="…"></fluid-bg>`
 *
 * - `hash`  — a Fluid share hash (embed flag set automatically)
 * - `fixed` — pin behind everything as a full-viewport background
 * - `z`     — z-index when fixed (default -1)
 * - `mode`  — "native" (default: canvas in your page) or "iframe" (0.1.x embed)
 * - `base`  — override the Fluid origin (self-hosted; iframe mode)
 */
export class FluidBgElement extends HTMLElement {
  private handle: FluidBgHandle | null = null;
  private renderedKey = "";

  static get observedAttributes(): string[] {
    return ["hash", "fixed", "z", "base", "mode"];
  }

  connectedCallback(): void {
    this.render();
    if (this.hasAttribute("fixed")) {
      const z = this.getAttribute("z");
      warnIfBackgroundHidden(z == null ? -1 : Number(z));
    }
  }

  disconnectedCallback(): void {
    if (this.handle) { this.handle.destroy(); this.handle = null; }
    this.renderedKey = "";
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const zRaw = this.getAttribute("z");
    const z = (zRaw == null || isNaN(Number(zRaw))) ? -1 : Number(zRaw);   // numeric only — never let z break out of the <style> block
    const hash = this.getAttribute("hash") || undefined;
    const base = this.getAttribute("base") || undefined;
    const mode = this.getAttribute("mode") === "iframe" ? "iframe" as const : "native" as const;

    const key = [hash, base, mode, z, this.hasAttribute("fixed")].join("|");
    if (key === this.renderedKey) return;   // attribute writes that change nothing keep the GL context
    this.renderedKey = key;

    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    if (this.handle) { this.handle.destroy(); this.handle = null; }
    root.innerHTML =
      "<style>" +
      ":host{display:block;position:relative;width:100%;height:100%}" +
      ":host([fixed]){position:fixed;inset:0;width:100vw;height:100vh;" +
      "pointer-events:none;overflow:hidden;z-index:" + z + "}" +
      "</style><div style=\"position:absolute;inset:0\"></div>";
    const target = root.lastElementChild as HTMLElement;
    /* the element itself does the fixed positioning via :host([fixed]) — the
       mount always just fills the shadow container */
    this.handle = fluidBackground(target, { hash, base, mode });
  }
}

/** Register the custom element (idempotent). Call with a tag name to use a different one. */
export function defineFluidBg(tag = "fluid-bg"): void {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, FluidBgElement);
  }
}

// Auto-register in the browser; no-op during SSR / non-DOM environments.
if (typeof window !== "undefined" && typeof customElements !== "undefined") {
  defineFluidBg();
}
