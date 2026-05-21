#!/usr/bin/env node
// queue-ops.js - Queue state manipulation operations

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const QUEUE_STATE_FILE = path.join(PROJECT_ROOT, '.queue-state.json');

// Read queue state
function readQueue() {
  try {
    const data = fs.readFileSync(QUEUE_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { tasks: [], claims: {} };
  }
}

// Write queue state
function writeQueue(state) {
  fs.writeFileSync(QUEUE_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// Get next available task
function getNextTask(state) {
  const claimedIds = new Set(Object.values(state.claims));
  return state.tasks.find(task =>
    task.status === 'pending' && !claimedIds.has(task.id)
  );
}

// Command: claim
function cmdClaim(sessionId) {
  const state = readQueue();
  const task = getNextTask(state);

  if (!task) {
    console.log('null');
    return;
  }

  state.claims[sessionId] = task.id;
  writeQueue(state);
  console.log(task.id);
}

// Command: get-claimed
function cmdGetClaimed(sessionId) {
  const state = readQueue();
  const taskId = state.claims[sessionId];
  console.log(taskId || 'null');
}

// Command: release
function cmdRelease(sessionId, mode) {
  const state = readQueue();
  const taskId = state.claims[sessionId];

  if (!taskId) {
    console.error('No task claimed');
    process.exit(1);
  }

  if (mode === 'complete') {
    // Remove from pending tasks
    state.tasks = state.tasks.filter(t => t.id !== taskId);
  }
  // If abandon, task stays in pending state

  delete state.claims[sessionId];
  writeQueue(state);
}

// Command: show-task
function cmdShowTask(taskId) {
  const state = readQueue();
  const task = state.tasks.find(t => t.id === taskId);

  if (!task) {
    console.log('Task not found');
    return;
  }

  console.log('');
  console.log(`  ID: ${task.id}`);
  console.log(`  Task: ${task.description}`);
  console.log(`  Spec ref: ${task.specRef || 'N/A'}`);
  console.log('');
}

// Command: status
function cmdStatus() {
  const state = readQueue();
  const claimedIds = new Set(Object.values(state.claims));
  const pending = state.tasks.filter(t => !claimedIds.has(t.id));

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('QUEUE STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (Object.keys(state.claims).length > 0) {
    console.log('Active claims:');
    for (const [session, taskId] of Object.entries(state.claims)) {
      const task = state.tasks.find(t => t.id === taskId);
      console.log(`  ${session}: ${taskId} - ${task?.description || 'Unknown'}`);
    }
    console.log('');
  }

  console.log(`Pending tasks: ${pending.length}`);
  if (pending.length > 0) {
    console.log('');
    pending.slice(0, 5).forEach(task => {
      console.log(`  [${task.id}] ${task.description}`);
    });

    if (pending.length > 5) {
      console.log(`  ... and ${pending.length - 5} more`);
    }
  }
  console.log('');
}

// Command: cleanup - remove orphaned claims for tasks that no longer exist
function cmdCleanup() {
  const state = readQueue();
  const taskIds = new Set(state.tasks.map(t => t.id));
  const orphanedSessions = [];

  for (const [session, taskId] of Object.entries(state.claims)) {
    if (!taskIds.has(taskId)) {
      orphanedSessions.push(session);
      delete state.claims[session];
    }
  }

  if (orphanedSessions.length > 0) {
    writeQueue(state);
    console.log(`✅ Cleaned up ${orphanedSessions.length} orphaned claim(s)`);
  } else {
    console.log('✅ No orphaned claims found');
  }
}

// Main
const [,, command, ...args] = process.argv;

switch (command) {
  case 'claim':
    cmdClaim(args[0]);
    break;
  case 'get-claimed':
    cmdGetClaimed(args[0]);
    break;
  case 'release':
    cmdRelease(args[0], args[1]);
    break;
  case 'show-task':
    cmdShowTask(args[0]);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'cleanup':
    cmdCleanup();
    break;
  default:
    console.error('Unknown command:', command);
    process.exit(1);
}
