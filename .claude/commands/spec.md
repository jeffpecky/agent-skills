---
description: Start spec-driven development — write a structured specification before writing code. Uses a researcher subagent to investigate the codebase.
---

Invoke the agent-skills:spec-driven-development skill alongside agent-skills:state-management.

## Phase 1: Interview + Research

Before writing the spec, understand what the user really wants:

1. **Interview the user** — one question at a time, with your best guess attached:
   - What are you building and why?
   - Who is this for?
   - What does done look like?
   - What's out of scope?
   - Stop when you can predict their reaction to the next 3 questions.

2. **Dispatch a researcher subagent** to investigate the codebase:
   - Prepare a research brief at `tasks/briefs/research-brief.md`
   - Include the confirmed intent from the interview
   - Researcher explores: patterns, tech stack, conventions, risks
   - Report written to `tasks/research.md`

3. **Read the research report** — codebase context without polluting your session

## Phase 2: Spec

Using the interview + research, write the spec:

1. **Objective** — what are you building and why? (from interview)
2. **Core features** — must-haves vs nice-to-haves (from interview)
3. **Acceptance criteria** — how will you know it's done? (from interview)
4. **Tech stack** — tools, libraries, frameworks (from research)
5. **Code style and patterns** — conventions (from research)
6. **Testing strategy** — how to verify
7. **Boundaries** — what to always do, ask first about, and never do

Save the spec as `SPEC.md` in the project root.

## Phase 3: State Update

Update `tasks/STATE.md`:
- Set Spec section: path = SPEC.md, status = approved
- Set Current Phase: phase = plan
- Add any key decisions from the spec discussion

Confirm with the user before proceeding to `/plan`.

## Rules

- **Interview first, always.** Don't skip to spec without understanding what the user really wants.
- **Research before asking.** Don't ask questions the researcher can answer.
- **Don't invent requirements.** The user decides what to build.
- **Be specific.** Vague specs produce vague implementations.
