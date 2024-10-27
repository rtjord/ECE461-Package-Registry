// app/package/[packageName]/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface PackageMetrics {
  busFactor: number;
  correctness: number;
  license: string;
  rampUpTime: number;
}

interface PackageDetailProps {
  params: {
    packageName: string;
  };
}

export default function PackageDetail({ params }: PackageDetailProps) {
  const [packageData, setPackageData] = useState<{
    name: string;
    metrics: PackageMetrics;
    readme: string;
    githubUrl: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Placeholder functions for package actions
  const handleUpload = async () => {
    try {
      // TODO: Implement package upload functionality
      console.log('Upload package:', params.packageName);
    } catch  {
      setError('Failed to upload package. Please try again.');
    }
  };

  const handleUpdate = async () => {
    try {
      // TODO: Implement package update functionality
      console.log('Update package:', params.packageName);
    } catch {
      setError('Failed to update package. Please try again.');
    }
  };

  const handleCheckRating = async () => {
    try {
      // TODO: Implement rating check functionality
      console.log('Check rating for:', params.packageName);
    } catch  {
      setError('Failed to check package rating. Please try again.');
    }
  };

  const handleDownload = async () => {
    try {
      // TODO: Implement package download functionality
      console.log('Download package:', params.packageName);
    } catch {
      setError('Failed to download package. Please try again.');
    }
  };

  useEffect(() => {
    const fetchPackageData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Simulated API call
        const dummyData = {
          name: params.packageName,
          metrics: {
            busFactor: 0.8,
            correctness: 0.95,
            license: "MIT",
            rampUpTime: 2.5,
          },
          readme: "# Example Package\n\nThis is a dummy README for the Example Package.\n\n## Installation\n\n```\nnpm install example-package\n```\n\n## Usage\n\n```javascript\nconst examplePackage = require('example-package');\n\nexamplePackage.doSomething();\n```\n\n## License\n\nThis project is licensed under the MIT License.",
          githubUrl: `https://github.com/example/${params.packageName}`,
        };
        setPackageData(dummyData);
      } catch {
        setError('Failed to load package data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackageData();
  }, [params.packageName]);

  if (isLoading) {
    return (
      <div className="p-8" role="alert" aria-busy="true">
        <span className="sr-only">Loading package information</span>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-600" role="alert">
        {error}
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="p-8 text-red-600" role="alert">
        Package not found
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex space-x-2">
          <li>
            <Link href="/packages" className="text-blue-500 hover:underline">
              Packages
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{packageData.name}</li>
        </ol>
      </nav>

      <main>
        <h1 className="text-3xl font-bold mb-6" tabIndex={0}>{packageData.name}</h1>
        
        {/* Package Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8" role="toolbar" aria-label="Package actions">
          <button
            onClick={handleUpload}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            aria-label="Upload new package"
          >
            Upload Package
          </button>
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            aria-label="Update package version"
          >
            Update Version
          </button>
          <button
            onClick={handleCheckRating}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
            aria-label="Check package rating"
          >
            Check Rating
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
            aria-label="Download package"
          >
            Download Package
          </button>
        </div>

        <section aria-labelledby="metrics-heading" className="bg-gray-100 p-6 rounded-lg mb-8">
          <h2 id="metrics-heading" className="text-xl font-semibold mb-4">Package Metrics</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="font-semibold">Bus Factor:</dt>
              <dd>{packageData.metrics.busFactor.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Correctness:</dt>
              <dd>{packageData.metrics.correctness.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="font-semibold">License:</dt>
              <dd>{packageData.metrics.license}</dd>
            </div>
            <div>
              <dt className="font-semibold">Ramp-up Time:</dt>
              <dd>{packageData.metrics.rampUpTime.toFixed(1)} hours</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="readme-heading" className="mb-8">
          <h2 id="readme-heading" className="text-xl font-semibold mb-4">README</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <pre className="whitespace-pre-wrap" role="document">{packageData.readme}</pre>
          </div>
        </section>

        <section aria-labelledby="repo-heading">
          <h2 id="repo-heading" className="text-xl font-semibold mb-4">GitHub Repository</h2>
          <Link
            href={packageData.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            aria-label={`Visit GitHub repository for ${packageData.name} (opens in new tab)`}
          >
            {packageData.githubUrl}
          </Link>
        </section>
      </main>
    </div>
  );
}
