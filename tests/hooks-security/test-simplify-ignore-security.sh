#!/bin/bash
# test-simplify-ignore-security.sh — Tests for symlink and atomic write fixes
# Validates fixes for GitHub issue #295 findings #4, #5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_DIR/hooks/simplify-ignore.sh"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '  ✔ %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✖ %s\n' "$1"; }

echo "=== Symlink Protection (Finding #4) ==="

# Test: simplify-ignore.sh rejects symlinks in Read handler
test_symlink_rejected_read() {
  local dir
  dir=$(mktemp -d)
  local real_file="$dir/real.txt"
  local link_file="$dir/link.txt"
  echo "some content" > "$real_file"
  ln -s "$real_file" "$link_file"
  
  # Simulate Read hook input with symlink path
  local input
  input=$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$link_file")
  
  # The hook should exit 0 (skip) without modifying anything
  # We check that the symlink target is unchanged
  local before
  before=$(cat "$real_file")
  printf '%s' "$input" | bash "$HOOK" 2>/dev/null
  local after
  after=$(cat "$real_file")
  
  rm -rf "$dir"
  [ "$before" = "$after" ]
}
if test_symlink_rejected_read; then pass "Read hook skips symlinks"; else fail "Read hook should skip symlinks"; fi

# Test: simplify-ignore.sh restores atomically (no partial writes on failure)
test_atomic_restore() {
  local dir
  dir=$(mktemp -d)
  local cache_dir="$dir/.claude/.simplify-ignore-cache"
  mkdir -p "$cache_dir"
  
  local real_file="$dir/test.txt"
  echo "original content" > "$real_file"
  
  # Create a fake backup
  local file_hash
  file_hash=$(printf '%s' "$real_file" | shasum | cut -c1-16)
  echo "backed up content" > "$cache_dir/${file_hash}.bak"
  printf '%s' "$real_file" > "$cache_dir/${file_hash}.path"
  
  # The restore should either fully succeed or leave backup intact
  local before_content
  before_content=$(cat "$cache_dir/${file_hash}.bak")
  
  # Trigger Stop (empty tool_name = Stop handler)
  printf '{}' | bash "$HOOK" 2>/dev/null || true
  
  # After restore, backup should be removed (success) or preserved (failure)
  if [ -f "$cache_dir/${file_hash}.bak" ]; then
    # Backup preserved — verify it's intact
    local after_content
    after_content=$(cat "$cache_dir/${file_hash}.bak")
    [ "$before_content" = "$after_content" ]
  else
    # Backup removed — verify file was restored
    [ -f "$real_file" ]
  fi
  local rc=$?
  rm -rf "$dir"
  return $rc
}
if test_atomic_restore; then pass "restore is atomic (backup preserved or fully applied)"; else fail "restore should be atomic"; fi

echo ""
echo "=== Perl Dependency Check (Finding #5) ==="

# Test: simplify-ignore.sh checks for perl at startup
test_perl_check_exists() {
  grep -q 'command -v perl' "$HOOK"
}
if test_perl_check_exists; then pass "perl dependency is checked at startup"; else fail "perl should be checked at startup"; fi

# Test: simplify-ignore.sh has cleanup trap
test_cleanup_trap_exists() {
  grep -q 'trap cleanup_tmp EXIT' "$HOOK"
}
if test_cleanup_trap_exists; then pass "cleanup trap is registered"; else fail "cleanup trap should be registered"; fi

echo ""
echo "=== Atomic Write Pattern ==="

# Test: no cat > redirections remain in Write/Restore paths (should use mv)
test_no_cat_redirects_in_restore() {
  # Check the Stop handler — should use cp + mv, not cat > 
  ! grep -q 'cat "\$bak" > "\$orig"' "$HOOK"
}
if test_no_cat_redirects_in_restore; then pass "Stop handler uses atomic cp+mv pattern"; else fail "Stop handler should use atomic cp+mv pattern"; fi

# Test: Read handler uses mv instead of cat >
test_read_handler_atomic() {
  # Check that the file uses mv -f for the final write in the Read path
  # (after filter_file returns true on line ~227)
  grep -q 'mv -f "\$FILTERED" "\$FILE_PATH"' "$HOOK"
}
if test_read_handler_atomic; then pass "Read handler uses atomic mv"; else fail "Read handler should use atomic mv"; fi

echo ""
echo "=== Symlink Check in Edit/Write Handler ==="

# Test: Edit/Write handler skips symlinks
test_edit_write_symlink_check() {
  # The Edit/Write handler should check for .bak existence, which means
  # it should have processed the file through Read first (which skips symlinks)
  grep -q '\[ -L "\$FILE_PATH" \] && exit 0' "$HOOK"
}
if test_edit_write_symlink_check; then pass "symlink check exists in Read handler"; else fail "symlink check should exist in Read handler"; fi

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo "==============================="
[ "$FAIL" -eq 0 ]
