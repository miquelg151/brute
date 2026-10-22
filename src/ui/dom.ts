type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

/** Tiny element builder: h('button', { class: 'btn', onclick }, 'Fight'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (key in el) (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

/** Wraps a pixel sprite canvas so CSS can scale it up crisply. */
export function pixelArt(canvas: HTMLCanvasElement, scale: number, flip = false): HTMLCanvasElement {
  canvas.classList.add('pixel');
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  if (flip) canvas.style.transform = 'scaleX(-1)';
  return canvas;
}
