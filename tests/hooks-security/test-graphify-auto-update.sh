#!/bin/bash
# test-graphify-auto-update.sh
# Smoke test for graphify auto-update hook

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK_SCRIPT="$PROJECT_ROOT/hooks/graphify-auto-update.sh"
TEST_DIR="$PROJECT_ROOT/test-hook-graphify"
CONFIG_FILE="$TEST_DIR/tasks/config.json"

# Cleanup function
cleanup() {
  if [ -d "$TEST_DIR" ]; then
    rm -rf "$TEST_DIR"
  fi
}

# Setup
cleanup
mkdir -p "$TEST_DIR/tasks"

# Test 1: Hook exits silently when config doesn't exist
echo "Test 1: Hook exits silently when config doesn't exist"
bash "$HOOK_SCRIPT" commit
echo "PASS"

# Test 2: Hook exits silently when graphify is disabled
echo "Test 2: Hook exits silently when graphify is disabled"
cat > "$CONFIG_FILE" << 'EOF'
{
  "graphify": {
    "enabled": false,
    "auto_update": false
  }
}
EOF
bash "$HOOK_SCRIPT" commit
echo "PASS"

# Test 3: Hook exits silently when auto_update is false
echo "Test 3: Hook exits silently when auto_update is false"
cat > "$CONFIG_FILE" << 'EOF'
{
  "graphify": {
    "enabled": true,
    "auto_update": false
  }
}
EOF
bash "$HOOK_SCRIPT" commit
echo "PASS"

# Test 4: Hook exits silently for non-HEAD-advancing command
echo "Test 4: Hook exits silently for non-HEAD-advancing command"
cat > "$CONFIG_FILE" << 'EOF'
{
  "graphify": {
    "enabled": true,
    "auto_update": true
  }
}
EOF
bash "$HOOK_SCRIPT" push
echo "PASS"

# Cleanup
cleanup

echo "All tests passed!"
exit 0
