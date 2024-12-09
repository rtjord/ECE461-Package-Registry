'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SearchType = 'id' | 'name' | 'regex' | 'smart';

export default function Home() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (type: SearchType) => (e: React.FormEvent) => {
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
              placeholder="Enter package name, ID, or search pattern..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search packages"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSearch('id')}
              className="bg-[#326ed1] text-white py-3 px-6 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Search by ID"
            >
              Search by ID
            </button>
            <button
              onClick={handleSearch('name')}
              className="bg-[#974cde] text-white py-3 px-6 rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              aria-label="Search by Name"
            >
              Search by Name
            </button>
            <button
              onClick={handleSearch('regex')}
              className="bg-[#5e60e4] text-white py-3 px-6 rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
              aria-label="Search by Regex"
            >
              Search by Regex
            </button>
            <button
              onClick={handleSearch('smart')}
              className="bg-[#14873f] text-white py-3 px-6 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
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
