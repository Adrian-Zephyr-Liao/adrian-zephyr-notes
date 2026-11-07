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
- Updated CI `42323259322` passed all quality/build/browser gates. PR #3 merged
  as `49b291f0a4b27bbe325457924b2ca248bafe92e8`; code is integrated, with production
  publication still constrained below.

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

## 2026-11-07 — round 2, DRAFT-001

Goal: preserve unsent discussion text through a same-tab login round trip and
explain an unsuccessful login. PM's actual hook/remount reproductions and QA's
real cancellation callback are the baseline evidence. No cloud drafts, automatic
posting, cross-device syncing or change to authentication requirements.

Acceptance:

- Persist before login navigation; restore exact body and guestbook nickname
  after success, cancellation or failure. Isolate article drafts by slug.
- Revalidate a stored reply ID against loaded comments. Unresolved replies keep
  their text and require explicit selection or conversion to a new comment.
- Clear only after a confirmed publication; rejected/unknown results preserve
  text. Late responses cannot clear another article's or newer draft.
- Storage failure retains the editor and prevents a lossy login redirect.
  Offer copy/retry and explicit continuation after copying.
- `auth=failed` displays a clear login-not-completed message and retry path.
  Reuse existing forms, Tailwind, focus conventions and request adapters.

DEV-003 assigned to the existing Development chat in a new isolated worktree:
`/Users/liaowenrun/.codex/worktrees/discussion-drafts/adrian-zephyr-notes`,
baseline `70ab885`, branch `codex/discussion-drafts-20261107`.
Allowed: website comments/guestbook workflows, necessary real shared draft code,
adjacent tests and minimal route/reading prop plumbing. No dependencies, lockfile,
contracts, backend, admin or Markdown changes. Leader owns this record.
QA, design and PM prepare independent evidence outside the checkout. Real OAuth
success and real production writes remain outside fixture validation.

Candidate `fc2228e` integrated as `811b0c6`. Leader reviewed storage validation,
revision-based clearing, reply resolution, login navigation and both consumers.
Unlogged readers can edit recovered text; publication still requires login.
Integrated formatting/lint/type checks and website production build passed.
Full tests found a draft test submitting after restore before the read became
ready, and a deployment-shell test timing out during parallel compilation.
Deployment tests passed 8/8 in isolation without changing assertions/timeouts;
DEV-004 fixes the draft test's actual readiness precondition.

UX-004 reproduced DRAFT-F1: POST confirmed, storage removal failed, and reload
restored posted content with an incorrect "unpublished" claim. Publication is
blocked pending a revision-safe clearing fallback and conservative recovery
wording. Leader also requested an actual-hook reproduction for empty forms whose
login was blocked by unavailable storage. QA/UX must recheck the final candidate;
preserve all original failure evidence.

Final correction candidate `3e7be632` integrated as `2b3f8d2`: empty forms can
log in without touching unreadable storage; exact submitted revisions use an
empty-record fallback if removal fails; restored content asks the reader to
verify publication rather than claiming it was never published. Rechecked by
Leader. Sequential integrated `vp check`, all 564 tests and website build passed.
QA-007, UX-005 and PM-007 are independently rechecking the corrected build.
PM-007 passed six incremental cases; UX-005 passed 16 actual browser states,
including both cleanup failures and inaccessible storage, after verifying the
served chunk bytes match the frozen build. QA-007 independently passed 49 browser
cases and confirmed resource identity stayed fixed; no remaining scoped blocker.
PR #5 passed CI `42325084983` and merged as
`14ea4f3e905fa34b006455de7a379336e7b4f596`. This is code acceptance, not production.
Shared draft types were moved to local `types.ts` per website conventions;
only type imports changed, with website type checking afterward.

### Independent address boundary — ADDR-001

Leader owns the previously reproduced invalid article-address 500 in a separate
`article-address-boundary` worktree, baseline `10adf5c`. Allowed changes: article
slug validation error, public detail error mapping and adjacent/compiled HTTP
regressions. No model, query, dependency, database or other feature changes.

Candidate `3d0a799b753ebb0690bfd9e49f812d7a7829701d` changes three files. A compiled
HTTP regression first failed with expected-404/actual-500, then all six HTTP cases
passed after the fix. Server build, `vp check` and 548 unit tests passed. QA-005
and PM-005 independently assigned; no production verification claimed.

Development independently reviewed the three-file address diff: no blocker;
domain error remains HTTP-independent and real repository failures still escape.
PM-005 independently passed 11 actual compiled-HTTP cases, including valid
synthetic content, trim compatibility, and ordinary errors spoofing validation
error text/name that correctly remain 500. No UI/production acceptance claimed.

QA-005 independently rebuilt the actual controller/use-case in a temporary
directory and passed 20 HTTP boundary cases, plus the six existing HTTP tests.
Source/build hashes matched, invalid addresses made zero repository/summary
calls, and valid content plus real failure paths retained their behavior.
No actual Next UI, production database or model call was exercised.
PR #4 passed CI `42324488037` and merged as
`811875c3837e5e9de514f058ed6bc6a4f8e9c1cd`. Production remains unchanged by this work.

Accept invalid slugs as `404 / ARTICLE_NOT_FOUND` before repository or summary
execution, keep legitimate missing articles as 404, and preserve actual repository
failures as 500. The website should then use its existing not-found path. PM and
QA will independently verify the compiled controller and real use case with
controlled repository/summary boundaries. Production release still requires
restored SSH and the documented single-instance API maintenance procedure.

### Selected accessibility follow-up — TABLE-001

Reuse UX-001's duplicate table region-name evidence. An isolated
`markdown-table-names` worktree starts at `49b291f`; DEV-005 is assigned to the
existing Development chat on `codex/markdown-table-names-20261107`, following the
DRAFT correction freeze. Follow-up scope: shared Markdown table names
and adjacent regression coverage, retaining styling, keyboard focus and horizontal
scrolling. Names must be meaningful and unique even with repeated headers; no
opaque IDs, source-line names, article/CDN mutations or new dependency. This is
the third bounded round-2 item, not an open-ended redesign.

Candidate `1f799718` integrated as `5be5101`. Leader reviewed the single GFM AST
pass, meaningful bounded context, document-local ordinal, three render modes and
unchanged scrolling markup/styles. PM-008 verified repeat-render/view stability;
UX-006 passed four complete axe scans and 16 focus/scroll checks on desktop/375px
and both themes. QA-008 independently passed its desktop/mobile matrix, nine
targeted existing tests and 11 additional server/document/stream cases. No scoped
blocker remains. PR #6 passed CI `42325911351` and merged as
`61523ae9dcf55602ae803dec78ba5b1ddca6f44f`.

Final integrated source checks: `vp check` clean; 100 files / 568 tests passed;
server, website and admin production builds passed; compiled HTTP six cases
passed; full desktop/mobile website browser suite passed 20 cases with the two
existing desktop-inapplicable mobile cases skipped. Tests use isolated fixtures,
not production persistence, successful OAuth or actual assistive hardware.

The earlier isolated 500-to-404 HTTP proof and a real Next browser check against
a controlled 404 backend verify both boundaries separately. They do not constitute
a deployed end-to-end check.

## Final checkpoint and recovery

Both rounds are code-accepted and merged. Production publication is blocked,
not complete. Final read-only public probes returned 200 for the website, admin
and site configuration; the known invalid-slug endpoint still returned 500,
consistent with the fix not having been deployed. No business writes were used.

The approved application release is `bec1825383b565c213329c1fa2fc14b5f9125d28`.
Its complete tree matches merge `61523ae` before this documentation checkpoint.
The three `linux/amd64` images (`server website admin`), source bundle and verified
SHA256 manifest are ready at:

`/Users/liaowenrun/.codex/visualizations/2026/11/07/01a1b1a3-9a22-7af0-8847-123cea344932/iteration-02/prebuilt-final`

The compressed image archive is approximately 230 MiB. `release-pending.json`
beside it records the exact revision and the absence of any upload/deployment.
The older `279e639` candidate is superseded and must not be published.

Resume in the canonical checkout:
`/Users/liaowenrun/Desktop/Code/github.com/Adrian-Zephyr-Liao/adrian-zephyr-notes`.
Read Git status, this record, the four role chats and the evidence receipts.
Three completed managed worktrees were archived with recoverable snapshots.
The TABLE worktree is protected as this chat's primary checkout; retain it and
synchronize its source with integrated main rather than bypassing that protection.
All owned previews/fixtures (4324/4325/4334/4335) were stopped after acceptance.

Next actionable task: restore the existing SSH identity-verification flow, then
capture a fresh production baseline and use the existing prebuilt publisher.
The API requires the documented bounded single-instance maintenance restart;
verify active Assistant work and compatibility first. Frontends use healthy
candidates and a Caddy switch. No database migration is introduced by these rounds.
Retain the currently serving images and protected host configuration; verify
actual revisions, routes, health, resource state and affected paths after release.
Use the documented rollback on a release regression. Do not turn a successful
upload or deploy command into a production-acceptance claim.

CLI authentication and actual GitHub OAuth success remain unverified/expired;
fixture results do not substitute for them. No unattended recovery or scheduled
iteration was installed. Code investigation is closed for this window; do not
manufacture more changes while publication awaits an external access condition.
