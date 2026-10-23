import qrcode from 'qrcode-generator';

/** Four-module quiet zone, as the QR spec requires for reliable scanning. */
const QUIET_ZONE = 4;

/** One SVG path of all dark modules, in module units. */
export function buildQrPath(value: string): { path: string; modules: number } {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }
  return { path, modules: count + QUIET_ZONE * 2 };
}
