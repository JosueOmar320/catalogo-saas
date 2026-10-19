import qrcode from 'qrcode-generator';

/**
 * Código QR como matriz de módulos y como SVG (una sola ruta, nítido a
 * cualquier tamaño). Corrección de errores "M": aguanta ~15 % de daño
 * (manchas, dobleces) sin volverse enorme.
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, col) => qr.isDark(row, col)));
}

/** Ruta SVG de los módulos oscuros (coordenadas en módulos, desplazadas por el margen). */
export function qrPath(matrix: boolean[][], margin = 4): string {
  const parts: string[] = [];
  matrix.forEach((cells, row) => {
    cells.forEach((dark, col) => {
      if (dark) parts.push(`M${col + margin} ${row + margin}h1v1h-1z`);
    });
  });
  return parts.join('');
}

/** SVG completo para descargar. El margen blanco ("zona tranquila") de 4 módulos es el que pide el estándar. */
export function qrSvg(text: string, { margin = 4, color = '#000000', background = '#ffffff' } = {}): string {
  const matrix = qrMatrix(text);
  const size = matrix.length + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path d="${qrPath(matrix, margin)}" fill="${color}"/></svg>`;
}
