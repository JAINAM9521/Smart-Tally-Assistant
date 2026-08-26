import "./globals.css";

export const metadata = {
  title: "Smart Tally XML Assistant",
  description: "Excel to Tally XML — Smarter, Faster, Safer.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
