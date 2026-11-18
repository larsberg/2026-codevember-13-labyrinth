// A click/tap is distinct from OrbitControls' drag, pan and pinch gestures.
export function bindRegenerationInputs(canvas, regenerate, keyboard = canvas.ownerDocument) {
  let press = null;
  const down = event => {
    if (event.button !== 0 || event.isPrimary === false || press) { press = null; return; }
    press = { id:event.pointerId, x:event.clientX, y:event.clientY, moved:false };
  };
  const move = event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX-press.x,event.clientY-press.y) > 6) press.moved = true;
  };
  const cancel = () => { press = null; };
  const up = event => {
    if (press?.id !== event.pointerId) return;
    move(event);
    const clicked = !press.moved && event.button === 0;
    press = null;
    if (clicked) regenerate();
  };
  const keydown = event => {
    if (event.code !== 'Space' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      || (keyboard.hasFocus && !keyboard.hasFocus())
      || event.target?.closest?.('input,textarea,select,button,a,summary,[contenteditable="true"],[role="button"]')) return;
    event.preventDefault();
    if (!event.repeat) regenerate();
  };
  const handlers = { pointerdown:down, pointermove:move, pointerup:up, pointercancel:cancel };
  for (const [type, handler] of Object.entries(handlers)) canvas.addEventListener(type,handler);
  keyboard.addEventListener('keydown',keydown);
  return () => {
    cancel(); for (const [type, handler] of Object.entries(handlers)) canvas.removeEventListener(type,handler);
    keyboard.removeEventListener('keydown',keydown);
  };
}
