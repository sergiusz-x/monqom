import type { SVGProps } from "react";

interface MonqomLogoProps extends SVGProps<SVGSVGElement> {
  /** Rendered pixel size (width & height). Defaults to 24. */
  size?: number;
}

/**
 * Monqom brand icon - two offset outlined rounded squares.
 *
 * Uses `currentColor` so it automatically adapts to any light/dark theme
 * context via the parent's text colour.
 */
export default function MonqomLogo({ size = 24, ...props }: MonqomLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="1.5"
        y="1.5"
        width="28"
        height="28"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect
        x="14.5"
        y="14.5"
        width="28"
        height="28"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
