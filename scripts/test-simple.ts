#!/usr/bin/env node

/**
 * 🧪 SIMPLE TESTING SCRIPT
 * 
 * Script sederhana untuk testing cepat
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 ZATIARAS POS SIMPLE TESTING');
console.log('================================\n');

// Test file structure
console.log('📁 Testing File Structure...\n');

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'svelte.config.js',
  'tailwind.config.js',
  'eslint.config.js',
  'src/app.html',
  'src/app.css',
  'src/routes/+layout.svelte',
  'src/routes/+page.svelte'
];

const requiredDirs = [
  'src',
  'src/lib',
  'src/routes',
  'src/lib/components',
  'src/lib/stores',
  'src/lib/services',
  'src/lib/utils',
  'src/lib/auth',
  'src/lib/database'
];

let allTestsPassed = true;

// Test required files
console.log('📄 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allTestsPassed = false;
  }
}

console.log('\n📁 Checking required directories...');
for (const dir of requiredDirs) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} - MISSING OR NOT A DIRECTORY`);
    allTestsPassed = false;
  }
}

// Test package.json
console.log('\n📦 Checking package.json...');
try {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageContent = fs.readFileSync(packagePath, 'utf8');
  const packageJson = JSON.parse(packageContent);
  
  const requiredFields = ['name', 'version', 'scripts', 'dependencies', 'devDependencies'];
  for (const field of requiredFields) {
    if (packageJson[field]) {
      console.log(`  ✅ ${field}`);
    } else {
      console.log(`  ❌ ${field} - MISSING`);
      allTestsPassed = false;
    }
  }
} catch (error) {
  console.log(`  ❌ package.json validation failed: ${error.message}`);
  allTestsPassed = false;
}

// Test dependencies
console.log('\n📦 Checking dependencies...');
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const packageLockPath = path.join(process.cwd(), 'pnpm-lock.yaml');

if (fs.existsSync(nodeModulesPath)) {
  console.log('  ✅ node_modules');
} else {
  console.log('  ❌ node_modules - MISSING');
  allTestsPassed = false;
}

if (fs.existsSync(packageLockPath)) {
  console.log('  ✅ pnpm-lock.yaml');
} else {
  console.log('  ❌ pnpm-lock.yaml - MISSING');
  allTestsPassed = false;
}

// Summary
console.log('\n📊 TEST SUMMARY');
console.log('================');
if (allTestsPassed) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
