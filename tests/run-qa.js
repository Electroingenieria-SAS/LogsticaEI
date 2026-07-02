const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

execFileSync(process.execPath, [path.join(root, 'tests', 'found-flow.test.js')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'tests', 'sales-registry-panel.test.js')], { stdio: 'inherit' });

console.log('QA GENERAL OK - Hotfix V79: Encontrado/Facturación y Registro de Ventas aprobados.');
