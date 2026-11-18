'use client';

import { useEffect, useRef, useState } from 'react';
import { getArtistInitials } from '@/lib/initials';

const HERO_WIDTH = 432;
const HERO_HEIGHT = 230.4;
const PIXEL_RATIO = 2;

interface CardHeroProps {
  imageUrl: string | null;
  artist: string;
}

/**
 * Top 30% of the capsule. A Deezer artist photo when available, otherwise a
 * procedural geometric canvas (waveform lines, rings and the artist initials)
 * so the card always looks intentional.
 */
export function CardHero({ imageUrl, artist }: CardHeroProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- plain <img> keeps the DOM export-friendly.
      <img
        src={imageUrl}
        alt=""
        draggable={false}
        decoding="sync"
        onError={() => setFailed(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  return <FallbackCanvas artist={artist} />;
}

function FallbackCanvas({ artist }: { artist: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = Math.round(HERO_WIDTH * PIXEL_RATIO);
    canvas.height = Math.round(HERO_HEIGHT * PIXEL_RATIO);

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);

    // Solid dark background, no gradients or glow.
    context.fillStyle = '#18181b';
    context.fillRect(0, 0, HERO_WIDTH, HERO_HEIGHT);

    const centerX = HERO_WIDTH * 0.5;
    const centerY = HERO_HEIGHT * 0.52;

    // Fine horizontal acoustic waveform lines.
    for (let line = -3; line <= 3; line += 1) {
      context.beginPath();
      context.strokeStyle =
        line === 0 ? 'rgba(240,104,72,0.34)' : 'rgba(244,244,245,0.07)';
      context.lineWidth = line === 0 ? 1.5 : 1;

      for (let x = 0; x <= HERO_WIDTH; x += 4) {
        const envelope = Math.sin((x / HERO_WIDTH) * Math.PI);
        const y =
          centerY +
          line * 14 +
          Math.sin(x * 0.035 + line * 0.9) * (18 * envelope);

        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.stroke();
    }

    // Concentric geometric rings.
    const radii = [34, 58, 82, 106];
    radii.forEach((radius, index) => {
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.strokeStyle =
        index === 1 ? 'rgba(240,104,72,0.4)' : 'rgba(244,244,245,0.08)';
      context.lineWidth = index === 1 ? 1.5 : 1;
      context.stroke();
    });

    // Center badge with the artist initials.
    context.beginPath();
    context.arc(centerX, centerY, 36, 0, Math.PI * 2);
    context.fillStyle = '#212121';
    context.fill();
    context.strokeStyle = '#3f3f46';
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = '#f4f4f5';
    context.font =
      '700 24px var(--font-geist-sans), system-ui, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(getArtistInitials(artist), centerX, centerY + 1);

    // Small corner ticks for a deliberate, geometric composition.
    context.strokeStyle = 'rgba(240,104,72,0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(20, 28);
    context.lineTo(36, 28);
    context.moveTo(20, 28);
    context.lineTo(20, 44);
    context.stroke();
  }, [artist]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
