import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CounselTech - AI-Powered Legal Intake',
  description: 'AI-powered intake and lead capture for law firms',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
