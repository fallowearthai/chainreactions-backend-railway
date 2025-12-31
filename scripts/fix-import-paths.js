#!/usr/bin/env node

/**
 * 修复共享模块导入路径
 *
 * 问题：服务使用 ../../../src/shared/... 导入路径，但在Docker构建中
 * 共享模块被复制到 ./src/shared/，导致路径不匹配
 *
 * 解决：将所有 ../../../src/shared/... 导入改为 ./src/shared/...
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

function fixImportsInDirectory(dir, recursive = true) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && recursive) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist') {
        fixImportsInDirectory(fullPath, recursive);
      }
    } else if (file.endsWith('.ts')) {
      fixImportsInFile(fullPath);
    }
  }
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern: ../../../src/shared/
  // Replace with: ./src/shared/ or ../src/shared/ depending on context
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    // Match import statements with ../../../src/shared/
    const match = line.match(/import.*from\s+['"](\.\.\/\.\.\/\.\.\/src\/shared\/[^'"]+)['"]/);
    if (match) {
      const oldPath = match[1];
      // Extract the path after src/shared/
      const afterShared = oldPath.replace('../../../src/shared/', '');

      // Use relative path from current file location
      // Since we're in services/[service]/src/**/*.ts
      // and shared is at services/[service]/src/shared/
      // we can use ./src/shared/ or ../src/shared/ depending on depth
      const newPath = `./src/shared/${afterShared}`;

      modified = true;
      return line.replace(oldPath, newPath);
    }
    return line;
  });

  if (modified) {
    fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Main execution
console.log('=== 修复共享模块导入路径 ===\n');

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

  console.log(`   修复了 ${count} 个文件\n`);
  totalFixed += count;
}

console.log(`=== 完成: 总共修复了 ${totalFixed} 个文件 ===`);

if (totalFixed > 0) {
  console.log('\n⚠️  请验证修复是否正确:');
  console.log('   1. 运行 npm run type-check 检查类型错误');
  console.log('   2. 运行 npm run build 验证编译');
}
