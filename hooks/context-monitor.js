#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const WARNING_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 25;
const STALE_SECONDS = 60;
const DEBOUNCE_CALLS = 5;

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input || '{}');
    const sessionId = data.session_id;
    if (!sessionId || /[/\\]|\.\./.test(sessionId)) process.exit(0);

    const tmpDir = os.tmpdir();
    const metricsPath = path.join(tmpDir, `claude-ctx-${sessionId}.json`);
    let metricsRaw;
    try {
      metricsRaw = fs.readFileSync(metricsPath, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') process.exit(0);
      throw err;
    }

    const metrics = JSON.parse(metricsRaw);
    const now = Math.floor(Date.now() / 1000);
    if (metrics.timestamp && (now - metrics.timestamp) > STALE_SECONDS) process.exit(0);

    const remaining = Number(metrics.remaining_percentage);
    const usedPct = Number(metrics.used_pct);
    if (!Number.isFinite(remaining) || remaining > WARNING_THRESHOLD) process.exit(0);

    const warnPath = path.join(tmpDir, `agent-skills-ctx-${sessionId}-warned.json`);
    let warnData = { callsSinceWarn: 0, lastLevel: null, criticalRecorded: false };
    let firstWarn = true;
    try {
      warnData = JSON.parse(fs.readFileSync(warnPath, 'utf8'));
      firstWarn = false;
    } catch {
      // Missing or corrupted debounce file means warn immediately.
    }

    warnData.callsSinceWarn = (warnData.callsSinceWarn || 0) + 1;
    const isCritical = remaining <= CRITICAL_THRESHOLD;
    const currentLevel = isCritical ? 'critical' : 'warning';
    const severityEscalated = currentLevel === 'critical' && warnData.lastLevel === 'warning';
    if (!firstWarn && warnData.callsSinceWarn < DEBOUNCE_CALLS && !severityEscalated) {
      fs.writeFileSync(warnPath, JSON.stringify(warnData));
      process.exit(0);
    }

    warnData.callsSinceWarn = 0;
    warnData.lastLevel = currentLevel;

    const cwd = data.cwd || process.cwd();
    const statePath = path.join(cwd, 'tasks', 'STATE.md');
    const isAgentSkillsActive = fs.existsSync(statePath);

    if (isCritical && isAgentSkillsActive && !warnData.criticalRecorded) {
      try {
        const traceScript = path.join(__dirname, '..', 'scripts', 'agent-skills-trace.js');
        spawn(process.execPath, [traceScript, 'checkpoint', `reason=context-critical`, `used_pct=${usedPct || 0}`], {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }).unref();
        warnData.criticalRecorded = true;
      } catch {
        // Context warnings must never break tool execution.
      }
    }

    fs.writeFileSync(warnPath, JSON.stringify(warnData));

    const message = isCritical
      ? isAgentSkillsActive
        ? `CONTEXT CRITICAL: Usage at ${usedPct}%. Remaining: ${remaining}%. Stop after the current atomic step. Do not start a new lifecycle phase. Update tasks/STATE.md and tasks/trace.jsonl, then tell the user to resume from tasks/STATE.md in a fresh session.`
        : `CONTEXT CRITICAL: Usage at ${usedPct}%. Remaining: ${remaining}%. Stop after the current atomic step and ask the user how to proceed.`
      : isAgentSkillsActive
        ? `CONTEXT WARNING: Usage at ${usedPct}%. Remaining: ${remaining}%. Avoid starting a new lifecycle phase. Prefer finishing the current atomic step and checkpointing tasks/STATE.md.`
        : `CONTEXT WARNING: Usage at ${usedPct}%. Remaining: ${remaining}%. Avoid unnecessary exploration or new complex work.`;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: (data.hook_event_name && data.hook_event_name.trim()) || 'PostToolUse',
        additionalContext: message,
      },
    }));
  } catch {
    process.exit(0);
  }
});
