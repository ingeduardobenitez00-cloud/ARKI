const fs = require('fs');
const path = require('path');

const constantsImport = "import { COLLECTION_PADRON } from '@/lib/constants';\n";

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const patternsToRemove = [
    "const COLLECTION_PADRON = 'sheet1';",
    "const COLLECTION_NAME = 'sheet1';",
    "const PADRON_COLLECTION = 'sheet1';",
    "const SHEET_COLLECTION = 'sheet1';",
    'const COLLECTION_PADRON = "sheet1";',
    'const COLLECTION_NAME = "sheet1";',
    'const PADRON_COLLECTION = "sheet1";',
    'const SHEET_COLLECTION = "sheet1";'
];

walkDir(path.join(__dirname, 'src'), function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let originalContent = fs.readFileSync(filePath, 'utf8');
        let content = originalContent;
        let modified = false;

        // Remove declarations
        patternsToRemove.forEach(pattern => {
            if (content.includes(pattern)) {
                content = content.replace(pattern, '');
                modified = true;
            }
        });

        // Replace hardcoded 'sheet1' with COLLECTION_PADRON
        if (content.includes("'sheet1'")) {
            content = content.replace(/'sheet1'/g, 'COLLECTION_PADRON');
            modified = true;
        }
        if (content.includes('"sheet1"')) {
            content = content.replace(/"sheet1"/g, 'COLLECTION_PADRON');
            modified = true;
        }

        // If we removed a declaration, replace its usages
        if (modified) {
            content = content.replace(/\bCOLLECTION_NAME\b/g, 'COLLECTION_PADRON');
            content = content.replace(/\bPADRON_COLLECTION\b/g, 'COLLECTION_PADRON');
            content = content.replace(/\bSHEET_COLLECTION\b/g, 'COLLECTION_PADRON');
            
            if (!content.includes("import { COLLECTION_PADRON } from '@/lib/constants'")) {
                content = constantsImport + content;
            }
            
            fs.writeFileSync(filePath, content);
            console.log('Updated: ' + filePath);
        }
    }
});
