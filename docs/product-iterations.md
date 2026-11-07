# Product iteration log

Leader owns this recovery record. Facts below are observed; proposed improvements
remain hypotheses until reproduced. No usage, conversion or revenue claims are
inferred from this work.

## Operating boundaries

- Personal publishing system: public reading/discovery, comments and guestbook;
  administration, API and CLI support publication and moderation.
- Reuse existing design, Tailwind, feature boundaries and deployment scripts.
- No purchases, external messages, destructive production-data tests or expanded
  account privileges. Production verification reads business data only.
- Each role reports evidence; Leader selects scope, integrates and releases.
  Roles may not expand the team or deploy independently.

## Session map

| Role        | Local chat ID                          | Responsibility / write boundary                                 |
| ----------- | -------------------------------------- | --------------------------------------------------------------- |
| Leader      | `01a1b1a3-9a22-7af0-8847-123cea344932` | Integration, release and this record                            |
| Product     | `01a1b373-b2f2-7b23-8991-b68230c880e3` | PM-001 read-only discovery, then acceptance                     |
| Design      | `01a1b374-0957-7631-8ff0-296028a9f07c` | UX-001 real-page read-only audit, then UI acceptance            |
| Development | `01a1b374-370d-78b1-8637-4b6b8f24a8d6` | DEV-000 read-only preparation; implementation awaits assignment |
| Test        | `01a1b374-0a54-7791-b73e-3c5e0649b1e3` | QA-001 read-only regression, then independent acceptance        |

These are actual independently created Codex chats. Leader reads progress and
sends follow-up assignments through the desktop chat tools. Investigation chats
share the checkout read-only; implementation receives explicit ownership and an
isolated worktree where appropriate.

## 2026-11-07 — round 1, investigation

### Baseline and evidence

- `vp install` completed successfully before research/development.
- Root and website `AGENTS.md`, README, website guide, Assistant standards and
  feature-local Assistant constraints read. No Assistant change selected.
- Local `main` and `origin/main`: `2bf7f26`; initial checkout clean.
- Production source: `819ad69`, with no file differences from `2bf7f26`.
- Production website: `f60504b`; admin: `62f72c7`; API: `819ad69`.
  SSH observed all three healthy. ERP, databases and Caddy running.
- Recent history already fixes discussion/read failures, draft races, reading
  accessibility, standalone starts, HTTP parsing and anonymous quotas. Those are
  not new work without new reproduction evidence.
- Root integration branch: `codex/product-iterations-20261107`.

### Selected scope — MOD-001

PM reproduced two P2 issues with actual moderation components and controlled
in-memory responses: an older list request overwrites a newer filter; confirmed
moderation only replaces a row, leaving filter membership and counts stale.
Leader independently traced both unguarded effects and row-only mutation paths.
No production mis-moderation is claimed.

Goal: comments and guestbook moderation always present the current query's
authoritative rows, count, ordering and valid page after confirmed changes.
Non-goals: API/contracts, new frameworks, bulk moderation and visual redesign.

Acceptance:

- Older success, failure and completion cannot affect the newest query's rows,
  count, errors or loading. Loading hides old actionable rows and pagination.
- Confirmed hide/restore/delete/pin changes re-read the current query; late
  mutation results cannot switch back to a query the administrator has left.
- A cleared final page returns to a valid page; ALL retains updated rows and
  pin changes use server ordering.
- A confirmed write followed by a failed read says the operation succeeded and
  refresh failed. It never automatically repeats a write or reports write failure.
- Current row operations prevent duplicate submission. Unmount/late responses
  cannot update another screen. Desktop, narrow, keyboard and themes checked.

### Ownership and progress

- DEV-001 assigned to Development chat in isolated worktree
  `/Users/liaowenrun/.codex/worktrees/moderation-consistency/adrian-zephyr-notes`,
  baseline `2bf7f26`, branch `codex/moderation-consistency-20261107`.
- Allowed: admin `features/comments`, `features/guestbook`, adjacent tests and a
  necessary shared moderation hook with real consumers. No dependency, lock,
  contract, server or website edits; no push/deploy. Leader owns integration.
- UX-001 supplied the state design before implementation. QA-001 prepares
  independent delayed-response browser checks; PM will verify original goals.
- No new application change or production release claimed for this round yet.

### Candidate verification

- Development candidate: `800e1534d1a2ce123c8477fd1adaffa048ead2ac`, integrated
  as `ed65eb1` on Leader's branch; same application diff (four admin files).
- Removed duplicated unguarded list effects and row-only mutation updates.
  One shared hook now serves both real moderation screens. No new dependency,
  contract or server behavior.
- Leader independently reviewed ownership, late writes, page correction,
  confirmation, failure classification and both consuming components.
- Integrated `vp check`: no formatting, lint or type errors. `vp test`: 99 files,
  532 tests passed. Admin production build passed. Expected error logs from
  persistence-failure tests do not represent failed tests.
- Actual production-build preview: `http://127.0.0.1:4318`; QA-002, UX-002 and
  PM-002 independently assigned. Acceptance and production publication pending.
- PM's original eight assertions pass on the candidate and still fail on the
  original baseline; only actual import/environment resolution was adapted.
- UX-002 found MOD-F1: confirming moderation and replacing the list loses
  keyboard focus to BODY. Publication paused; DEV-002 assigned to the same
  owner/worktree. Restore a surviving row's available action or a stable result
  region after operation-caused focus loss, without stealing deliberate focus
  from a search/filter/new screen. QA and design must recheck the final fix.
- Draft review: PR #3, branch `codex/product-iterations-20261107`.
  First prebuilt candidate `279e639` is not approved for production.
- MOD-F1 fixed in development `61eab728`, integrated as `70ab885` with identical
  admin code. Leader reviewed focus ownership and dialog-close sequencing.
- Final integrated checks: `vp check` passed with no warnings/errors, `vp test`
  passed 99 files / 548 tests, admin production build passed.
- QA-003 independently passed 94 browser scenarios. UX-003 passed 26, including
  immediate responses during a deliberately prolonged dialog exit animation.
  PM-002 passed the original eight regression assertions and 12 browser cases.
  All writes were intercepted in memory; no real moderation or authentication
  success is claimed. Real unauthenticated moderation endpoints returned 401.
- CI run `42322330274` failed the pre-existing mobile carousel test before any
  touch input: a node from Next's still-streaming content detached while the test
  awaited scroll stability. QA-004 independently confirmed loading/hidden stream
  segments in the trace and no script error; no runtime swipe defect reproduced.
  The test now proves Next/Previous controls work before raw touch dispatch;
  the original swipe and no-navigation assertions remain. Four bounded local
  repetitions pass; formatting/lint pass. Full website production build and
  browser suite pass (20 cases; two existing desktop-inapplicable mobile cases
  skipped). QA-004 reviewed the change independently. Updated CI pending.

### Release constraint

Production preflight was stopped by Tailscale SSH requiring additional identity
verification. Existing browser access was attempted: browser-control requests
timed out; native Chrome opened the official verification flow but it remained
blank, with no usable sign-in controls. No authentication/network protection was
changed or bypassed. The pending read-only SSH request was terminated. No release
upload, route switch or production mutation occurred in this round.

Code acceptance is complete; production publication is pending restored SSH
access. Preserve the old admin `azn-admin-62f72c73d9a0-1793995929` for rollback
when publishing resumes. Re-capture a fresh production baseline and build the
exact final approved revision; do not publish the superseded `279e639` candidate.
Continue independent development while this external release constraint remains.

- Evidence root:
  `/Users/liaowenrun/.codex/visualizations/2026/11/07/01a1b1a3-9a22-7af0-8847-123cea344932/iteration-01`.

### Backlog

- P2: PM reproduced unsent comment/guestbook text loss across login document
  remount using actual hooks and mocked 401/navigation. Candidate for round 2;
  real OAuth return remains unverified. No cloud drafts or automatic resubmission.
- P2: QA observed `/api/articles/UPPERCASE` returns 500 and the matching page
  presents a retryable service error. Invalid slug fails before persistence or
  summary generation. Evidence: `/tmp/azn-qa-001/public-findings.txt` and HTTP log.
- P3: OAuth cancellation returns `?auth=failed`, but discussion UI ignores it.
  Real callback cancellation branch checked; successful OAuth not reverified.
- P3: Design observed four Markdown table regions with the same accessible
  name in the real OSS/CDN long article. Mobile light/dark axe reports
  `landmark-unique`; evidence: `/tmp/azn-ux-001/table-landmarks.json`.
- Large discussion page indices were not reproduced as a bug: PM-003 issued
  exactly one GET per list at `page=9007199254740991&pageSize=1`; both returned
  200 and empty collections. No repeated scan or pagination change selected.
  Real database tests are optional locally and absent from CI;
  no claim that fixture-browser tests cover persistence or authentication.

Investigation evidence lives in `/tmp/azn-pm-001`, `/tmp/azn-qa-001` and
`/tmp/azn-ux-001`. PM's baseline harness reproduced eight failing cases without
real network calls. CLI authorization is expired (`AUTH_EXPIRED`); authenticated
production moderation checks are limited to an existing browser session if
available. No new credentials or privileges are requested.

### Recovery

Read this record and current Git status before proceeding. Retrieve the four
chats above, select at most 1–3 evidence-backed issues, assign implementation,
independently verify, then release the exact tested version using the existing
prebuilt workflow. A release command success alone does not count as acceptance.
