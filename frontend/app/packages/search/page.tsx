'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface PackageMetadata {
  Name: string;
  Version: string;
  ID: string;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<PackageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = searchParams.get('q');
        const type = searchParams.get('type');

        if (!query || !type) {
          throw new Error('Missing search parameters');
        }

        let response;

        // Handle different search types
        if (type === 'regex' || type === 'smart') {
          try {
            // Test if it's a valid regex
            new RegExp(query);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Invalid regular expression pattern: ${errorMessage}`);
          }
          response = await fetch(`/api/search-proxy?type=${type}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
          });
        } else {
          response = await fetch(`/api/search-proxy?type=${type}&q=${encodeURIComponent(query)}`);
        }

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle single package response for ID search
        if (type === 'id') {
          setResults([data.metadata]);
        } else {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred during search');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [searchParams]);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Search Results</h1>
      {results.length === 0 ? (
        <p>No packages found.</p>
      ) : (
        <div className="grid gap-4">
          {results.map((pkg) => (
            <div
              key={pkg.ID}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <Link href={`/packages/${pkg.ID}`}>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{pkg.Name}</h2>
                  <p className="text-gray-600">Version: {pkg.Version}</p>
                  <p className="text-gray-500">ID: {pkg.ID}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Fallback component to show while the main content is loading
function SearchFallback() {
  return (
    <div className="p-8 text-center">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-6 mx-auto"></div>
        <div className="space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

// Main component wrapped with Suspense
export default function SearchResults() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchResultsContent />
    </Suspense>
  );
} 