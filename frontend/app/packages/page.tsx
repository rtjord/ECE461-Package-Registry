"use client"; // Mark this as a Client Component

import { useEffect, useState } from 'react';
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
                // TODO: Replace with actual API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Dummy data for demonstration
                const dummyPackages: Package[] = [
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
                    },
                    {
                        id: '2',
                        name: 'lodash',
                        description: 'A modern JavaScript utility library delivering modularity, performance & extras',
                        version: '4.17.21',
                        author: 'John-David Dalton',
                        metrics: {
                            busFactor: 0.85,
                            correctness: 0.9,
                            rampUp: 0.75,
                            license: 'MIT',
                        },
                    },
                    {
                        id: '3',
                        name: 'react',
                        description: 'A JavaScript library for building user interfaces',
                        version: '18.2.0',
                        author: 'Meta Open Source',
                        metrics: {
                            busFactor: 0.95,
                            correctness: 0.98,
                            rampUp: 0.85,
                            license: 'MIT',
                        },
                    },
                ];

                setPackages(dummyPackages);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch packages';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPackages();
    }, []);

    const sortedPackages = [...packages].sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        }
        return a.author.localeCompare(b.author);
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
                                <li key={pkg.id} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                                    <Link href={`/packages/${pkg.name}`} className="block">
                                        <div className="flex justify-between items-start mb-2">
                                            <h2 className="text-xl font-semibold text-blue-600 hover:underline">
                                                {pkg.name}
                                            </h2>
                                            <span className="text-sm text-gray-500">v{pkg.version}</span>
                                        </div>
                                        <p className="text-gray-600 mb-4">{pkg.description}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
                                        <div className="mt-4 text-sm text-gray-500">
                                            <span className="font-medium">Author:</span> {pkg.author}
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
