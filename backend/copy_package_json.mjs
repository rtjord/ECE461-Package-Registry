import * as fs from 'fs';
import * as path from 'path';

function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} to ${dest}`);
}

// For each handler subdirectory in src/handlers, copy the package.json file to dist/handlers
const handlersDir = 'src/handlers';
const destBaseDir = 'dist/handlers';

for (const handler of fs.readdirSync(handlersDir)) {
    const src = path.join(handlersDir, handler, 'package.json');
    const dest = path.join(destBaseDir, handler, 'package.json');
    
    if (fs.existsSync(src)) {   
        copyFile(src, dest);
    }
}
