const fs = require('fs');
const path = require('path');

function prependTsNocheck(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      prependTsNocheck(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(fullPath, '// @ts-nocheck\n' + content, 'utf8');
      }
    }
  }
}

prependTsNocheck(path.join(__dirname, '../../frontend/src/api/client'));
