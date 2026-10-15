const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const wwwDir = path.join(__dirname, '..', 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

// Copy all assets from src to www
const files = fs.readdirSync(srcDir);
for (const file of files) {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(wwwDir, file);
  if (fs.statSync(srcFile).isFile()) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`Copied ${file} -> www/`);
  }
}

// Ensure .nojekyll exists for GitHub Pages
fs.writeFileSync(path.join(wwwDir, '.nojekyll'), '');
console.log('Created www/.nojekyll');
console.log('Build complete! Assets ready in www/');
