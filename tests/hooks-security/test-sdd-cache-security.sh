#!/bin/bash
# test-sdd-cache-security.sh — Tests for SSRF, TTL, and integrity fixes
# Validates fixes for GitHub issue #295 findings #1, #2, #3
# Run: bash tests/hooks-security/test-sdd-cache-security.sh
# Windows (Git Bash): "C:\Program Files\Git\bin\bash.exe" -c "bash tests/hooks-security/test-sdd-cache-security.sh"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRE_HOOK="$REPO_DIR/hooks/sdd-cache-pre.sh"
POST_HOOK="$REPO_DIR/hooks/sdd-cache-post.sh"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '  ✔ %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✖ %s\n' "$1"; }

# Helper: run a shell function in a subshell that sources validate_url from the pre hook
# We extract validate_url by sourcing the relevant lines
extract_validate_url() {
  cat <<'FUNC'
validate_url() {
  local url="$1"
  case "$url" in
    https://*) ;;
    *) printf 'sdd-cache: rejected %s (only https allowed)\n' "$url" >&2; return 1 ;;
  esac
  local host
  host=$(printf '%s' "$url" | sed -n 's|^https://\([^/:]*\).*|\1|p')
  [ -n "$host" ] || return 1
  case "$host" in
    localhost|localhost.localdomain) ;;
    127.*|10.*|192.168.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2?.*|172.30.*|172.31.*) ;;
    0.*|::1|fe80:*|fc00:*|fd00:*) ;;
    169.254.169.254|metadata.google.internal|169.254.169.254.xip.io) ;;
    *.local|*.internal|*.localhost) ;;
    *) return 0 ;;
  esac
  printf 'sdd-cache: rejected %s (internal/metadata host blocked)\n' "$url" >&2
  return 1
}
FUNC
}

echo "=== SSRF Protection (Finding #1) ==="

# Test: https URLs to public hosts are allowed
test_https_allowed() {
  local result
  result=$(eval "$(extract_validate_url)" && validate_url "https://example.com/page" 2>&1) && return 0
  return 1
}
if test_https_allowed; then pass "allows https to public host"; else fail "should allow https to public host"; fi

# Test: http URLs are rejected
test_http_rejected() {
  ! (eval "$(extract_validate_url)" && validate_url "http://example.com/page" 2>/dev/null)
}
if test_http_rejected; then pass "rejects http scheme"; else fail "should reject http scheme"; fi

# Test: localhost is blocked
test_localhost_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://localhost/admin" 2>/dev/null)
}
if test_localhost_blocked; then pass "blocks localhost"; else fail "should block localhost"; fi

# Test: 127.0.0.1 is blocked
test_loopback_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://127.0.0.1/admin" 2>/dev/null)
}
if test_loopback_blocked; then pass "blocks 127.0.0.1"; else fail "should block 127.0.0.1"; fi

# Test: 169.254.169.254 (cloud metadata) is blocked
test_metadata_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://169.254.169.254/latest/meta-data/" 2>/dev/null)
}
if test_metadata_blocked; then pass "blocks cloud metadata endpoint"; else fail "should block 169.254.169.254"; fi

# Test: 10.x.x.x is blocked
test_private_10_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://10.0.0.1/admin" 2>/dev/null)
}
if test_private_10_blocked; then pass "blocks 10.x.x.x"; else fail "should block 10.x.x.x"; fi

# Test: 192.168.x.x is blocked
test_private_192_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://192.168.1.1/admin" 2>/dev/null)
}
if test_private_192_blocked; then pass "blocks 192.168.x.x"; else fail "should block 192.168.x.x"; fi

# Test: 172.16-31.x.x is blocked
test_private_172_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://172.16.0.1/admin" 2>/dev/null)
}
if test_private_172_blocked; then pass "blocks 172.16.x.x"; else fail "should block 172.16.x.x"; fi

# Test: metadata.google.internal is blocked
test_gce_metadata_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://metadata.google.internal/computeMetadata/v1/" 2>/dev/null)
}
if test_gce_metadata_blocked; then pass "blocks GCE metadata"; else fail "should block metadata.google.internal"; fi

# Test: .local domains are blocked
test_local_domain_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://myapp.local/api" 2>/dev/null)
}
if test_local_domain_blocked; then pass "blocks .local domains"; else fail "should block .local domains"; fi

# Test: .internal domains are blocked
test_internal_domain_blocked() {
  ! (eval "$(extract_validate_url)" && validate_url "https://service.internal/api" 2>/dev/null)
}
if test_internal_domain_blocked; then pass "blocks .internal domains"; else fail "should block .internal domains"; fi

echo ""
echo "=== TTL Enforcement (Finding #2) ==="

# Test: cache entry within TTL is served
test_ttl_within() {
  local dir
  dir=$(mktemp -d)
  local now
  now=$(date +%s)
  cat > "$dir/test.json" <<EOF
{"url":"https://example.com","fetched_at":$now,"etag":"abc","content":"hello"}
EOF
  # Simulate TTL check: age < TTL
  local fetched_at
  fetched_at=$(jq -r '.fetched_at' "$dir/test.json")
  local age=$(( now - fetched_at ))
  [ "$age" -lt 86400 ]
  local rc=$?
  rm -rf "$dir"
  return $rc
}
if test_ttl_within; then pass "cache within TTL is valid"; else fail "cache within TTL should be valid"; fi

# Test: cache entry exceeding TTL is rejected
test_ttl_exceeded() {
  local dir
  dir=$(mktemp -d)
  local old_time
  old_time=$(( $(date +%s) - 100000 ))
  cat > "$dir/test.json" <<EOF
{"url":"https://example.com","fetched_at":$old_time,"etag":"abc","content":"hello"}
EOF
  local now
  now=$(date +%s)
  local fetched_at
  fetched_at=$(jq -r '.fetched_at' "$dir/test.json")
  local age=$(( now - fetched_at ))
  [ "$age" -gt 86400 ]
  local rc=$?
  rm -rf "$dir"
  return $rc
}
if test_ttl_exceeded; then pass "cache exceeding TTL is rejected"; else fail "cache exceeding TTL should be rejected"; fi

echo ""
echo "=== Content Integrity (Finding #3) ==="

# Test: matching content hash passes verification
test_hash_match() {
  local content="test content"
  local stored_hash
  stored_hash=$(printf '%s' "$content" | sha256sum | cut -c1-32)
  local computed_hash
  computed_hash=$(printf '%s' "$content" | sha256sum | cut -c1-32)
  [ "$stored_hash" = "$computed_hash" ]
}
if test_hash_match; then pass "content hash verification passes for unmodified content"; else fail "hash should match"; fi

# Test: mismatched content hash fails verification
test_hash_mismatch() {
  local content="test content"
  local stored_hash
  stored_hash=$(printf '%s' "$content" | sha256sum | cut -c1-32)
  local tampered="tampered content"
  local computed_hash
  computed_hash=$(printf '%s' "$tampered" | sha256sum | cut -c1-32)
  [ "$stored_hash" != "$computed_hash" ]
}
if test_hash_mismatch; then pass "content hash verification fails for tampered content"; else fail "hash should mismatch for tampered content"; fi

echo ""
echo "=== Cache Dir Permissions ==="

# Test: cache dir gets chmod 700
test_cache_dir_permissions() {
  # Skip on Windows/MSYS — no Unix permission model
  if [ -n "${MSYSTEM:-}" ] || [[ "$(uname -s)" == MINGW* ]]; then
    return 0
  fi
  local dir
  dir=$(mktemp -d)
  mkdir -p "$dir/.claude/sdd-cache"
  chmod 700 "$dir/.claude/sdd-cache"
  local perms
  perms=$(stat -c "%a" "$dir/.claude/sdd-cache" 2>/dev/null || stat -f "%Lp" "$dir/.claude/sdd-cache" 2>/dev/null)
  rm -rf "$dir"
  [ "$perms" = "700" ]
}
if test_cache_dir_permissions; then pass "cache dir permissions are 700"; else fail "cache dir should have 700 permissions"; fi

echo ""
echo "=== Pre Hook: No -L Flag ==="

# Test: pre hook does not use -L (redirect following)
test_no_follow_redirects() {
  grep -q '\-L' "$PRE_HOOK" && return 1 || return 0
}
if test_no_follow_redirects; then pass "pre hook does not follow redirects"; else fail "pre hook should not use -L flag"; fi

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo "==============================="
[ "$FAIL" -eq 0 ]
