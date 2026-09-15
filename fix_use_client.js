const fs = require('fs');
const path = require('path');

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

walkDir(path.join(__dirname, 'src'), function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let lines = content.split('\n');
        
        let useClientIndex = -1;
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            if (lines[i].includes('"use client"') || lines[i].includes("'use client'")) {
                useClientIndex = i;
                break;
            }
        }

        if (useClientIndex > 0) {
            // Remove the use client line
            const useClientLine = lines.splice(useClientIndex, 1)[0];
            // Insert it at the very top
            lines.unshift(useClientLine);
            
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log('Fixed use client in: ' + filePath);
        }
    }
});
