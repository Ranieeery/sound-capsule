'use client';

import { useTranslations } from 'next-intl';
import type { ArtistCount, TrackCount } from '@/lib/aggregate';
import { BrandMark } from './BrandMark';
import { CardHero } from './CardHero';

export const CARD_WIDTH = 432;
export const CARD_HEIGHT = 768;
/** Story format: top 30% is the artist cover, bottom 70% is solid #212121. */
export const CARD_HERO_HEIGHT = CARD_HEIGHT * 0.3;
export const CARD_EXPORT_WIDTH = 1080;
export const CARD_EXPORT_HEIGHT = 1920;

interface CapsuleCardProps {
  periodLabel: string;
  topArtists: ArtistCount[];
  topTracks: TrackCount[];
  minutes: number;
  heroImageUrl: string | null;
  coverArtist: string;
  cardRef?: React.Ref<HTMLDivElement>;
}

export function CapsuleCard({
  periodLabel,
  topArtists,
  topTracks,
  minutes,
  heroImageUrl,
  coverArtist,
  cardRef,
}: CapsuleCardProps) {
  const t = useTranslations('Card');

  return (
    <div
      ref={cardRef}
      data-testid="capsule-card"
      className="select-none"
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#212121',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: CARD_HERO_HEIGHT,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: '#19191b',
        }}
      >
        <CardHero imageUrl={heroImageUrl} artist={coverArtist} />
      </div>

      <div
        style={{
          height: CARD_HEIGHT - CARD_HERO_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '22px 28px 24px',
          backgroundColor: '#212121',
        }}
      >
        {/* Brand + period */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <BrandMark size={20} surface="#171719" border="#343438" />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: '#f4f4f5',
              }}
            >
              Sound Capsule
            </span>
          </div>

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1.3,
              color: '#a1a1aa',
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {periodLabel}
          </span>
        </div>

        {/* Card title */}
        <h2
          data-card-title
          style={{
            fontSize: 26,
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            color: '#f4f4f5',
            margin: 0,
            wordBreak: 'break-word',
          }}
        >
          {t('title', { period: periodLabel })}
        </h2>

        {/* Two numbered columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 20,
            alignItems: 'start',
          }}
        >
          <CardColumn
            heading={t('topArtists')}
            items={topArtists.map((artist) => ({ key: artist.key, label: artist.name }))}
          />
          <CardColumn
            heading={t('topTracks')}
            items={topTracks.map((track) => ({ key: track.key, label: track.name }))}
          />
        </div>

        {/* Listening time */}
        <div
          style={{
            borderTop: '1px solid #2e2e2e',
            paddingTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#a1a1aa',
            }}
          >
            {t('timeListened')}
          </span>
          <span
            style={{
              fontSize: 30,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#F06848',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('minutes', { minutes })}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CardColumnProps {
  heading: string;
  items: Array<{ key: string; label: string }>;
}

function CardColumn({ heading, items }: CardColumnProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: '#a1a1aa',
          marginBottom: 9,
        }}
      >
        {heading}
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => (
          <li
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 7,
              minWidth: 0,
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: '#a1a1aa',
                width: 13,
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {index + 1}
            </span>
            <span
              title={item.label}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13.5,
                fontWeight: 500,
                lineHeight: 1.35,
                color: '#f4f4f5',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
