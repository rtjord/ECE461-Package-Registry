import { APIGatewayProxyResult } from "aws-lambda";

// Function to create a consistent error response
export const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    };
};

// Validate environment variables
export function getEnvVariable(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is not defined`);
    }
    return value;
}

import * as esbuild from 'esbuild';
import * as JSZip from 'jszip'; // For unzipping
import * as Yazl from 'yazl';

export async function debloatPackage(zipBuffer: Buffer): Promise<Buffer> {
  // Step 1: Extract the zip contents using JSZip
  const jsZip = await JSZip.loadAsync(zipBuffer);
  const tempFiles: { [path: string]: string } = {};

  // Read files into memory
  for (const fileName of Object.keys(jsZip.files)) {
    const file = jsZip.files[fileName];
    if (!file.dir) {
      tempFiles[fileName] = await file.async('string');
    }
  }

  // Step 2: Optimize files (tree shake and minify)
  const optimizedFiles: { [path: string]: string } = {};
  for (const [path, content] of Object.entries(tempFiles)) {
    if (path.endsWith('.js') || path.endsWith('.ts')) {
      try {
        const result = await esbuild.transform(content, {
          loader: path.endsWith('.ts') ? 'ts' : 'js',
          minify: true,
          treeShaking: true,
          target: 'es2017',
        });
        optimizedFiles[path] = result.code;
      } catch (error) {
        console.error(`Failed to optimize ${path}:`, error);
        optimizedFiles[path] = content; // Preserve original if optimization fails
      }
    } else {
      optimizedFiles[path] = content; // Copy non-JS files as-is
    }
  }

  // Step 3: Create a new zip with Yazl
  const yazlZip = new Yazl.ZipFile();
  for (const [path, content] of Object.entries(optimizedFiles)) {
    yazlZip.addBuffer(Buffer.from(content, 'utf-8'), path);
  }

  // Finalize the zip and return a Buffer
  yazlZip.end();
  return await zipToBuffer(yazlZip);
}

// Utility function to convert Yazl zip output to a Buffer
function zipToBuffer(zipFile: Yazl.ZipFile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    zipFile.outputStream.on('data', (chunk) => buffers.push(chunk));
    zipFile.outputStream.on('end', () => resolve(Buffer.concat(buffers)));
    zipFile.outputStream.on('error', (error) => reject(error));
  });
}