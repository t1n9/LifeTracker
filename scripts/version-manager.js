#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取版本配置
const versionConfig = JSON.parse(fs.readFileSync('version.json', 'utf8'));

// 更新所有 package.json 文件
function updatePackageJsons() {
  const files = [
    'package.json',
    'frontend/package.json',
    'backend/package.json'
  ];

  files.forEach(file => {
    if (fs.existsSync(file)) {
      const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
      packageJson.version = versionConfig.version;
      fs.writeFileSync(file, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`✅ 已更新 ${file} 版本号为 ${versionConfig.version}`);
    }
  });
}

// 生成版本常量文件
function generateVersionConstants() {
  // 前端版本常量
  const frontendVersionFile = `// 自动生成的版本文件，请勿手动修改
export const VERSION_INFO = {
  version: '${versionConfig.version}',
  name: '${versionConfig.name}',
  description: '${versionConfig.description}',
  buildDate: '${versionConfig.buildDate}',
  features: ${JSON.stringify(versionConfig.features, null, 2)}
} as const;

export const getVersionString = () => \`v\${VERSION_INFO.version}\`;
export const getFullVersionInfo = () => \`\${VERSION_INFO.name} v\${VERSION_INFO.version} (\${VERSION_INFO.buildDate})\`;
`;

  fs.writeFileSync('frontend/src/lib/version.ts', frontendVersionFile);
  console.log('✅ 已生成前端版本常量文件');

  // 后端版本常量
  const backendVersionFile = `// 自动生成的版本文件，请勿手动修改
export const VERSION_INFO = {
  version: '${versionConfig.version}',
  name: '${versionConfig.name}',
  description: '${versionConfig.description}',
  buildDate: '${versionConfig.buildDate}',
  features: ${JSON.stringify(versionConfig.features, null, 2)}
} as const;

export const getVersionString = () => \`v\${VERSION_INFO.version}\`;
export const getFullVersionInfo = () => \`\${VERSION_INFO.name} v\${VERSION_INFO.version} (\${VERSION_INFO.buildDate})\`;
`;

  fs.writeFileSync('backend/src/common/version.ts', backendVersionFile);
  console.log('✅ 已生成后端版本常量文件');
}

// 主函数
function main() {
  const command = process.argv[2];

  switch (command) {
    case 'sync':
      console.log('🔄 同步版本号到所有文件...');
      updatePackageJsons();
      generateVersionConstants();
      console.log('✅ 版本同步完成！');
      break;

    case 'info':
      console.log('📋 当前版本信息:');
      console.log(`版本: ${versionConfig.version}`);
      console.log(`名称: ${versionConfig.name}`);
      console.log(`描述: ${versionConfig.description}`);
      console.log(`构建日期: ${versionConfig.buildDate}`);
      break;

    case 'bump':
      const type = process.argv[3] || 'patch';
      bumpVersion(type);
      break;

    default:
      console.log('使用方法:');
      console.log('  node scripts/version-manager.js sync   - 同步版本号');
      console.log('  node scripts/version-manager.js info   - 显示版本信息');
      console.log('  node scripts/version-manager.js bump [major|minor|patch] - 升级版本');
  }
}

// 版本升级
function bumpVersion(type) {
  const [major, minor, patch] = versionConfig.version.split('.').map(Number);

  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  versionConfig.version = newVersion;
  versionConfig.buildDate = new Date().toISOString().split('T')[0];

  fs.writeFileSync('version.json', JSON.stringify(versionConfig, null, 2) + '\n');
  console.log(`✅ 版本已升级为 ${newVersion}`);

  // 自动同步
  updatePackageJsons();
  generateVersionConstants();
}

if (require.main === module) {
  main();
}