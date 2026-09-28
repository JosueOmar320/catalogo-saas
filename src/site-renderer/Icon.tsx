import { createElement } from 'react';
import { ICONS, isIconId } from '@/lib/design/icons';

/** Ícono del registro (mismos nodos SVG que usa el PDF). */
export function Icon({ id, size = 20, strokeWidth = 2, className }: { id: string; size?: number; strokeWidth?: number; className?: string }) {
  if (!isIconId(id)) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[id].node.map(([tag, attrs], index) => createElement(tag, { ...attrs, key: index }))}
    </svg>
  );
}
