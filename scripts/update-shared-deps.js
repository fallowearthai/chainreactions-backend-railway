#!/usr/bin/env node

/**
 * 为所有服务添加共享模块所需的依赖
 * 共享模块 (src/shared/) 使用了这些依赖，必须添加到每个服务的 package.json
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

// 共享依赖
const sharedDependencies = {
  'ioredis': '^5.3.2',
  'pg': '^8.11.3',
  'axios': '^1.6.2',
  'compression': '^1.7.4'
};

// 共享依赖的类型定义
const sharedDevDependencies = {
  '@types/ioredis': '^5.0.0',
  '@types/pg': '^8.10.9',
  '@types/compression': '^1.7.5'
};

function updatePackageJson(servicePath) {
  const packageJsonPath = path.join(servicePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  跳过: ${servicePath} (package.json 不存在)`);
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let updated = false;

  // 添加生产依赖
  if (!pkg.dependencies) pkg.dependencies = {};
  for (const [name, version] of Object.entries(sharedDependencies)) {
    if (!pkg.dependencies[name]) {
      pkg.dependencies[name] = version;
      console.log(`  ➕ ${name}@${version}`);
      updated = true;
    }
  }

  // 添加开发依赖
  if (!pkg.devDependencies) pkg.devDependencies = {};
  for (const [name, version] of Object.entries(sharedDevDependencies)) {
    if (!pkg.devDependencies[name]) {
      pkg.devDependencies[name] = version;
      console.log(`  ➕ ${name}@${version} (dev)`);
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    return true;
  }

  return false;
}

// 主流程
console.log('=== 为所有服务添加共享依赖 ===\n');

let updatedCount = 0;

for (const service of services) {
  const servicePath = path.join(__dirname, '..', 'services', service);

  if (!fs.existsSync(servicePath)) {
    console.log(`⚠️  跳过不存在的服务: ${service}\n`);
    continue;
  }

  console.log(`📦 ${service}:`);

  const updated = updatePackageJson(servicePath);

  if (updated) {
    console.log(`  ✅ 已更新\n`);
    updatedCount++;
  } else {
    console.log(`  ℹ️  无需更新\n`);
  }
}

console.log(`=== 完成: ${updatedCount} 个服务的依赖已更新 ===`);

if (updatedCount > 0) {
  console.log('\n⚠️  重要提示:');
  console.log('  1. 请运行 `npm install` 在每个更新的服务目录中');
  console.log('  2. 或者在部署时 Docker 会自动安装依赖');
  console.log('  3. 如果遇到 TypeScript 错误，可能还需要修复其他问题');
}
