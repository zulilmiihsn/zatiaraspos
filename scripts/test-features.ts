#!/usr/bin/env node

/**
 * 🧪 FEATURE TESTING SCRIPT
 * 
 * Script ini bisa dijalankan dari command line untuk testing fitur-fitur
 * 
 * Usage:
 * - pnpm test:features          # Test semua fitur
 * - pnpm test:features dashboard # Test fitur dashboard saja
 * - pnpm test:features pos      # Test fitur POS saja
 */

import { FeatureTestRunner, runFullTestSuite, quickTest } from '../src/tests/feature-tests';
import fs from 'fs';
import path from 'path';

// ============================================================================
// 🚀 MAIN TEST EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('🧪 ZATIARAS POS FEATURE TESTING');
  console.log('================================\n');
  
  try {
    if (!command || command === 'all') {
      // Test semua fitur
      console.log('🚀 Running all feature tests...\n');
      const report = await runFullTestSuite();
      
      // Save report to file
      const reportPath = path.join(process.cwd(), 'test-report.md');
      fs.writeFileSync(reportPath, report);
      
      console.log(`\n📄 Test report saved to: ${reportPath}`);
      
    } else if (command === 'dashboard') {
      // Test dashboard saja
      console.log('🏠 Testing Dashboard Features...\n');
      const results = await quickTest('Dashboard');
      displayQuickTestResults('Dashboard', results);
      
    } else if (command === 'pos') {
      // Test POS saja
      console.log('💰 Testing POS Features...\n');
      const results = await quickTest('POS');
      displayQuickTestResults('POS', results);
      
    } else if (command === 'reporting') {
      // Test reporting saja
      console.log('📊 Testing Reporting Features...\n');
      const results = await quickTest('Reporting');
      displayQuickTestResults('Reporting', results);
      
    } else if (command === 'recording') {
      // Test recording saja
      console.log('📝 Testing Recording Features...\n');
      const results = await quickTest('Recording');
      displayQuickTestResults('Recording', results);
      
    } else if (command === 'settings') {
      // Test settings saja
      console.log('⚙️ Testing Settings Features...\n');
      const results = await quickTest('Settings');
      displayQuickTestResults('Settings', results);
      
    } else if (command === 'auth') {
      // Test auth saja
      console.log('🔐 Testing Authentication Features...\n');
      const results = await quickTest('Authentication');
      displayQuickTestResults('Authentication', results);
      
    } else if (command === 'data') {
      // Test data management saja
      console.log('🗄️ Testing Data Management Features...\n');
      const results = await quickTest('Data Management');
      displayQuickTestResults('Data Management', results);
      
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

function displayQuickTestResults(featureName: string, results: any[]) {
  console.log(`📋 ${featureName} Test Results:\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.name}: ${result.message}`);
    
    if (result.success) {
      passed++;
    } else {
      failed++;
      if (result.error) {
        console.log(`     Error: ${result.error}`);
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

  pnpm test:features [command]

📋 COMMANDS:

  all        - Test semua fitur (default)
  dashboard  - Test fitur Dashboard saja
  pos        - Test fitur POS saja
  reporting  - Test fitur Reporting saja
  recording  - Test fitur Recording saja
  settings   - Test fitur Settings saja
  auth       - Test fitur Authentication saja
  data       - Test fitur Data Management saja
  help       - Tampilkan bantuan ini

🎯 EXAMPLES:

  pnpm test:features          # Test semua fitur
  pnpm test:features pos      # Test fitur POS saja
  pnpm test:features auth     # Test fitur Authentication saja

📄 OUTPUT:

  - Console output dengan hasil test
  - Test report disimpan ke test-report.md (untuk test all)
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
