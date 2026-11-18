interface BrandMarkProps {
  size?: number;
  surface?: string;
  border?: string;
  accent?: string;
  className?: string;
}

/**
 * The product's own geometric capsule mark: a rounded square with three solid
 * waveform bars. The accent can follow the selected card theme.
 */
export function BrandMark({
  size = 28,
  surface = '#171719',
  border = '#2e2e32',
  accent = '#F06848',
  className,
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="1" y="1" width="26" height="26" rx="8" fill={surface} stroke={border} strokeWidth="1.5" />
      <rect x="7" y="10" width="3" height="8" rx="1.5" fill={accent} />
      <rect x="12.5" y="6.5" width="3" height="15" rx="1.5" fill={accent} />
      <rect x="18" y="11.5" width="3" height="6.5" rx="1.5" fill={accent} />
    </svg>
  );
}
