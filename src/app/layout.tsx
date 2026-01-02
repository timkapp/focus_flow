import * as React from 'react';
import Providers from '../components/Providers';
import './globals.css';

export const metadata = {
  title: 'FocusFlow',
  description: 'A week-pure personal operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
