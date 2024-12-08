'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface PackageData {
  metadata: {
    Name: string;
    Version: string;
    ID: string;
  };
  data: {
    Name: string;
    Content: string;  // base64
    URL?: string;
    JSProgram: string;
  };
}

interface PackageDetailProps {
  params: {
    id: string;
  };
}

interface PackageRating {
  BusFactor: number;
  Correctness: number;
  RampUp: number;
  ResponsiveMaintainer: number;
  LicenseScore: number;
  GoodPinningPractice: number;
  PullRequest: number;
  NetScore: number;
}

interface PackageCost {
  [key: string]: {
    standaloneCost?: number;
    totalCost: number;
  };
}

interface PackageUpdateRequest {
  metadata: {
    Name: string;
    Version: string;
    ID: string;
  };
  data: {
    Content?: string;
    URL?: string;
    JSProgram: string;
  };
}

interface UpdateModalState {
  isOpen: boolean;
  method: 'url' | 'file' | null;
  version: string;
  url: string;
  file: File | null;
  error: string | null;
}

export default function PackageDetail({ params }: PackageDetailProps) {
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<PackageRating | null>(null);
  const [cost, setCost] = useState<PackageCost | null>(null);
  const [updateModal, setUpdateModal] = useState<UpdateModalState>({
    isOpen: false,
    method: null,
    version: '',
    url: '',
    file: null,
    error: null
  });

  useEffect(() => {
    const fetchPackageData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`/api/package-proxy/${params.id}`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch package: ${response.statusText}`);
        }

        const data = await response.json();
        setPackageData(data);
      } catch (error) {
        console.error('Fetch error:', error);
        setError(error instanceof Error ? error.message : 'Failed to load package data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackageData();
  }, [params.id]);

  const handleUpdate = async () => {
    setUpdateModal(prev => ({ ...prev, isOpen: true }));
  };

  const handleUpdateSubmit = async () => {
    try {
      if (!packageData?.metadata.ID) {
        throw new Error('Package ID not found');
      }

      // Validate version format
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(updateModal.version)) {
        setUpdateModal(prev => ({ 
          ...prev, 
          error: 'Invalid version format. Please use semantic versioning (e.g., 1.2.3)' 
        }));
        return;
      }

      const updateRequest: PackageUpdateRequest = {
        metadata: {
          Name: packageData.metadata.Name,
          Version: updateModal.version,
          ID: packageData.metadata.ID
        },
        data: {
          JSProgram: packageData.data.JSProgram
        }
      };

      if (updateModal.method === 'url') {
        if (!updateModal.url) {
          setUpdateModal(prev => ({ ...prev, error: 'URL is required' }));
          return;
        }
        updateRequest.data.URL = updateModal.url;
      } else if (updateModal.method === 'file' && updateModal.file) {
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result?.toString().split(',')[1];
            resolve(base64 || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(updateModal.file!);
        });
        updateRequest.data.Content = fileContent;
      } else {
        setUpdateModal(prev => ({ ...prev, error: 'Please select a file or provide a URL' }));
        return;
      }

      const response = await fetch(`/api/package-proxy/${packageData.metadata.ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateRequest)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update package');
      }

      const updatedData = await response.json();
      setPackageData(updatedData);
      setError(null);
      setUpdateModal(prev => ({ ...prev, isOpen: false }));
      alert('Package updated successfully!');
    } catch (error) {
      console.error('Update error:', error);
      setUpdateModal(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to update package'
      }));
    }
  };

  const handleDownload = async () => {
    try {
      if (!packageData?.metadata.ID) {
        throw new Error('Package ID not found');
      }

      const response = await fetch(`/api/package-proxy/${packageData.metadata.ID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download package: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Create and trigger download of the package content
      const blob = new Blob([Buffer.from(data.data.Content, 'base64')], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${packageData.metadata.Name}-${packageData.metadata.Version}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setError(null);
    } catch (error) {
      console.error('Download error:', error);
      setError(error instanceof Error ? error.message : 'Failed to download package');
    }
  };

  const handleCheckRate = async () => {
    try {
      if (!packageData?.metadata.ID) {
        throw new Error('Package ID not found');
      }

      const response = await fetch(`/api/package-proxy/${packageData.metadata.ID}/rate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch rating: ${response.statusText}`);
      }

      const ratingData = await response.json();
      setRating(ratingData);
      setError(null);
    } catch (error) {
      console.error('Rating check error:', error);
      setError(error instanceof Error ? error.message : 'Failed to check package rating');
    }
  };

  const handleCheckCost = async () => {
    try {
      if (!packageData?.metadata.ID) {
        throw new Error('Package ID not found');
      }

      const response = await fetch(`/api/package-proxy/${packageData.metadata.ID}/cost`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cost: ${response.statusText}`);
      }

      const costData = await response.json();
      setCost(costData);
      setError(null);
    } catch (error) {
      console.error('Cost check error:', error);
      setError(error instanceof Error ? error.message : 'Failed to check package cost');
    }
  };

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
          <li aria-current="page">{packageData.metadata.Name}</li>
        </ol>
      </nav>

      <main>
        <h1 className="text-3xl font-bold mb-6" tabIndex={0}>
          {packageData.metadata.Name} <span className="text-gray-500 text-xl">v{packageData.metadata.Version}</span>
        </h1>
        
        {/* Package Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8" role="toolbar" aria-label="Package actions">
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={handleUpdate}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              aria-label="Update package version"
            >
              Update Package
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
              aria-label="Download package"
            >
              Download Package
            </button>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={handleCheckRate}
              className="flex-1 sm:flex-none px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
              aria-label="Check package rating metrics"
            >
              Check Rating
            </button>
            <button
              onClick={handleCheckCost}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              aria-label="Check package cost information"
            >
              Check Cost
            </button>
          </div>
        </div>

        {/* Package Information */}
        <section aria-labelledby="package-info" className="bg-gray-100 p-6 rounded-lg mb-8">
          <h2 id="package-info" className="text-xl font-semibold mb-4">Package Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="font-semibold">Package ID:</dt>
              <dd>{packageData.metadata.ID}</dd>
            </div>
            <div>
              <dt className="font-semibold">Version:</dt>
              <dd>{packageData.metadata.Version}</dd>
            </div>
            {packageData.data.URL && (
              <div className="col-span-2">
                <dt className="font-semibold">Repository URL:</dt>
                <dd>
                  <a 
                    href={packageData.data.URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {packageData.data.URL}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* Rating Information - Only show if rating exists */}
        {rating && (
          <section 
            aria-labelledby="rating-info" 
            className="bg-gray-100 p-6 rounded-lg mb-8"
          >
            <h2 id="rating-info" className="text-xl font-semibold mb-4">Package Rating</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <dt className="font-semibold">Net Score:</dt>
                <dd aria-label={`Net Score: ${rating.NetScore.toFixed(2)}`}>
                  {rating.NetScore.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Bus Factor:</dt>
                <dd aria-label={`Bus Factor: ${rating.BusFactor.toFixed(2)}`}>
                  {rating.BusFactor.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Correctness:</dt>
                <dd aria-label={`Correctness: ${rating.Correctness.toFixed(2)}`}>
                  {rating.Correctness.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Ramp Up:</dt>
                <dd aria-label={`Ramp Up: ${rating.RampUp.toFixed(2)}`}>
                  {rating.RampUp.toFixed(2)}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* Cost Information - Only show if cost exists */}
        {cost && (
          <section 
            aria-labelledby="cost-info" 
            className="bg-gray-100 p-6 rounded-lg mb-8"
          >
            <h2 id="cost-info" className="text-xl font-semibold mb-4">Package Cost</h2>
            <dl className="grid grid-cols-2 gap-4">
              {Object.entries(cost).map(([id, costs]) => (
                <div key={id} className="col-span-2">
                  <dt className="font-semibold">Package ID: {id}</dt>
                  <dd className="ml-4">
                    {costs.standaloneCost && (
                      <div aria-label={`Standalone Cost: ${costs.standaloneCost} MB`}>
                        Standalone Cost: {costs.standaloneCost} MB
                      </div>
                    )}
                    <div aria-label={`Total Cost: ${costs.totalCost} MB`}>
                      Total Cost: {costs.totalCost} MB
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Update Modal */}
        {updateModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full" role="dialog" aria-labelledby="update-modal-title">
              <h2 id="update-modal-title" className="text-xl font-semibold mb-4">Update Package</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={updateModal.version}
                    onChange={(e) => setUpdateModal(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1.0.0"
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Update Method
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setUpdateModal(prev => ({ ...prev, method: 'url', file: null }))}
                      className={`flex-1 p-2 rounded ${
                        updateModal.method === 'url' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      GitHub URL
                    </button>
                    <button
                      onClick={() => setUpdateModal(prev => ({ ...prev, method: 'file', url: '' }))}
                      className={`flex-1 p-2 rounded ${
                        updateModal.method === 'file' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {updateModal.method === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GitHub URL
                    </label>
                    <input
                      type="url"
                      value={updateModal.url}
                      onChange={(e) => setUpdateModal(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://github.com/user/repo"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                )}

                {updateModal.method === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload ZIP File
                    </label>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setUpdateModal(prev => ({ 
                        ...prev, 
                        file: e.target.files?.[0] || null 
                      }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                )}

                {updateModal.error && (
                  <p className="text-red-500 text-sm" role="alert">
                    {updateModal.error}
                  </p>
                )}

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleUpdateSubmit}
                    className="flex-1 bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => setUpdateModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 