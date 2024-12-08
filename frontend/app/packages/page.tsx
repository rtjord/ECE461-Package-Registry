"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Package {
    ID: string;
    Name: string;
    Version: string;
}

export default function PackageDirectory() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'name' | 'author'>('name');

    useEffect(() => {
        const fetchPackages = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/search-proxy?type=regex', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: '.' })
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch packages: ${response.statusText}`);
                }

                const data = await response.json();
                setPackages(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Error fetching packages:', error);
                setError(error instanceof Error ? error.message : 'Failed to fetch packages');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPackages();
    }, []);

    const sortedPackages = [...packages].sort((a, b) => {
        if (sortBy === 'name') {
            return a.Name.localeCompare(b.Name);
        }
        return a.Name.localeCompare(b.Name);
    });

    return (
        <div className="max-w-6xl mx-auto p-8">
            <header className="mb-8">
                <div className="bg-gray-100 p-6 rounded-lg mb-6">
                    <h1 className="text-3xl font-bold">Package Directory</h1>
                    <p className="text-gray-600 mt-2">Browse all available packages in our registry</p>
                </div>

                {isLoading ? (
                    <div role="status" className="flex justify-center items-center min-h-[200px]">
                        <span className="sr-only">Loading packages...</span>
                        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : error ? (
                    <div role="alert" className="text-red-600 text-center p-4 bg-red-50 rounded-md">
                        {error}
                    </div>
                ) : (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <p className="text-gray-600">{packages.length} packages available</p>
                            <div className="flex items-center gap-2">
                                <label htmlFor="sort-select" className="text-sm text-gray-600">
                                    Sort by:
                                </label>
                                <select
                                    id="sort-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'name' | 'author')}
                                    className="border border-gray-300 rounded-md px-2 py-1"
                                >
                                    <option value="name">Name</option>
                                    <option value="author">Author</option>
                                </select>
                            </div>
                        </div>

                        <ul className="space-y-6">
                            {sortedPackages.map((pkg) => (
                                <li key={pkg.ID} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                                    <Link href={`/packages/${pkg.ID}`} className="block">
                                        <div className="flex justify-between items-start mb-2">
                                            <h2 className="text-xl font-semibold text-blue-600 hover:underline">
                                                {pkg.Name}
                                            </h2>
                                            <span className="text-sm text-gray-500">v{pkg.Version}</span>
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
