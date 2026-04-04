# Agent team (plan → code)

This repository defines **roles** for phased work: planning, implementation, and maintenance of the team’s own documentation. There is **no separate leader role**—the **planner** owns plan files and naming; the **coder** implements from `plans/pending/` and archives finished plans. Use separate conversations or `@agents/...` for the active role (planner, coder, reviewer, or master).

## Roles

| Role | File | Responsibility |
|------|------|----------------|
| **Planner** | [`agents/planner.md`](agents/planner.md) | Turns goals into executable plan files under `plans/pending/` with the **correct filename**. |
| **Coder** | [`agents/coder.md`](agents/coder.md) | Reads plans from `plans/pending/`, implements, then **moves or renames** the plan into `plans/done/` and continues with the next pending plan when asked. |
| **Reviewer** | [`agents/reviewer.md`](agents/reviewer.md) | Audits **`plans/done/`**: confirms work is real (not moved by mistake); sends plans back to **`plans/pending/`** when not. Also optional plan/code review with verdict. |
| **Master** | [`agents/master.md`](agents/master.md) | Creates and updates `AGENTS.md` and `agents/*.md` from your prompts and reviewed work. |

## Recommended flow

1. **User** gives the goal to the **planner** (or uses `@agents/planner.md`).
2. The **planner** writes a single Markdown file under **`plans/pending/`** using the **mandatory naming pattern** (see planner doc). That file is the only canonical plan.
3. The **coder** (`@agents/coder.md`) takes the next plan from **`plans/pending/`** (or the path the user specifies), implements all steps, runs verification from the plan, then **archives** the file under **`plans/done/`** (move preferred; rename only if needed to avoid collisions—see coder doc).
4. Recommended after archive: the **reviewer** checks **`plans/done/`**—each file must match real implementation (see `agents/reviewer.md`, including human-play stub checks). If a plan landed in `done/` by mistake, the reviewer has it **moved back to `plans/pending/`**, status **pending**, with notes; the **coder** fixes and may re-archive only when actually complete. The reviewer may also review pending plans or diffs before/without that audit.
5. Repeat: coder proceeds to the **next** file in `plans/pending/` when the user wants continued implementation.
6. Optional: **master** updates agent docs when process lessons or roles change.

## Project rules

All roles must follow `.cursor/rules/` and the guidance in `AGENT.md` / `TASKS.md` when work affects the autonomous bot.

## Handoff convention

Between planner and coder (and the user), pass:

- **Goal** in one sentence (user → planner).
- **Plan path** — e.g. `plans/pending/2026-04-04-feature-slug.md` (planner creates it; user or coder notes it).
- **Status** — which plan steps are done when resuming mid-plan.
- **Verifiable criteria** — commands and expected behavior (already inside the plan file).
