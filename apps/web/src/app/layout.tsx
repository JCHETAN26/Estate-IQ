import type { ReactNode } from "react";

export const metadata = {
  title: "EstateIQ",
  description: "AI-powered real estate underwriting platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
