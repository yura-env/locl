/**
 * The Locl mark: a rounded square holding a pause bar and a play triangle.
 * Geometry is lifted straight from the design at a 24x24 box.
 *
 * The square takes the foreground colour and the glyph takes the card colour,
 * so the mark inverts itself correctly in every theme without a second asset.
 */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="2.25"
        y="2.25"
        width="19.5"
        height="19.5"
        rx="4.92"
        fill="var(--text)"
      />
      <rect
        x="7.27"
        y="5.77"
        width="3.75"
        height="12.47"
        rx="1.875"
        fill="var(--card)"
      />
      <path
        d="M13.95 7.27l3.86 4.73-3.86 4.73V7.27z"
        fill="var(--card)"
      />
    </svg>
  );
}
