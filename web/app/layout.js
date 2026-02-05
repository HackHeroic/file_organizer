import "./globals.css";

export const metadata = {
  title: "File Organizer | OS Project",
  description: "File Organizer - visualize OS file operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased app-content">{children}</body>
    </html>
  );
}
