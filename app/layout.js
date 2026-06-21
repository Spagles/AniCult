import "./globals.css";
import Link from "next/link";
import { SearchBar } from "./search-bar";

export const metadata = {
  title: "AniCult",
  description: "A clean anime streaming experience",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav className="nav">
          <Link href="/" className="nav-logo">
            AniCult
          </Link>
          <div className="nav-links">
            <Link href="/">Home</Link>
            <Link href="/search?sort=TRENDING_DESC">Trending</Link>
            <Link href="/search?sort=POPULARITY_DESC">Popular</Link>
            <Link href="/watchlist">Watchlist</Link>
            <Link href="/history">History</Link>
          </div>
          <SearchBar />
        </nav>
        <main className="main">{children}</main>
        <footer className="footer">
          AniCult — For personal use only. Data from AniList.
        </footer>
      </body>
    </html>
  );
}
