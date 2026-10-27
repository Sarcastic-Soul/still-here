import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Still Here",
  description: "A dead man's switch with an open model inside.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
