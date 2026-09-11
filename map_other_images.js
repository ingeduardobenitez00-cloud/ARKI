const fs = require('fs');
const path = require('path');

const srcDir = path.join('C:\\ARKI', 'fotos_tsje');
const destDir = path.join('C:\\ARKI', 'public', 'candidates', 'generales');

const mappings = [];

// Lista 2 (6.28 to 6.51)
for (let i = 1; i <= 24; i++) { mappings.push({ src: `6.${i + 27}.webp`, dest: `concejal-2-opt-${i}.webp` }); }

// Lista 4 (7.52 to 7.75)
for (let i = 1; i <= 24; i++) { mappings.push({ src: `7.${i + 51}.webp`, dest: `concejal-4-opt-${i}.webp` }); }

// Lista 8 (8.76 to 8.99)
for (let i = 1; i <= 24; i++) { mappings.push({ src: `8.${i + 75}.webp`, dest: `concejal-8-opt-${i}.webp` }); }

// Lista 9 (9.100 to 9.123)
for (let i = 1; i <= 24; i++) { mappings.push({ src: `9.${i + 99}.webp`, dest: `concejal-9-opt-${i}.webp` }); }

// Lista 42 (10.124 to 10.147)
for (let i = 1; i <= 24; i++) { mappings.push({ src: `10.${i + 123}.webp`, dest: `concejal-42-opt-${i}.webp` }); }

let successCount = 0;
for (const map of mappings) {
    const srcPath = path.join(srcDir, map.src);
    const destPath = path.join(destDir, map.dest);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        successCount++;
    }
}
console.log(`Successfully mapped ${successCount} additional photos.`);
