# Assessment Helper — Weekly Team Report

CS 4485 | Week of September 14–20, 2026

**Team:** 08 *(confirm — inferred from the reviewer's "Team 08:" address on the 9/10 correspondence)*
**Point of Contact:** Zain *(placeholder — confirm who's POC this week; can rotate)*

---

## 1. Completed Work

| Owner | Completed Outcome | Issue / PR / Evidence | Status |
|---|---|---|---|
| Zain | Wrote standalone requirements definition consolidating kickoff (9/4) + follow-up Q&A (9/11) decisions | `docs/requirements.md` (not yet committed/pushed — needs a PR link before submission) | Complete |
| Zain | Corrected sprint plan doc to replace focus-area observer matching with the corrected course-level + same-school rule from the 9/11 meeting | `docs/evalhub-mvp-plan.md` | Complete |
| Zain | Deleted `docs/Assessment_Helper_MVP_Plan.md`, a duplicate/rougher draft of the sprint plan that had drifted out of sync with `docs/evalhub-mvp-plan.md` | n/a (file removal) | Complete |
| Zain | Updated evaluation-frequency, evaluation-form, and criteria sections across planning docs to match 9/11 corrections | same files as above | Complete |
| *(Frontend/Backend rows — fill in)* | | | |

**Note before submitting:** none of the doc changes above have a GitHub PR yet — they're local file edits. Commit + open a PR and swap the evidence column to the real PR link so this row has a "specific ... link," per the template's own instruction.

## 2. Individual Contributions & Time by Task

| Team Member | Role | Task / Outcome | Hours | Evidence Link |
|---|---|---|---|---|
| Aurore Ngalamo | Frontend | *(fill in)* | *(fill in)* | *(fill in)* |
| Onkar | Frontend | *(fill in)* | *(fill in)* | *(fill in)* |
| Prethel | Backend / Data | *(fill in)* | *(fill in)* | *(fill in)* |
| Fabian | Backend / Data | *(fill in)* | *(fill in)* | *(fill in)* |
| Zain | Integration & Auth / PM / QA / Docs | Wrote `docs/requirements.md`; corrected matching/frequency/form rules in both sprint-plan docs | *(fill in)* | `docs/requirements.md`, `docs/evalhub-mvp-plan.md` |

**This table is exactly what last week's reviewer feedback flagged as missing — don't leave any row's Hours column blank.**

## 3. Planned Work for Next Week

| Owner | Planned Task / Outcome | Target Date |
|---|---|---|
| Prethel / Fabian | Finalize DB schema / ERD (Professors, Courses, Assessments, Observations, Users) reflecting course-level (not focus-area) matching fields | *(fill in)* |
| Onkar / Jeoungjin / Aurore | Scaffold React + Vite frontend, login screen | *(fill in)* |
| Zain | Agree on API contract (routes + payload shapes) with backend; scope JWT auth middleware and role checks | *(fill in)* |
| All | Commit and push current docs work (requirements.md, corrected sprint plan) as a reviewable PR | *(fill in)* |

*(This is drafted from the Week 0 deliverables in `docs/evalhub-mvp-plan.md` — adjust dates/owners to what the team actually intends.)*

## 4. Risks and Blockers

| Risk / Blocker | Possible Impact | Proposed Action | Owner |
|---|---|---|---|
| Sprint plan was built before a written requirements doc existed; already caused one stale-plan incident (focus-area vs. course-level matching) | Future scope decisions could drift from advisor intent again | Requirements doc now exists (`docs/requirements.md`) and sprint plan corrected; treat requirements as living doc going forward | Zain |
| TA not yet assigned as of 9/11 meeting | Unclear who to check in with weekly / when official cadence starts | Confirm TA assignment status at next opportunity | *(fill in)* |
| UTD CourseBook API access path still unresearched | Could block real data integration later in the semester | Continue with manually downloaded course data for POC per advisor guidance; research API access opportunistically | Zain |

## 5. Decisions

| Decision | Who Decided | Reason | Alternative Rejected |
|---|---|---|---|
| Write a standalone requirements document rather than relying on meeting notes alone | Zain (in response to reviewer feedback) | Reviewer flagged that the sprint plan was built without a clear requirements definition; the plan was already stale one day after posting because of this | Continuing to reference scattered meeting-note PDFs without a consolidated doc |
| Correct "focus-area" matching language to "course-level" matching across all planning docs | Zain | 9/11 meeting explicitly changed this rule; docs must stay consistent with latest advisor guidance | Leaving old docs as-is and only applying the new rule in code |

## 6. Meeting Minutes

*(Fill in per actual meeting(s) held this week — none captured in this draft.)*

Meeting Date:
Meeting Type: Team / Advisor
Attendance:
Key Discussion:
Decisions:

| Action Item | Owner | Due Date |
|---|---|---|
| | | |

## 7. Checkpoint Evidence

| Evidence | Direct Link | What It Shows |
|---|---|---|
| Requirements definition | `docs/requirements.md` | Consolidated, sourced requirements covering personas, matching, frequency, forms, KPIs |
| Corrected sprint plan | `docs/evalhub-mvp-plan.md` | Sprint plan reconciled with 9/11 meeting decisions |
| *(Frontend/backend evidence — fill in once there are PRs/screenshots)* | | |

## 8. AI Use Log

| Member | Tool / Model | Purpose | Artifact Affected | How Output Was Verified |
|---|---|---|---|---|
| Zain | Claude Code (Claude Sonnet 5) | Read kickoff + 9/11 meeting PDFs and reconciled them into a written requirements doc; corrected stale focus-area matching language in sprint-plan docs; drafted this weekly report | `docs/requirements.md`, `docs/evalhub-mvp-plan.md`, `docs/Assessment_Helper_MVP_Plan.md`, this report | Cross-checked every claim against the source PDFs in `docs/notes/meeting1` and `docs/notes/meeting2`; reviewed by Zain before submission |

---

**Before submission checklist (per the template):**
- [ ] Every member's row in §2 has real hours filled in
- [ ] Meeting minutes (§6) attached for any meeting actually held this week
- [ ] Evidence links (§1, §7) point to real GitHub PRs/issues, not local file paths
- [ ] Exported as a single PDF
