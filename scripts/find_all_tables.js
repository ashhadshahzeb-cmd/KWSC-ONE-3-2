import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(file));
    else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) results.push(file);
  });
  return results;
}

const files = getFiles('src');
const tables = new Set();
const regex = /\.from\s*\(\s*['"]([^'"]+)['"]/g;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    // strip ' as any' or similar
    const tbl = match[1].replace(/\s+as\s+any/g, '').trim();
    if (!tbl.includes('/') && !tbl.includes(' ')) {
      tables.add(tbl);
    }
  }
});

console.log('Tables queried in src:');
Array.from(tables).sort().forEach(t => console.log(' - ' + t));
