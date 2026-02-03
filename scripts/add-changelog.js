#!/usr/bin/env node

/**
 * Changelog Entry Helper
 * 
 * Usage:
 *   node scripts/add-changelog.js
 * 
 * This script helps you add new changelog entries interactively.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CHANGELOG_PATH = path.join(__dirname, '../public/CHANGELOG.json');
const APP_TSX_PATH = path.join(__dirname, '../src/client/App.tsx');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

const CHANGE_TYPES = {
  '1': 'feature',
  '2': 'improvement',
  '3': 'bugfix',
  '4': 'breaking'
};

async function main() {
  console.log('\n📝 Changelog Entry Helper\n');

  // Read existing changelog
  let changelog = [];
  try {
    const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    changelog = JSON.parse(content);
  } catch (error) {
    console.error('Error reading changelog:', error.message);
    process.exit(1);
  }

  const latestEntry = changelog[0] || {};
  
  console.log(`Current version: ${latestEntry.version || 'None'}`);
  console.log(`Last updated: ${latestEntry.date || 'N/A'}\n`);

  // Ask if this is a new version or adding to current
  const isNewVersion = await question('Is this a new version? (y/n): ');

  let targetEntry;
  
  if (isNewVersion.toLowerCase() === 'y') {
    // Create new version entry
    const version = await question('Enter new version (e.g., 1.4.0): ');
    const title = await question('Enter release title: ');
    
    targetEntry = {
      version: version.trim(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      title: title.trim(),
      changes: []
    };
    
    console.log(`\nCreating new version: v${targetEntry.version}\n`);
  } else {
    // Add to current version
    if (!latestEntry.version) {
      console.error('No existing version found. Please create a new version.');
      rl.close();
      return;
    }
    targetEntry = latestEntry;
    console.log(`\nAdding to current version: v${targetEntry.version}\n`);
  }

  // Collect changes
  let addingChanges = true;
  const changes = [];

  while (addingChanges) {
    console.log('Change type:');
    console.log('  1. ✨ Feature');
    console.log('  2. 🚀 Improvement');
    console.log('  3. 🐛 Bugfix');
    console.log('  4. ⚠️  Breaking change');
    
    const typeChoice = await question('Select type (1-4): ');
    const type = CHANGE_TYPES[typeChoice];
    
    if (!type) {
      console.log('Invalid type selected. Please try again.\n');
      continue;
    }

    const description = await question('Enter change description: ');
    
    if (description.trim()) {
      changes.push({
        type,
        description: description.trim()
      });
      console.log(`✅ Added ${type}: ${description.trim()}\n`);
    }

    const more = await question('Add another change? (y/n): ');
    addingChanges = more.toLowerCase() === 'y';
    console.log();
  }

  if (changes.length === 0) {
    console.log('No changes added. Exiting.');
    rl.close();
    return;
  }

  // Update the changelog
  if (isNewVersion.toLowerCase() === 'y') {
    targetEntry.changes = changes;
    changelog.unshift(targetEntry); // Add to beginning
  } else {
    // Add to existing entry
    targetEntry.changes = [...changes, ...targetEntry.changes];
    // Update date
    targetEntry.date = new Date().toISOString().split('T')[0];
  }

  // Write back to file
  try {
    fs.writeFileSync(
      CHANGELOG_PATH,
      JSON.stringify(changelog, null, 2),
      'utf8'
    );
    console.log('✅ Changelog updated successfully!\n');
    
    // Update App.tsx version if this is a new version
    if (isNewVersion.toLowerCase() === 'y') {
      try {
        let appTsx = fs.readFileSync(APP_TSX_PATH, 'utf8');
        
        // Find and replace the CURRENT_VERSION constant
        const versionRegex = /const CURRENT_VERSION = ['"][\d.]+['"]/;
        const newVersionLine = `const CURRENT_VERSION = '${targetEntry.version}'`;
        
        if (versionRegex.test(appTsx)) {
          appTsx = appTsx.replace(versionRegex, newVersionLine);
          fs.writeFileSync(APP_TSX_PATH, appTsx, 'utf8');
          console.log(`✅ Updated CURRENT_VERSION in App.tsx to '${targetEntry.version}'\n`);
        } else {
          console.log('⚠️  Could not find CURRENT_VERSION in App.tsx. Please update manually.\n');
        }
      } catch (error) {
        console.error('⚠️  Error updating App.tsx:', error.message);
        console.log('   Please update the version manually.\n');
      }
    }
    
    // Show summary
    console.log('Summary:');
    console.log(`Version: v${targetEntry.version}`);
    console.log(`Date: ${targetEntry.date}`);
    console.log(`Title: ${targetEntry.title}`);
    console.log('Changes:');
    changes.forEach(change => {
      const icon = change.type === 'feature' ? '✨' : 
                   change.type === 'improvement' ? '🚀' :
                   change.type === 'bugfix' ? '🐛' : '⚠️';
      console.log(`  ${icon} ${change.description}`);
    });
    console.log();

  } catch (error) {
    console.error('Error writing changelog:', error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
