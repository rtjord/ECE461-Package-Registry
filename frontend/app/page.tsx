'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    console.log('Searching for:', searchQuery);
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-8 text-center">NPM-like Package Manager</h1>
      </header>
      
      <main className="flex flex-col gap-8 items-center sm:items-start w-full max-w-3xl">
        <form onSubmit={handleSearch} className="w-full">
          <label htmlFor="search-input" className="sr-only">Search packages</label>
          <div className="flex gap-2">
            <input
              type="search"
              id="search-input"
              className="flex-grow p-2 border border-gray-300 rounded-md"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search packages"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Search"
            >
              Search
            </button>
          </div>
        </form>

        <nav className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            href="/packages"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Package Directory
          </Link>
          <Link
            href="/upload"
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Upload Package
          </Link>
        </nav>
      </main>

      <footer className="text-center text-sm text-gray-500">
        © 2024 NPM-like Package Manager. All rights reserved.
      </footer>
    </div>
  );
}
