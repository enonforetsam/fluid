import { useEffect, useRef } from 'react';
import { canvasPNG, clamp, ImagePicker, useDownload, useExports, useFrame, useImage, useImageSource, useMotion } from './shared/interaction-utils.jsx';
import { drawPoster, posterHTML } from './shared/interaction-poster.js';
/** A Canvas2D poster with image-inclusive PNG and truly animated standalone HTML exports. */
export default function AnimatedPoster({ title = 'STAY CURIOUS', text = 'New shapes. New perspectives. An independent exploration of what comes next.', color = '#f4e6c6', secondary = '#b3d4cd', background = '#242334', motion = 'orbit', speed = 1, imageSrc = '', paused = false, replayKey = 0, onExportReady }) {
  const canvas = useRef(null), phase = useRef(0), [source, setSource] = useImageSource(imageSrc), { image, error } = useImage(source), active = useMotion(paused), [download, downloadError] = useDownload();
  const config = { title, text, color, secondary, background, motion, speed: clamp(speed, .1, 3), imageSrc: source };
  function draw(time = phase.current) { if (canvas.current) drawPoster(canvas.current.getContext('2d'), config, time, image); phase.current = time; }
  useFrame(draw, active && Boolean(image), replayKey);
  useEffect(() => { draw(); }, [title, text, color, secondary, background, motion, speed, image, active]);
  useEffect(() => { phase.current = 0; draw(0); }, [replayKey]);
  const png = () => canvasPNG(canvas.current, 'fluid-animated-poster.png');
  const html = () => ({ filename: 'fluid-animated-poster.html', mime: 'text/html', data: posterHTML(config) });
  useExports(onExportReady, { png, html });
  return <section className="fi-component fi-poster" style={{ '--fi-color': color }} data-motion={active}><canvas className="fi-canvas" ref={canvas} width="900" height="600" role="img" aria-label={title + '. ' + text}/><div className="fi-toolbar"><ImagePicker onChange={setSource}/><button className="fi-button" type="button" disabled={!image} onClick={() => download(png)}>Save PNG ↓</button><button className="fi-button fi-primary" type="button" disabled={!image} onClick={() => download(html)}>Animated HTML ↓</button></div><p className="fi-note">The HTML includes your image and animation. Open it in any modern browser. Images stay on your device.</p>{error || downloadError ? <p className="fi-note" role="alert">{error || downloadError}</p> : null}</section>;
}
