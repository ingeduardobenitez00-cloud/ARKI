const fs = require('fs');
const path = require('path');

const srcDir = path.join('C:\\ARKI', 'fotos_tsje');
const destDir = path.join('C:\\ARKI', 'public', 'candidates', 'generales');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const mappings = [
    { src: '1.0.webp', dest: 'intendente-1.webp' },
    { src: '2.1.webp', dest: 'intendente-4.webp' },
    { src: '3.2.webp', dest: 'intendente-6.webp' },
    { src: '4.3.webp', dest: 'intendente-300.webp' }
];

for (let i = 1; i <= 24; i++) {
    mappings.push({
        src: `5.${i + 3}.webp`,
        dest: `concejal-1-opt-${i}.webp`
    });
}

let successCount = 0;
for (const map of mappings) {
    const srcPath = path.join(srcDir, map.src);
    const destPath = path.join(destDir, map.dest);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${map.src} to ${map.dest}`);
        successCount++;
    } else {
        console.log(`Warning: ${map.src} not found in ${srcDir}`);
    }
}
console.log(`Successfully mapped ${successCount} files.`);
