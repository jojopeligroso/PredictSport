#!/usr/bin/env bash
# flock-wrapper.sh - Atomic task queue operations
# Uses flock for lockfile-based concurrency control

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
QUEUE_STATE_FILE="${PROJECT_ROOT}/.queue-state.json"
LOCKFILE="${PROJECT_ROOT}/.queue.lock"
SESSION_FILE="${PROJECT_ROOT}/.queue-session"

# Get or create stable session ID
if [ -f "$SESSION_FILE" ]; then
    SESSION_ID=$(cat "$SESSION_FILE")
else
    SESSION_ID="session-$(date +%s)-$$"
    echo "$SESSION_ID" > "$SESSION_FILE"
fi

# Ensure queue state file exists
if [ ! -f "$QUEUE_STATE_FILE" ]; then
    echo '{"tasks":[],"claims":{}}' > "$QUEUE_STATE_FILE"
fi

# Commands
cmd_claim() {
    (
        flock -x 200

        # Check if we already have a claimed task
        local current_task=$(node "$SCRIPT_DIR/queue-ops.js" get-claimed "$SESSION_ID")

        if [ -n "$current_task" ] && [ "$current_task" != "null" ]; then
            echo "⚠️  You already have a claimed task:"
            node "$SCRIPT_DIR/queue-ops.js" show-task "$current_task"
            echo ""
            echo "Release with: flock-wrapper.sh release complete|abandon"
            exit 1
        fi

        # Claim next available task
        local task_id=$(node "$SCRIPT_DIR/queue-ops.js" claim "$SESSION_ID")

        if [ -z "$task_id" ] || [ "$task_id" = "null" ]; then
            echo "📭 No tasks available in queue"
            node "$SCRIPT_DIR/queue-ops.js" status
            exit 0
        fi

        echo "✅ Claimed task:"
        node "$SCRIPT_DIR/queue-ops.js" show-task "$task_id"

    ) 200>"$LOCKFILE"
}

cmd_release() {
    local mode="${1:-complete}"

    if [ "$mode" != "complete" ] && [ "$mode" != "abandon" ]; then
        echo "Usage: flock-wrapper.sh release <complete|abandon>"
        exit 1
    fi

    (
        flock -x 200

        local task_id=$(node "$SCRIPT_DIR/queue-ops.js" get-claimed "$SESSION_ID")

        if [ -z "$task_id" ] || [ "$task_id" = "null" ]; then
            echo "⚠️  No task claimed by this session"
            exit 1
        fi

        node "$SCRIPT_DIR/queue-ops.js" release "$SESSION_ID" "$mode"

        if [ "$mode" = "complete" ]; then
            echo "✅ Task $task_id released (completed)"
        else
            echo "♻️  Task $task_id released (returned to queue)"
        fi

    ) 200>"$LOCKFILE"
}

cmd_status() {
    (
        flock -s 200
        node "$SCRIPT_DIR/queue-ops.js" status
    ) 200>"$LOCKFILE"
}

cmd_clear_session() {
    if [ -f "$SESSION_FILE" ]; then
        rm "$SESSION_FILE"
        echo "✅ Session cleared"
    else
        echo "⚠️  No active session"
    fi
}

# Main
case "${1:-}" in
    claim)
        cmd_claim
        ;;
    release)
        cmd_release "${2:-complete}"
        ;;
    status)
        cmd_status
        ;;
    clear-session)
        cmd_clear_session
        ;;
    *)
        echo "Usage: flock-wrapper.sh <claim|release|status|clear-session>"
        echo ""
        echo "Commands:"
        echo "  claim                    - Claim next available task"
        echo "  release complete         - Release current task as completed"
        echo "  release abandon          - Release current task back to queue"
        echo "  status                   - Show queue status"
        echo "  clear-session            - Clear session ID (for ending session)"
        exit 1
        ;;
esac
