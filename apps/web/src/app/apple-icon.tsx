import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Home-screen icon: the lamp on the app's dark background, since iOS fills transparency. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0e',
      }}
    >
      <svg width="120" height="120" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="11.5" fill="none" stroke="#ededea" strokeWidth="2.4" />
        <circle cx="16" cy="16" r="6" fill="#ff5a14" />
      </svg>
    </div>,
    size,
  );
}
