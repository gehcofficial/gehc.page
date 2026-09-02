import { useEffect, type RefObject } from 'react';

const LOOP_SEC = 88;
const DEAD_ZONE = 0.2;
const MAX_MULT = 7;
const LERP = 8;
const DRAG_CLICK_PX = 8;

function isMouse(e: PointerEvent) {
  return e.pointerType === 'mouse';
}

export function useSteerableMarquee(
  viewportRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!enabled || !viewport || !track) {
      if (track) track.style.transform = '';
      return;
    }

    let raf = 0;
    let lastTs = performance.now();
    let offset = 0;
    let velocity = 0;
    let target = 0;
    let defaultSpeed = 40;
    let maxSpeed = 280;
    let loopW = 0;
    let hovering = false;
    let dragging = false;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastMoveTs = 0;
    let instVx = 0;
    let dragDist = 0;
    let suppressClick = false;

    const wrap = (v: number) => {
      if (loopW <= 0) return v;
      v %= loopW;
      if (v < 0) v += loopW;
      return v;
    };

    const apply = () => {
      track.style.transform = `translate3d(${-offset}px,0,0)`;
    };

    const measure = () => {
      const cards = track.querySelectorAll<HTMLElement>('[data-card]');
      if (cards.length >= 4) {
        const half = Math.floor(cards.length / 2);
        loopW = cards[half].offsetLeft - cards[0].offsetLeft;
      } else {
        loopW = track.scrollWidth / 2;
      }
      if (loopW > 1) {
        defaultSpeed = loopW / LOOP_SEC;
        maxSpeed = defaultSpeed * MAX_MULT;
        if (!hovering && !dragging) target = defaultSpeed;
        if (velocity === 0) velocity = defaultSpeed;
        offset = wrap(offset);
      }
    };

    const targetFromX = (clientX: number) => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0) return defaultSpeed;
      const x = (clientX - rect.left) / rect.width;
      const fromCenter = (x - 0.5) * 2;
      if (Math.abs(fromCenter) < DEAD_ZONE) return defaultSpeed;
      const t = (Math.abs(fromCenter) - DEAD_ZONE) / (1 - DEAD_ZONE);
      const eased = t * t;
      if (fromCenter > 0) {
        return defaultSpeed * (1 + eased * (MAX_MULT - 1));
      }
      return defaultSpeed + eased * (-maxSpeed - defaultSpeed);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (!dragging && loopW > 0) {
        const k = 1 - Math.exp(-LERP * dt);
        velocity += (target - velocity) * k;
        offset = wrap(offset + velocity * dt);
        apply();
      }
      raf = requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging && pointerId === e.pointerId) {
        const now = performance.now();
        const dx = e.clientX - lastX;
        const dt = Math.max(0.008, (now - lastMoveTs) / 1000);
        offset = wrap(offset - dx);
        instVx = -dx / dt;
        lastX = e.clientX;
        lastMoveTs = now;
        dragDist += Math.abs(dx);
        apply();
        return;
      }
      if (isMouse(e) && !dragging) {
        hovering = true;
        target = targetFromX(e.clientX);
      }
    };

    const onPointerEnter = (e: PointerEvent) => {
      if (!isMouse(e)) return;
      hovering = true;
      target = targetFromX(e.clientX);
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (dragging) return;
      if (isMouse(e)) {
        hovering = false;
        target = defaultSpeed;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isMouse(e)) return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastMoveTs = performance.now();
      instVx = 0;
      dragDist = 0;
      velocity = 0;
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging || pointerId !== e.pointerId) return;
      dragging = false;
      pointerId = null;
      if (dragDist > DRAG_CLICK_PX) suppressClick = true;
      velocity = Math.max(-maxSpeed, Math.min(maxSpeed, instVx));
      target = defaultSpeed;
      hovering = false;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };

    measure();
    velocity = defaultSpeed;
    target = defaultSpeed;
    apply();

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(viewport);

    viewport.addEventListener('pointerenter', onPointerEnter);
    viewport.addEventListener('pointerleave', onPointerLeave);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('click', onClickCapture, true);

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      viewport.removeEventListener('pointerenter', onPointerEnter);
      viewport.removeEventListener('pointerleave', onPointerLeave);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('click', onClickCapture, true);
      track.style.transform = '';
    };
  }, [enabled, viewportRef, trackRef]);
}
