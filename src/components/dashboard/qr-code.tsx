import QRCode from "qrcode";

/**
 * A QR code rendered to inline SVG on the server.
 *
 * SVG rather than a PNG data URI because this is displayed on a 55–65" panel:
 * vector stays crisp at any size, and a phone camera reading it from across the
 * room needs every bit of edge contrast it can get. Inline rather than an
 * `<img>` so it costs no extra request and cannot flash in late on a board that
 * is meant to just be there.
 */
export async function QrCode({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  let svg: string;
  try {
    svg = await QRCode.toString(value, {
      type: "svg",
      // Quiet zone: 1 module is the minimum that still scans reliably.
      margin: 1,
      width: size,
      // Highest correction — a wall screen picks up glare and reflections, and
      // H survives roughly 30% of the code being unreadable.
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    return null;
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      // The SVG is generated from our own URL string, not user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
