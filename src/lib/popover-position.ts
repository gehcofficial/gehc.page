export type RectBox = { top: number; right: number; bottom: number; left: number; width: number; height: number };
export type ViewportBox = { width: number; height: number };
export type PopoverBox = { top: number; left: number; width: number; maxHeight: number };

export function popoverPosition(
  rect: RectBox,
  viewport: ViewportBox,
  opts?: { panelWidth?: number; minHeight?: number; margin?: number },
): PopoverBox {
  const panelWidth = opts?.panelWidth ?? 448;
  const margin = opts?.margin ?? 8;
  const minHeight = opts?.minHeight ?? 240;
  const width = Math.min(panelWidth, Math.max(200, viewport.width - margin * 2));
  const spaceBelow = viewport.height - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const placeBelow = spaceBelow >= minHeight || spaceBelow >= spaceAbove;

  let maxHeight: number;
  let top: number;
  if (placeBelow) {
    top = rect.bottom + margin;
    maxHeight = Math.max(160, viewport.height - top - margin);
  } else {
    maxHeight = Math.max(160, spaceAbove);
    top = Math.max(margin, rect.top - maxHeight);
  }

  let left = rect.right - width;
  if (left < margin) left = margin;
  if (left + width > viewport.width - margin) left = Math.max(margin, viewport.width - width - margin);

  return { top, left, width, maxHeight };
}
