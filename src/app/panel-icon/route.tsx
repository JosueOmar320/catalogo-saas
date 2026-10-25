import { ImageResponse } from 'next/og';

/** Ícono PNG del panel instalado (pantalla de inicio, iPhone) y de los avisos: el mismo dibujo que icon.svg. */
export const dynamic = 'force-static';

const SIZE = 512;
const u = SIZE / 32;

export function GET() {
  const tile = (x: number, y: number, w: number, h: number, background: string, opacity = 1) => (
    <div style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, borderRadius: 1.5 * u, background, opacity }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: SIZE, height: SIZE, display: 'flex', position: 'relative', background: '#18181B' }}>
        {tile(7, 8, 8, 8, '#fff')}
        {tile(17, 8, 8, 8, '#fff', 0.6)}
        {tile(7, 18, 8, 6, '#fff', 0.6)}
        {tile(17, 18, 8, 6, '#2F54D6')}
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
