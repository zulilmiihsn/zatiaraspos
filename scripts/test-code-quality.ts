#!/usr/bin/env node

/**
 * 🧪 CODE QUALITY TESTING SCRIPT
 * 
 * Script ini bisa dijalankan dari command line untuk testing code quality
 * 
 * Usage:
 * - pnpm test:quality          # Test semua code quality
 * - pnpm test:quality typescript # Test TypeScript saja
 * - pnpm test:quality linting  # Test linting saja
 */

import { CodeQualityTestRunner, runFullCodeQualityTestSuite, quickCodeQualityTest } from '../src/tests/code-quality-tests';
import fs from 'fs';
import path from 'path';

// ============================================================================
// 🚀 MAIN TEST EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('🧪 ZATIARAS POS CODE QUALITY TESTING');
  console.log('=====================================\n');
  
  try {
    if (!command || command === 'all') {
      // Test semua code quality
      console.log('🚀 Running all code quality tests...\n');
      const report = await runFullCodeQualityTestSuite();
      
      // Save report to file
      const reportPath = path.join(process.cwd(), 'code-quality-report.md');
      fs.writeFileSync(reportPath, report);
      
      console.log(`\n📄 Code quality report saved to: ${reportPath}`);
      
    } else if (command === 'typescript') {
      // Test TypeScript saja
      console.log('🔍 Testing TypeScript Compilation...\n');
      const results = await quickCodeQualityTest('TypeScript');
      displayQuickTestResults('TypeScript', results);
      
    } else if (command === 'linting') {
      // Test linting saja
      console.log('🔍 Testing Code Linting...\n');
      const results = await quickCodeQualityTest('Code Linting');
      displayQuickTestResults('Code Linting', results);
      
    } else if (command === 'structure') {
      // Test file structure saja
      console.log('📁 Testing File Structure...\n');
      const results = await quickCodeQualityTest('File Structure');
      displayQuickTestResults('File Structure', results);
      
    } else if (command === 'dependencies') {
      // Test dependencies saja
      console.log('📦 Testing Dependencies...\n');
      const results = await quickCodeQualityTest('Dependencies');
      displayQuickTestResults('Dependencies', results);
      
    } else if (command === 'help') {
      // Show help
      showHelp();
      
    } else {
      console.log(`❌ Unknown command: ${command}`);
      showHelp();
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// 🎯 HELPER FUNCTIONS
// ============================================================================

function displayQuickTestResults(categoryName: string, results: any[]) {
  console.log(`📋 ${categoryName} Test Results:\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.name}: ${result.message}`);
    
    if (result.success) {
      passed++;
    } else {
      failed++;
      if (result.details) {
        console.log(`     Details: ${result.details}`);
      }
    }
  }
  
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
📖 USAGE:

  pnpm test:quality [command]

📋 COMMANDS:

  all          - Test semua code quality (default)
  typescript   - Test TypeScript compilation saja
  linting      - Test code linting saja
  structure    - Test file structure saja
  dependencies - Test dependencies saja
  help         - Tampilkan bantuan ini

🎯 EXAMPLES:

  pnpm test:quality              # Test semua code quality
  pnpm test:quality typescript   # Test TypeScript saja
  pnpm test:quality linting      # Test linting saja

📄 OUTPUT:

  - Console output dengan hasil test
  - Code quality report disimpan ke code-quality-report.md (untuk test all)
  - Exit code 0 jika semua test passed, 1 jika ada yang failed
`);
}

// ============================================================================
// 🚀 SCRIPT EXECUTION
// ============================================================================

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  });
}
