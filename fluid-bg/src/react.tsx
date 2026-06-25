// fluid-bg/react — a thin React wrapper. React is an optional peer dependency.
import * as React from "react";
import { buildSrc, warnIfBackgroundHidden, type FluidBgOptions } from "./core";

export interface FluidBgProps extends FluidBgOptions {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * `<FluidBg hash="#p=…" fixed />` — a live Fluid background.
 * Omit `fixed` to fill the parent element instead of the viewport.
 */
export function FluidBg({ hash, fixed, z, base, className, style }: FluidBgProps): React.ReactElement {
  const src = buildSrc({ hash, base });
  React.useEffect(() => {
    if (fixed) warnIfBackgroundHidden(z ?? -1);
  }, [fixed, z]);
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

  return (
    <div className={className} style={{ ...layout, ...style }} aria-hidden="true">
      <iframe
        src={src}
        title="Fluid background"
        loading="lazy"
        tabIndex={-1}
        style={{
          border: 0,
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default FluidBg;
export type { FluidBgOptions } from "./core";
