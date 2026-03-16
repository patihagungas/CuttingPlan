const fs = require('fs');
const path = require('path');

const rendererRoot = path.resolve('src/renderer');

function getRelativePath(fromFile, toAlias) {
  const toAbs = path.join(rendererRoot, toAlias);
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toAbs);
  // normalize backslashes on Windows
  rel = rel.split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const changed_parts = [];

  // Match: from '@/...'
  const result = content.replace(/from '(@\/[^']+)'/g, (match, p1) => {
    const alias = p1.slice(2); // remove '@/'
    const rel = getRelativePath(filePath, alias);
    changed_parts.push(p1 + ' -> ' + rel);
    return "from '" + rel + "'";
  });

  if (result !== content) {
    fs.writeFileSync(filePath, result);
    const short = filePath.replace(rendererRoot + path.sep, '').split(path.sep).join('/');
    console.log('Fixed ' + short + ': ' + changed_parts.join(', '));
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkDir(full);
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) processFile(full);
  }
}

walkDir(rendererRoot);
console.log('Done!');
