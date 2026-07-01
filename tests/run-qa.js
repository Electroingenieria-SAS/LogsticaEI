const { spawnSync } = require('child_process');
const path = require('path');

const testFile = path.join(__dirname, 'found-flow.test.js');
const result = spawnSync(process.execPath, [testFile], { stdio: 'inherit' });
process.exit(result.status || 0);
