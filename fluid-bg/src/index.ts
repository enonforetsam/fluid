// fluid-bg — main entry. Re-exports the core API and registers the
// <fluid-bg> custom element automatically in the browser.
export * from "./core";
import { buildSrc } from "./core";

/**
 * `<fluid-bg hash="#p=…" fixed z="-1" base="…"></fluid-bg>`
 *
 * - `hash`  — a Fluid share hash (embed flag set automatically)
 * - `fixed` — pin behind everything as a full-viewport background
 * - `z`     — z-index when fixed (default -1)
 * - `base`  — override the Fluid origin (self-hosted)
 */
export class FluidBgElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["hash", "fixed", "z", "base"];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const z = this.getAttribute("z");
    const src = buildSrc({
      hash: this.getAttribute("hash") || undefined,
      base: this.getAttribute("base") || undefined,
    });
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" +
      ":host{display:block;position:relative;width:100%;height:100%}" +
      ":host([fixed]){position:fixed;inset:0;width:100vw;height:100vh;" +
      "pointer-events:none;overflow:hidden;z-index:" + (z == null ? "-1" : z) + "}" +
      "iframe{border:0;display:block;width:100%;height:100%;pointer-events:none}" +
      "</style>" +
      '<iframe title="Fluid background" loading="lazy" aria-hidden="true" tabindex="-1" src="' +
      src.replace(/"/g, "&quot;") + '"></iframe>';
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
