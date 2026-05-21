# Queue Management Scripts

Atomic task queue system for managing concurrent Claude Code sessions working on the same project.

## Problem

When multiple Claude Code sessions work on the same project concurrently:
- Tasks can be worked on by multiple sessions simultaneously (wasted work)
- Completed tasks may be re-implemented (duplicate effort)
- Git conflicts become more likely

## Solution

A lockfile-based task queue that:
- Prevents concurrent sessions from claiming the same task
- Tracks which session owns which task
- Removes completed tasks from the queue
- Allows abandoned tasks to return to the queue

## Architecture

```
todos.md (source of truth)
    ↓
init.js (parses todos.md)
    ↓
.queue-state.json (active queue state)
    ↑↓
queue-ops.js (state manipulation)
    ↑
flock-wrapper.sh (atomic operations via flock)
```

### Files

- **`flock-wrapper.sh`** - Main CLI interface using `flock` for atomic operations
- **`queue-ops.js`** - Queue state manipulation (claim, release, status)
- **`init.js`** - Initialize queue from `todos.md`
- **`.queue-state.json`** - Active queue state (gitignored)
- **`.queue-session`** - Stable session ID (gitignored)
- **`.queue.lock`** - Lockfile for atomic operations (gitignored)

## Usage

### Initialize Queue

Parse `todos.md` and create initial queue state:

```bash
node /path/to/claude-config/queue-scripts/init.js
```

Force reinitialize (preserves existing claims):

```bash
node /path/to/claude-config/queue-scripts/init.js --force
```

### Claim a Task

Claim the next available task:

```bash
/path/to/claude-config/queue-scripts/flock-wrapper.sh claim
```

Output:
```
✅ Claimed task:

  ID: H1.1
  Task: Implement FIFA tiebreaker logic
  Spec ref: SPEC.md §16
```

If already claimed:
```
⚠️  You already have a claimed task:
  ID: H1.1
  ...
Release with: flock-wrapper.sh release complete|abandon
```

### Check Status

View queue state:

```bash
/path/to/claude-config/queue-scripts/flock-wrapper.sh status
```

Output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUEUE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Active claims:
  session-123: H1.1 - Implement FIFA tiebreaker logic

Pending tasks: 52
  [H1.2] Best-third ranking
  [H1.3] Best-third slot allocation
  ...
```

### Release a Task

Mark task as completed (removes from queue):

```bash
/path/to/claude-config/queue-scripts/flock-wrapper.sh release complete
```

Return task to queue (abandon):

```bash
/path/to/claude-config/queue-scripts/flock-wrapper.sh release abandon
```

### Clear Session

End current session (release any claims first):

```bash
/path/to/claude-config/queue-scripts/flock-wrapper.sh clear-session
```

## Integration with Slash Commands

The `/PredictSport-next-task` command uses this queue system:

1. Navigate to project directory
2. Run `flock-wrapper.sh claim`
3. Display claimed task with spec reference and relevant files
4. After completion, run `flock-wrapper.sh release complete`

## Queue State Format

`.queue-state.json`:

```json
{
  "tasks": [
    {
      "id": "H1.1",
      "description": "Implement FIFA tiebreaker logic",
      "specRef": "SPEC.md §16",
      "status": "pending",
      "source": {
        "file": "todos.md",
        "line": 238
      }
    }
  ],
  "claims": {
    "session-123": "H1.1"
  }
}
```

## Workflow

### Starting Work

```bash
# Initialize queue (first time only)
node /path/to/init.js

# Claim next task
flock-wrapper.sh claim

# Work on task...

# Mark complete and remove from queue
flock-wrapper.sh release complete
```

### Abandoning Work

```bash
# Return task to queue without completing
flock-wrapper.sh release abandon
```

### Checking What Others Are Doing

```bash
# View all active claims and pending tasks
flock-wrapper.sh status
```

## Session Persistence

Sessions use a stable ID stored in `.queue-session`:
- Created on first `claim` command
- Persists across multiple command invocations
- Cleared with `clear-session` command
- Automatically generated from timestamp + PID

## Concurrency Safety

Uses `flock` (file locking) to ensure atomic operations:
- `claim` - exclusive lock (write)
- `release` - exclusive lock (write)
- `status` - shared lock (read)

Multiple processes can safely run these commands concurrently.

## Cleanup

Orphaned claims (for tasks that no longer exist) can be cleaned up:

```bash
node /path/to/queue-ops.js cleanup
```

This is useful after running `init.js --force` when the task list has changed significantly.

## Environment Variables

- `PROJECT_ROOT` - Project directory (defaults to current directory)
- `CLAUDE_SESSION_ID` - Override session ID (optional)

## Design Decisions

### Why flock?

- Built into Linux/macOS
- Reliable atomic operations
- No external dependencies
- Works across concurrent processes

### Why separate session file?

- Bash `$$` changes per invocation
- Need stable ID across multiple commands
- Simple file-based persistence

### Why not a database?

- Overkill for simple task queue
- Adds external dependency
- JSON + flock is sufficient
- Easy to inspect and debug

## Troubleshooting

### "Task already claimed" but no active session

Check status to see which session holds the claim:

```bash
flock-wrapper.sh status
```

If session is orphaned, manually edit `.queue-state.json` to remove the claim.

### Queue out of sync with todos.md

Reinitialize the queue:

```bash
node /path/to/init.js --force
node /path/to/queue-ops.js cleanup
```

### Lockfile stuck

Remove the lockfile:

```bash
rm .queue.lock
```

## Future Enhancements

- [ ] Task priorities (P0, P1, P2)
- [ ] Task dependencies (must complete X before Y)
- [ ] Estimated completion time tracking
- [ ] Session heartbeat (detect stale sessions)
- [ ] Web UI for queue visualization
