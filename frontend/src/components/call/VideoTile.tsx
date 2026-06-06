// Web/default: native renders video via VideoTile.native.tsx. On web the call
// screen mounts <video> elements into DOM containers directly, so this is a
// no-op placeholder (never rendered on web).
export default function VideoTile(_props: { trackRef: any; style?: any; mirror?: boolean }) {
  return null;
}
