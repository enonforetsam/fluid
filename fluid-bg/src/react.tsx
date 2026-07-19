// fluid-bg/react — a thin React wrapper. React is an optional peer dependency.
import * as React from "react";
import { fluidBackground, warnIfBackgroundHidden, type FluidBgOptions, type FluidBgHandle } from "./core";

export interface FluidBgProps extends FluidBgOptions {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * `<FluidBg hash="#p=…" fixed />` — a live Fluid background, rendered natively
 * on a canvas (no iframe). Omit `fixed` to fill the parent element instead of
 * the viewport. SSR-safe: the canvas mounts in an effect, so the server renders
 * an empty positioned div.
 */
export function FluidBg({ hash, fixed, z, base, mode, className, style }: FluidBgProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (fixed) warnIfBackgroundHidden(z ?? -1);
  }, [fixed, z]);
  React.useEffect(() => {
    if (!ref.current) return;
    /* the wrapper div handles fixed/relative layout — the mount just fills it */
    const handle: FluidBgHandle = fluidBackground(ref.current, { hash, base, mode });
    return () => handle.destroy();
  }, [hash, base, mode]);
  const layout: React.CSSProperties = fixed
    ? {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: z ?? -1,
      }
    : { position: "relative", width: "100%", height: "100%" };

  return <div ref={ref} className={className} style={{ ...layout, ...style }} aria-hidden="true" />;
}

export default FluidBg;
export type { FluidBgOptions } from "./core";
