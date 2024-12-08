"use client";

import { useState } from 'react';

type UploadMethod = 'url' | 'file';

// Define interfaces for the request body types
interface BasePackageData {
  JSProgram: string;
}

interface URLPackageData extends BasePackageData {
  URL: string;
  Name: string;
}

interface ContentPackageData extends BasePackageData {
  Content: string;
  Name: string;
  debloat: boolean;
}

type PackageData = URLPackageData | ContentPackageData;

// Default values for JSProgram and other required fields
const DEFAULT_JS_PROGRAM = `if (process.argv.length === 7) {
  console.log('Success')
  process.exit(0)
} else {
  console.log('Failed')
  process.exit(1)
}`;

//  const DEFAULT_AUTH_TOKEN = "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export default function UploadFile() {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadStatus('');

    try {
      const form = event.target as HTMLFormElement;
      
      const baseRequestBody: BasePackageData = {
        JSProgram: DEFAULT_JS_PROGRAM,
      };

      let packageData: PackageData;

      // Handle URL-based upload
      if (uploadMethod === 'url') {
        console.log('Uploading via URL:', githubUrl);
        if (!githubUrl) {
          setUploadStatus('Please enter a GitHub URL');
          return;
        }
        packageData = {
          ...baseRequestBody,
          URL: githubUrl,
          Name: (form.elements.namedItem('packageName') as HTMLInputElement).value
        };
      } 
      // Handle file-based upload
      else {
        console.log('Uploading file:', selectedFile?.name);
        if (!selectedFile) {
          setUploadStatus('Please select a file');
          return;
        }

        // Convert zip file to base64
        const base64data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            resolve(base64 || '');
          };
          reader.readAsDataURL(selectedFile);
        });

        packageData = {
          ...baseRequestBody,
          Content: base64data,
          Name: (form.elements.namedItem('packageName') as HTMLInputElement).value,
          debloat: false
        };
      }

      console.log('Request payload:', packageData);

      console.log('Request Body:', JSON.stringify(packageData));
      const response = await fetch('/api/package-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packageData)
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        setUploadStatus(`Package uploaded successfully! Package ID: ${data.metadata.ID}`);
      } else {
        const error = await response.json();
        setUploadStatus(`Failed to upload package: ${error.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Detailed error:', error);
      setUploadStatus('Error uploading package.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Package Upload</h1>

      {/* Upload Method Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '20px' }}>
          <input
            type="radio"
            value="url"
            checked={uploadMethod === 'url'}
            onChange={(e) => setUploadMethod(e.target.value as UploadMethod)}
          /> GitHub URL
        </label>
        <label>
          <input
            type="radio"
            value="file"
            checked={uploadMethod === 'file'}
            onChange={(e) => setUploadMethod(e.target.value as UploadMethod)}
          /> ZIP File
        </label>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {/* URL Input */}
        {uploadMethod === 'url' && (
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              name="packageName"
              placeholder="Package Name"
              style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              required
            />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="Enter GitHub URL"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        )}

        {/* File Upload Input */}
        {uploadMethod === 'file' && (
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              name="packageName"
              placeholder="Package Name"
              style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
              required
            />
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              style={{ width: '100%' }}
            />
          </div>
        )}

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Upload Package
        </button>
      </form>

      {uploadStatus && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', width: '100%' }}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
}

