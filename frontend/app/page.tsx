'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (type: 'regular' | 'smart') => (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create the search URL with parameters
    const params = new URLSearchParams();
    params.set('q', searchInput);
    params.set('type', type);
    
    // Navigate to the search results page
    router.push(`/packages/search?${params.toString()}`);
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-8 text-center">NPM-like Package Manager</h1>
      </header>
      
      <main className="flex flex-col gap-8 items-center w-full max-w-3xl">
        <div className="w-full space-y-6">
          <div>
            <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
              Search Packages
            </label>
            <input
              type="search"
              id="search-input"
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="Enter package name or describe what you're looking for..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search packages"
            />
          </div>

          <div className="flex gap-4 flex-col sm:flex-row">
            <button
              onClick={handleSearch('regular')}
              className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Regular search"
            >
              Search
            </button>
            <button
              onClick={handleSearch('smart')}
              className="flex-1 bg-green-500 text-white py-3 px-6 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              aria-label="Smart search"
            >
              Smart Search
            </button>
          </div>
        </div>

        <nav className="flex gap-4 items-center flex-col sm:flex-row mt-8">
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
