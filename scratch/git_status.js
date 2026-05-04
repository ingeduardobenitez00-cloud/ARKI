
const { execSync } = require('child_process');
try {
    const output = execSync('git status', { encoding: 'utf-8' });
    console.log(output);
} catch (e) {
    console.error(e.message);
    console.error(e.stderr);
}
