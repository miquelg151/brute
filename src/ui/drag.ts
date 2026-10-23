// Drag and drop that works the same with a finger and a mouse (Pointer Events).
// A short press without moving counts as a tap, so every draggable thing can also
// just be tapped.

/** How far (px) the pointer must move before a press becomes a drag. */
const DRAG_START = 8;

export interface DragOptions {
  /** A normal tap (no drag). */
  onTap: () => void;
  /** Dropped: `zone` is the element with class "drop-zone" under the finger, or null. */
  onDrop: (zone: HTMLElement | null) => void;
}

/** Makes `el` draggable. While dragging, a copy follows the finger and drop zones light up. */
export function draggable(el: HTMLElement, options: DragOptions): void {
  // The page must not scroll when a drag starts on this element.
  el.style.touchAction = 'none';

  el.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    down.preventDefault();
    el.setPointerCapture(down.pointerId);
    let ghost: HTMLElement | null = null;
    let hovered: HTMLElement | null = null;

    const zoneAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.drop-zone') ?? null;

    const move = (e: PointerEvent) => {
      if (!ghost && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > DRAG_START) {
        ghost = el.cloneNode(true) as HTMLElement;
        // Copied canvases come out blank, so paint the pixel art into them again.
        const from = el.querySelectorAll('canvas');
        ghost.querySelectorAll('canvas').forEach((c, i) => c.getContext('2d')?.drawImage(from[i]!, 0, 0));
        ghost.classList.add('drag-ghost');
        document.body.append(ghost);
        el.classList.add('dragging');
      }
      if (!ghost) return;
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      const zone = zoneAt(e.clientX, e.clientY);
      if (zone !== hovered) {
        hovered?.classList.remove('drop-hover');
        zone?.classList.add('drop-hover');
        hovered = zone;
      }
    };

    const end = (e: PointerEvent, cancelled: boolean) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      hovered?.classList.remove('drop-hover');
      el.classList.remove('dragging');
      if (ghost) {
        ghost.remove();
        if (!cancelled) {
          options.onDrop(zoneAt(e.clientX, e.clientY));
          navigator.vibrate?.(15); // a small bump on Android; iPhones ignore it
        }
      } else if (!cancelled) {
        options.onTap();
      }
    };
    const up = (e: PointerEvent) => end(e, false);
    const cancel = (e: PointerEvent) => end(e, true);

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  });

  // Keyboard: Enter or Space acts like a tap.
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      options.onTap();
    }
  });
}
