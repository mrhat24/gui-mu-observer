/** Window geometry is a hint: the browser/OS may ignore it. Never resize normal tabs. */
export function initializePwaWindow(
  target: Pick<Window, 'matchMedia' | 'screen' | 'resizeTo'> = window,
) {
  if (!target.matchMedia('(display-mode: standalone)').matches || target.screen.availWidth < 700)
    return;
  const width = Math.min(1360, target.screen.availWidth);
  const height = Math.min(960, target.screen.availHeight);
  if (width <= 0 || height <= 0) return;
  try {
    target.resizeTo(width, height);
  } catch {
    /* Resizing is optional; CSS remains responsive. */
  }
}
