#!/bin/bash
# sdd-cache-post.sh â€” PostToolUse hook for WebFetch.
#
# After WebFetch, stores the response body in .claude/sdd-cache/<sha>.json
# with the current ETag / Last-Modified captured via a HEAD request so the
# pre hook can revalidate on the next fetch.
#
# Keyed by URL. The caller's prompt is stored as metadata (not part of the
# key) so a future cache hit can show what question produced the cached
# reading. Entries without ETag or Last-Modified are not cached.
#
# Dependencies: jq, curl, shasum (or sha256sum).

set -euo pipefail

command -v jq   >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || exit 0

if [ -t 0 ]; then INPUT="{}"; else INPUT=$(cat); fi

# â”€â”€ URL safety validation (SSRF prevention) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

# Debug logging: active when SDD_CACHE_DEBUG=1 is set, or when a sentinel
# file exists at .claude/sdd-cache/.debug. Toggle with `touch` / `rm`.
dbg() {
  local dir="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/sdd-cache"
  [ "${SDD_CACHE_DEBUG:-0}" = "1" ] || [ -f "$dir/.debug" ] || return 0
  mkdir -p "$dir"
  printf '%s [post] %s\n' "$(date -u +%FT%TZ)" "$*" >> "$dir/.debug.log"
}
dbg "fired, input=$(printf '%s' "$INPUT" | head -c 400)"

URL=$(printf '%s'    "$INPUT" | jq -r '.tool_input.url    // empty' 2>/dev/null || true)
PROMPT=$(printf '%s' "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null || true)
if [ -z "$URL" ]; then dbg "no url in tool_input, exit"; exit 0; fi
if ! validate_url "$URL"; then exit 0; fi
dbg "url=$URL prompt=$(printf '%s' "$PROMPT" | head -c 80)"

# WebFetch tool_response shape (Claude Code as of 2026-04): an object with
# keys bytes, code, codeText, durationMs, result, url â€” content lives at
# .result. The other keys (.output / .text / .content / .body) are kept as
# defensive fallbacks in case the shape changes; jq returns empty if none
# match. The string branch handles older/custom integrations.
TOOL_RESPONSE_TYPE=$(printf '%s' "$INPUT" | jq -r '.tool_response | type' 2>/dev/null || echo "unknown")
dbg "tool_response type=$TOOL_RESPONSE_TYPE keys=$(printf '%s' "$INPUT" | jq -r 'try (.tool_response | keys | join(",")) catch "n/a"' 2>/dev/null)"

CONTENT=$(printf '%s' "$INPUT" | jq -r '
  if (.tool_response | type) == "object" then
    (.tool_response.result
     // .tool_response.output
     // .tool_response.text
     // .tool_response.content
     // .tool_response.body
     // empty)
  elif (.tool_response | type) == "string" then
    .tool_response
  else
    empty
  end
' 2>/dev/null || true)

if [ -z "$CONTENT" ]; then
  dbg "could not extract content from tool_response, exit (shape unknown)"
  exit 0
fi
dbg "extracted content bytes=${#CONTENT}"

# Must match the pre hook: sha256(URL), first 32 hex chars.
hash_key() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -c1-32
  else
    printf '%s' "$1" | sha256sum | cut -c1-32
  fi
}

CACHE_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/sdd-cache"
mkdir -p "$CACHE_DIR" 2>/dev/null && chmod 700 "$CACHE_DIR" 2>/dev/null || true
CACHE_FILE="$CACHE_DIR/$(hash_key "$URL").json"

# Capture validators from the origin. Follow redirects so they match the
# URL the agent actually talked to. Strip CR so awk's paragraph mode
# recognises blank separators between response blocks on a redirect chain.
HEAD_OUT=$(curl -sI -L --max-time 5 "$URL" 2>/dev/null | tr -d '\r' || true)

# Re-validate the final redirect target host to prevent SSRF via redirect chain.
FINAL_URL=$(printf '%s' "$HEAD_OUT" | awk '
  BEGIN { RS = ""; last = "" }
  { last = $0 }
  END {
    # Extract Location from final response (if any redirect happened)
    split(last, lines, "\n")
    for (i in lines) {
      if (tolower(lines[i]) ~ /^location:/) {
        sub(/^[^:]*:[ \t]*/, "", lines[i])
        gsub(/[ \t]+$/, "", lines[i])
        print lines[i]
        exit
      }
    }
  }
')
if [ -n "$FINAL_URL" ]; then
  # If there was a redirect, validate the final target
  case "$FINAL_URL" in
    https://*) ;;
    http://*)
      # HTTP redirect target â€” reject (we only allow https origins)
      printf 'sdd-cache: rejected redirect to %s (only https)\n' "$FINAL_URL" >&2
      exit 0
      ;;
  esac
  REDIRECT_HOST=$(printf '%s' "$FINAL_URL" | sed -n 's|^https://\([^/:]*\).*|\1|p')
  case "$REDIRECT_HOST" in
    localhost|localhost.localdomain|127.*|10.*|192.168.*|172.16.*|172.17.*|172.18.*|172.19.*|172.2?.*|172.30.*|172.31.*|0.*|::1|fe80:*|fc00:*|fd00:*|169.254.169.254|metadata.google.internal|*.local|*.internal|*.localhost)
      printf 'sdd-cache: rejected redirect to internal host %s\n' "$REDIRECT_HOST" >&2
      exit 0
      ;;
  esac
fi

# Take only the final response's headers (last paragraph) to avoid picking
# up validators from intermediate 301/302 hops.
FINAL_HEADERS=$(printf '%s' "$HEAD_OUT" | awk '
  BEGIN { RS = ""; last = "" }
  { last = $0 }
  END { print last }
')

extract_header() {
  local name="$1"
  printf '%s' "$FINAL_HEADERS" | awk -v h="$name" '
    BEGIN { FS = ":" }
    tolower($1) == tolower(h) {
      sub(/^[^:]*:[ \t]*/, "")
      sub(/[ \t]+$/, "")
      print
      exit
    }
  '
}

ETAG=$(extract_header "ETag")
LAST_MOD=$(extract_header "Last-Modified")
dbg "HEAD etag=$ETAG last_modified=$LAST_MOD"

if [ -z "$ETAG" ] && [ -z "$LAST_MOD" ]; then
  dbg "no validator from origin, removing any stale entry and exit"
  rm -f "$CACHE_FILE"
  exit 0
fi

NOW=$(date +%s)

# Compute content integrity hash to detect tampered cache entries.
if command -v shasum >/dev/null 2>&1; then
  CONTENT_HASH=$(printf '%s' "$CONTENT" | shasum -a 256 | cut -c1-32)
else
  CONTENT_HASH=$(printf '%s' "$CONTENT" | sha256sum | cut -c1-32)
fi

TMP="${CACHE_FILE}.$$.tmp"
if jq -n \
  --arg url           "$URL" \
  --arg prompt        "$PROMPT" \
  --arg etag          "$ETAG" \
  --arg last_modified "$LAST_MOD" \
  --arg content       "$CONTENT" \
  --arg content_hash  "$CONTENT_HASH" \
  --argjson fetched_at "$NOW" \
  '{url: $url, prompt: $prompt, etag: $etag, last_modified: $last_modified, content: $content, content_hash: $content_hash, fetched_at: $fetched_at}' \
  > "$TMP"
then
  mv "$TMP" "$CACHE_FILE"
  dbg "wrote cache file $CACHE_FILE"
else
  rm -f "$TMP"
  dbg "jq failed, temp cleaned"
fi

exit 0
