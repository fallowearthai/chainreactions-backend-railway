#!/usr/bin/env node

/**
 * 修复共享模块导入路径 - 正确版本
 *
 * Docker构建后的目录结构：
 * /app/
 *   ├── src/
 *   │   ├── app.ts
 *   │   ├── controllers/
 *   │   └── shared/         <-- 共享模块在这里
 *   │       └── utils/
 *   │           └── Logger.ts
 *
 * 所以从 app.ts 导入 Logger 应该是: ./shared/utils/Logger
 */

const fs = require('fs');
const path = require('path');

const services = [
  'entity-relations',
  'entity-search',
  'dataset-matching',
  'data-management',
  'dataset-search',
  'user-management'
];

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Pattern: ../../../src/shared/... 或 ./src/shared/...
  // Replace with: ./shared/...
  const oldContent = content;

  // Fix import statements
  content = content.replace(
    /from\s+['"](\.\.\/\.\.\/\.\.\/src\/shared\/[^'"]+)['"]/g,
    (match, importPath) => {
      const afterShared = importPath.replace('../../../src/shared/', '');
      return `from './shared/${afterShared}'`;
    }
  );

  // Fix already broken imports (./src/shared/...)
  content = content.replace(
    /from\s+['"](\.\/src\/shared\/[^'"]+)['"]/g,
    (match, importPath) => {
      const afterShared = importPath.replace('./src/shared/', '');
      return `from './shared/${afterShared}'`;
    }
  );

  if (content !== oldContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Main execution
console.log('=== 修复共享模块导入路径 (v2) ===\n');

let totalFixed = 0;

for (const service of services) {
  const servicePath = path.join(__dirname, '..', 'services', service, 'src');

  if (!fs.existsSync(servicePath)) {
    console.log(`⚠️  跳过不存在的服务: ${service}`);
    continue;
  }

  console.log(`📦 处理服务: ${service}`);

  let count = 0;

  const processDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== 'dist') {
          processDir(fullPath);
        }
      } else if (file.endsWith('.ts')) {
        if (fixImportsInFile(fullPath)) {
          count++;
        }
      }
    }
  };

  processDir(servicePath);

  if (count > 0) {
    console.log(`   修复了 ${count} 个文件`);
  }
  console.log('');
}

console.log(`=== 完成: 总共修复了 ${totalFixed} 个文件 ===`);
