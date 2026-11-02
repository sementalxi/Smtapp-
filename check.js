const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
for (const file of files) {
  const full = path.join(dir, file);
  execFileSync(process.execPath, ['--check', full], { stdio: 'inherit' });
}
console.log(`Checked ${files.length} JavaScript files successfully.`);
