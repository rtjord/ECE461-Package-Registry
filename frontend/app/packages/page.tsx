"use client"; // Mark this as a Client Component

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Package {
    id: string;
    name: string;
    author: string;
    version: string;
    description: string;
}

export default function PackageDirectory() {
    const [packages, setPackages] = useState<Package[]>([]);

    useEffect(() => {
        async function fetchPackages() {
            const fakePackages: Package[] = [
                { id: '1', name: 'package-one', author: 'Author One', version: '1.0.0', description: 'This is the first package' },
                { id: '2', name: 'package-two', author: 'Author Two', version: '2.0.0', description: 'This is the second package' },
                { id: '3', name: 'package-three', author: 'Author Three', version: '3.0.0', description: 'This is the third package' },
            ];
            setPackages(fakePackages);
        }

        fetchPackages();
    }, []);

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Package Directory</h1>
            <ul className="space-y-4">
                {packages.map((pkg) => (
                    <li key={pkg.id}>
                        <Link href={`/packages/${pkg.name}`} className="text-blue-500 hover:underline">
                            {pkg.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
