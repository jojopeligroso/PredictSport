#!/usr/bin/env node
// init.js - Initialize queue from todos.md

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const TODOS_FILE = path.join(PROJECT_ROOT, 'todos.md');
const QUEUE_STATE_FILE = path.join(PROJECT_ROOT, '.queue-state.json');

const forceFlag = process.argv.includes('--force');

// Parse todos.md to extract pending tasks
function parseTodos() {
  const content = fs.readFileSync(TODOS_FILE, 'utf8');
  const lines = content.split('\n');

  const tasks = [];
  let currentSection = null;
  let currentPhase = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track sections for spec references
    if (line.startsWith('## ')) {
      currentSection = line.replace(/^##\s+/, '').trim();
      currentPhase = null;
    } else if (line.startsWith('### ')) {
      currentPhase = line.replace(/^###\s+/, '').trim();
    }

    // Match uncompleted tasks: - [ ] Task description
    const match = line.match(/^- \[ \] (.+)$/);
    if (match) {
      const description = match[1];

      // Extract task ID if present (e.g., "H1.1 — Description")
      const idMatch = description.match(/^([A-Z]\d+(?:\.\d+)?)\s*—\s*(.+)$/);
      const taskId = idMatch ? idMatch[1] : `T-${tasks.length + 1}`;
      const cleanDesc = idMatch ? idMatch[2] : description;

      // Determine spec reference
      let specRef = null;
      if (currentPhase && currentPhase.includes('Phase')) {
        specRef = currentPhase;
      } else if (currentSection) {
        specRef = currentSection;
      }

      tasks.push({
        id: taskId,
        description: cleanDesc,
        specRef,
        status: 'pending',
        source: {
          file: 'todos.md',
          line: i + 1
        }
      });
    }
  }

  return tasks;
}

// Initialize queue state
function initQueue() {
  // Check if queue already exists
  if (fs.existsSync(QUEUE_STATE_FILE) && !forceFlag) {
    console.log('⚠️  Queue state already exists at:', QUEUE_STATE_FILE);
    console.log('Use --force to reinitialize (will preserve existing claims)');
    process.exit(1);
  }

  const tasks = parseTodos();

  let existingClaims = {};
  if (fs.existsSync(QUEUE_STATE_FILE)) {
    const existing = JSON.parse(fs.readFileSync(QUEUE_STATE_FILE, 'utf8'));
    existingClaims = existing.claims || {};
  }

  const state = {
    tasks,
    claims: existingClaims
  };

  fs.writeFileSync(QUEUE_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  console.log('✅ Queue initialized');
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   Active claims: ${Object.keys(existingClaims).length}`);
  console.log('');

  if (tasks.length > 0) {
    console.log('First 5 tasks:');
    tasks.slice(0, 5).forEach(task => {
      console.log(`  [${task.id}] ${task.description}`);
    });
    console.log('');
  }
}

// Main
try {
  initQueue();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
