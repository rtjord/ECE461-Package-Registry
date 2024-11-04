'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Package {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  metrics: {
    busFactor: number;
    correctness: number;
    rampUp: number;
    license: string;
  };
  score: number;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const searchType = searchParams.get('type');

  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');

  useEffect(() => {
    const fetchSearchResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const dummyResults: Package[] = [
          {
            id: '1',
            name: 'express',
            description: 'Fast, unopinionated, minimalist web framework for Node.js',
            version: '4.18.2',
            author: 'TJ Holowaychuk',
            metrics: {
              busFactor: 0.9,
              correctness: 0.95,
              rampUp: 0.8,
              license: 'MIT',
            },
            score: 0.95,
          },
        ];

        setPackages(dummyResults);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch search results';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchResults();
  }, [query, searchType]);

  const sortedPackages = [...packages].sort((a, b) => {
    if (sortBy === 'score') {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="mb-8">
        <div className="bg-gray-100 p-6 rounded-lg mb-6">
          <h1 className="text-3xl font-bold mb-4">Search Results</h1>
          <div className="flex flex-col gap-2">
            <p className="text-lg">
              <span className="font-medium">Search Query:</span> &ldquo;{query}&rdquo;
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Search Type:</span> {searchType === 'smart' ? 'Smart Search' : 'Regular Search'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div role="status" className="flex justify-center items-center min-h-[200px]">
            <span className="sr-only">Loading search results...</span>
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div role="alert" className="text-red-600 text-center p-4 bg-red-50 rounded-md">
            {error}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <p className="text-gray-600">{packages.length} packages found</p>
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm text-gray-600">
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'score' | 'name')}
                  className="border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="score">Match Score</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            <ul className="space-y-6">
              {sortedPackages.map((pkg) => (
                <li key={pkg.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50">
                  <Link href={`/packages/${pkg.name}`} className="block">
                    <div className="flex justify-between items-start mb-2">
                      <h2 className="text-xl font-semibold text-blue-600 hover:underline">
                        {pkg.name}
                      </h2>
                      <span className="text-sm text-gray-500">v{pkg.version}</span>
                    </div>
                    <p className="text-gray-600 mb-4">{pkg.description}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Bus Factor:</span>
                        <span className="ml-2">{pkg.metrics.busFactor.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Correctness:</span>
                        <span className="ml-2">{pkg.metrics.correctness.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Ramp Up:</span>
                        <span className="ml-2">{pkg.metrics.rampUp.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">License:</span>
                        <span className="ml-2">{pkg.metrics.license}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </div>
  );
}

export default function SearchResults() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
} 