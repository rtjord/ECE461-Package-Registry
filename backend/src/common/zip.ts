import * as esbuild from 'esbuild';
import JSZip from "jszip";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import yazl from 'yazl';

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
    const yazlZip = new yazl.ZipFile();
    for (const [path, content] of Object.entries(optimizedFiles)) {
      yazlZip.addBuffer(Buffer.from(content, 'utf-8'), path);
    }
  
    // Finalize the zip and return a Buffer
    yazlZip.end();
    return await zipToBuffer(yazlZip);
  }
  
  // Clone GitHub repository and compress it to a zip file
  export async function cloneAndZipRepository(repoUrl: string, version?: string | null): Promise<Buffer> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'repo-'));
    const repoPath = path.join(tempDir, 'repo');
  
    try {
        // Clone the GitHub repository using isomorphic-git
        await git.clone({
            fs,
            http,
            dir: repoPath,
            url: repoUrl,
            singleBranch: true,
            depth: 1,
            ...(version && { ref: version }), // Checkout a specific version if provided
        });
  
        // Create a zip archive of the cloned repository
        return await zipDirectory(repoPath);
    } finally {
        // Clean up temporary files
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  }
  
  // Zip a directory and return a buffer of the zip file using yazl
  async function zipDirectory(directoryPath: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const zipFile = new yazl.ZipFile();
        const filePaths = fs.readdirSync(directoryPath);
  
        for (const filePath of filePaths) {
            const fullPath = path.join(directoryPath, filePath);
            const stat = fs.statSync(fullPath);
  
            if (stat.isFile()) {
                zipFile.addFile(fullPath, filePath);
            } else if (stat.isDirectory()) {
                zipFile.addEmptyDirectory(filePath);
            }
        }
  
        const chunks: Buffer[] = [];
        zipFile.outputStream.on('data', (chunk) => chunks.push(chunk));
        zipFile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
        zipFile.outputStream.on('error', (err) => reject(err));
  
        zipFile.end();
    });
  }
  
  // Utility function to convert Yazl zip output to a Buffer
  function zipToBuffer(zipFile: yazl.ZipFile): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const buffers: Buffer[] = [];
      zipFile.outputStream.on('data', (chunk) => buffers.push(chunk));
      zipFile.outputStream.on('end', () => resolve(Buffer.concat(buffers)));
      zipFile.outputStream.on('error', (error) => reject(error));
    });
  }
  
  // Extract package.json from a zip file
  export async function extractPackageJsonFromZip(zipBuffer: Buffer): Promise<string | null> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const packageJsonFile = zip.file(/package\.json$/i)[0];
  
    return packageJsonFile ? await packageJsonFile.async('string') : null;
  }
  
  // Extract readme from a zip file
  export async function extractReadmeFromZip(zipBuffer: Buffer): Promise<string | null> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const packageJsonFile = zip.file(/readme\.md$/i)[0];
  
    return packageJsonFile ? await packageJsonFile.async('string') : null;
  }