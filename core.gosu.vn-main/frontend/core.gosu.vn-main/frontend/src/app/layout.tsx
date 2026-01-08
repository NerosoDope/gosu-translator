import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOSU Core Platform',
  description: 'Core Platform cho các dự án GOSU',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body className="dark:bg-gray-900">
        {children}
      </body>
    </html>
  )
}
