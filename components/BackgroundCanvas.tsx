'use client';

import { useEffect, useRef } from 'react';

interface Wave {
  yRatio: number;
  amplitude: number;
  frequency: number;
  speed: number;
  color: string;
}

const WAVES: Wave[] = [
  { yRatio: 0.18, amplitude: 18, frequency: 0.0045, speed: 0.008, color: 'rgba(244,244,245,0.045)' },
  { yRatio: 0.34, amplitude: 26, frequency: 0.0032, speed: -0.006, color: 'rgba(240,104,72,0.065)' },
  { yRatio: 0.52, amplitude: 20, frequency: 0.0052, speed: 0.005, color: 'rgba(244,244,245,0.04)' },
  { yRatio: 0.7, amplitude: 30, frequency: 0.0028, speed: -0.004, color: 'rgba(244,244,245,0.035)' },
  { yRatio: 0.86, amplitude: 16, frequency: 0.006, speed: 0.007, color: 'rgba(240,104,72,0.045)' },
];

/**
 * Very low-contrast waveform lines behind the page. Movement is slow, reacts
 * subtly to the pointer, pauses when the tab is hidden and becomes a single
 * static frame when the visitor prefers reduced motion.
 */
export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const context = canvasElement.getContext('2d');
    if (!context) return;

    // Explicit annotation keeps the non-null type inside hoisted functions.
    const canvasNode: HTMLCanvasElement = canvasElement;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let phase = 0;
    let frame: number | null = null;

    function resize() {
      const parent = canvasNode.parentElement;
      const rect = parent?.getBoundingClientRect();
      width = Math.max(1, Math.round(rect?.width ?? window.innerWidth));
      height = Math.max(1, Math.round(rect?.height ?? window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvasNode.width = Math.round(width * dpr);
      canvasNode.height = Math.round(height * dpr);
      draw();
    }

    function draw() {
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      WAVES.forEach((wave, index) => {
        context.beginPath();
        context.strokeStyle = wave.color;
        context.lineWidth = 1;
        const baseY = height * wave.yRatio;
        const step = 8;

        for (let x = 0; x <= width; x += step) {
          const distanceFromPointer = Math.abs(x / width - pointer.x);
          const pointerBoost =
            Math.max(0, 1 - distanceFromPointer * 2.4) * 14 * (pointer.y - 0.5);
          const y =
            baseY +
            Math.sin(x * wave.frequency + phase * (index % 2 === 0 ? 1 : -0.8) + index * 1.3) *
              wave.amplitude +
            Math.cos(x * wave.frequency * 0.5 - phase * 0.6) * (wave.amplitude * 0.35) +
            pointerBoost;

          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }

        context.stroke();
      });
    }

    function loop() {
      frame = null;
      if (document.hidden || reducedMotion.matches) return;
      phase += 0.012;
      draw();
      frame = window.requestAnimationFrame(loop);
    }

    function start() {
      if (reducedMotion.matches || document.hidden) {
        draw();
        return;
      }
      if (frame === null) frame = window.requestAnimationFrame(loop);
    }

    function stop() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    function onPointerMove(event: PointerEvent) {
      pointer.targetX = event.clientX / Math.max(1, window.innerWidth);
      pointer.targetY = event.clientY / Math.max(1, window.innerHeight);
    }

    function onVisibilityChange() {
      if (document.hidden) stop();
      else start();
    }

    function onReducedMotionChange() {
      stop();
      start();
    }

    const resizeObserver = new ResizeObserver(resize);
    if (canvasNode.parentElement) resizeObserver.observe(canvasNode.parentElement);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onReducedMotionChange);

    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onReducedMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
