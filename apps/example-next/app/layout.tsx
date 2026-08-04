import type { ReactNode } from 'react'

export const metadata = {
  title: "example-next",
  description: 'Holo on Next.js',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
