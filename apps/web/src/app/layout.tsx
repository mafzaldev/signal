import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Feature Flags',
  description: 'Manage feature flags and rollouts',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
