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

## Admin redesign: authorized follow-up (2026-11-07)

The user explicitly requested publication of the accepted code followed by an
admin management redesign. This supersedes the earlier frontstage-only design
scope for the admin UI; business semantics, permissions and persistence remain
outside the visual redesign.

Fresh read-only SSH still requires Tailscale identity verification. Native Chrome
cannot continue that flow while the Mac is locked. The approved three-service
`bec1825` package passed all four SHA256 checks again; no upload, deployment or
service restart was attempted. Do not bypass this access boundary or claim a
production release.

All four existing independent role chats were actually retasked: PM
`01a1b373-b2f2-7b23-8991-b68230c880e3` (ADM-PM-001); design
`01a1b374-0957-7631-8ff0-296028a9f07c` (ADM-UX-001); development
`01a1b374-370d-78b1-8637-4b6b8f24a8d6` (ADM-DEV-001); QA
`01a1b374-0a54-7791-b73e-3c5e0649b1e3` (ADM-QA-001). The Leader owns this
record and publication. No role may expand the team.

Work continues in the retained primary checkout on
`codex/admin-workspace-redesign-20261107`, from clean `37fafdf`, whose tree
matched integrated main `31efb67`. `vp install` completed before work. The first
step is read-only page/workflow audit, followed by a frozen unified design and
single-owner implementation in admin source. Design owns the isolated baseline
preview on 4340; QA owns final preview on 4341. All API responses in visual
fixtures are intercepted; no real publication, moderation, upload or model call
is allowed. Preserve MOD-001 race, duplicate-write and focus behavior, and all
Assistant execution/recovery/approval semantics. Use existing Tailwind/local UI
primitives and theme tokens; no CSS Modules, dependencies or schema changes.

Evidence and recovery receipt:
`/Users/liaowenrun/.codex/visualizations/2026/11/07/01a1b1a3-9a22-7af0-8847-123cea344932/iteration-03`.

ADM-PM-001 scope was accepted after Leader reviewed the source evidence: all
12 route types plus login, grouped into navigation/hierarchy, writing, and
moderation/configuration/Assistant state presentation. Two concrete path defects
are in scope: mobile logout is hidden and the writing back action targets the
dashboard despite its article-management label. QA independently reproduced
unnamed moderation status controls and an unnamed file input in a real browser;
light-theme error contrast is being verified.

ADM-DEV-002 batch A is assigned solely to the development chat, in the existing
branch/checkout. Allowed edits are admin presentation source and necessary
adjacent regression tests. Frozen direction: use website paper/deep-ink semantic
tokens and existing fonts, restrained local controls, single main page title,
reachable mobile account/theme actions, lightweight list statistics and one
results surface. Article thumbnails use the existing `coverImageUrl` contract
and CDN association, with missing/broken-image fallback; no static cover mapping
or content mutation. Batch B covers independent writing and remaining pages.
Design and QA retain independent read-only review; no concurrent source edits.

The full ADM-UX-001 specification was frozen after actual baseline desktop/mobile
page traversal, with both themes and controlled API interception. It is saved as
`iteration-03/ADM-UX-001-design.md`. The baseline is an immutable copied dist on
4340, owned by design; it must not silently change during candidate builds.

QA documented six reproducible P2 issues in
`iteration-03/qa/ADM-QA-001-priority.txt`: mobile logout, writing back target,
unnamed moderation/audit filters, unnamed file input, light destructive-button
contrast (not error copy), and failed article reads displayed as zero/empty.
Twenty-eight scoped MOD race/focus baseline scenarios passed; these are baseline
results, not candidate acceptance.

To parallelize implementation, development explicitly transferred dashboard and
site-config file ownership to the Leader (ADM-ROOT-002); development retains all
other admin files and shared UI/contracts ownership. No overlapping edits.
Leader implemented the dashboard's plain metric strip/content/attention/activity
layout, preserving its original five API calls and metric definitions. Failed
reads display unavailable values and no false empty conclusion. Existing API
aggregation plus the meaningful failure regression passed (two tests). Site
configuration now groups display settings and announcements without unmounting
edited forms. Explicit refresh confirms discarding unsaved changes, is disabled
during writes, and prevents new edits during a pending read. Removed the duplicate
announcement refresh action. Narrow format/lint passed after canonical Tailwind
class corrections. Final independent browser and integrated checks remain pending.

The developer froze its source after admin typecheck/lint and 21 files / 180
tests passed (`adm-dev-005-freeze.json`). Leader reviewed integration boundaries:
all application changes are admin presentation or adjacent regression tests;
no business hooks, API transport, contracts, dependencies or migrations changed.
Shell/account/theme/navigation responsibilities now live in `components/admin`;
unused sidebar primitives and repeated presentation containers were removed.
Assistant uses actual remaining flex height rather than a guessed viewport offset.

Integrated candidate checks passed: `vp check` (618 formatted files, 555 lint/type
files, no issues), `vp test` (101 files / 578 tests), admin production build
(1107 transformed modules), and diff whitespace check. Root corrected four
Tailwind typography shorthand findings before the clean check. Logs are the
`iteration-03/integrated-*.log` files. Candidate browser, design and PM acceptance
are pending; these checks alone do not authorize an acceptance claim.

Candidate `8152e2f52d443927c5e7d299f8071edc5cb10a05` was committed/pushed and
opened as draft PR #7. CI run `42329317737` succeeded, including full existing
website/server checks. QA owns immutable candidate 4341 with the revision header;
design owns immutable baseline 4340. No product release has occurred.

Independent acceptance found concrete rework despite green source gates:

- PM reproduced the list total changing 12 to 4/3/1 with filters. Rename only
  the metric to matching articles; retain the original API/pagination semantics.
- QA and design independently found light-theme small-text/badge contrast below
  4.5:1 on card/muted surfaces. Correct actual combinations, not assertions.
- Design ADM-UX-F1 (P2) reproduced mobile split preview overlapping the textarea
  and edit mode clipping its bottom at 390x844. Fix natural mobile layout and
  deliberate scrolling without changing drafts/modes/Markdown behavior.
- Design ADM-UX-F2 (P3) confirmed a 2375px mobile configuration form with save
  only at its top. Leader added a normal-flow bottom save action sharing exactly
  the existing callback/busy state; narrow format/lint passed, browser recheck pending.

ADM-DEV-006/007 are assigned to the existing developer for contrast, metric label
and writing layout. Root retains site-config ownership. Do not overwrite 4341
while current acceptance finishes. QA's complete MOD regression passed 94/94,
including delayed dialog-close animation and narrow-screen focus; no hooks changed.
PM's independent narrow logout, writing return/recovered draft, configuration
section preservation and cancelled refresh checks passed. Final acceptance is
not yet complete. Leader inspected the actual candidate article, Assistant,
dashboard and configuration screenshots, and reviewed source boundaries.

Leader also found incorrect URLs in part of the QA scan harness (`/site/config`,
`/oauth/authorize`, `conversationId`). These are validation mistakes, not product
regressions. QA must preserve the failed evidence, correct the harness to actual
`/site`, `/oauth/device` and `conversation` routes, assert intended business
content, and fill the resulting coverage gap before reporting final acceptance.

006/007 rework is frozen: mobile split now flows vertically and edit mode has
an explicit scroll container; textarea height follows the available viewport
without the previous 420px overflow constraint. Light muted text and badge
combinations were corrected using existing semantic/scale colors; dark values
were retained. The list total is labeled matching articles. Root added bottom
configuration save with the same handler and shared busy state.

Integrated rework checks passed: `vp check` clean, 101 files / 579 tests, admin
production build. Logs are `iteration-03/final-*.log`. No image/source upload or
production restart occurred. QA's old-candidate report is
`iteration-03/qa/ADM-QA-002-report.md`: complete MOD 94/94 passed; all 52 actual
page identities and 14 behavior scenarios passed; only mobile writing layout
and light contrast blocked acceptance. Incorrect harness URLs/selectors were
retained as failed validation evidence and excluded after corrected rechecks.
A new immutable candidate is required to accept the fixes; old green evidence
is not a substitute for that targeted browser recheck.

Recheck candidate `94627369ff473b946bef8662a16c358b7547f5e2` passed PM-003,
CI `42330146741`, all previous light contrast/mobile layout/statistics/config
checks, and source gates (579 tests). It is still rejected for publication:
QA and design independently found the same remaining F1-family defect at
1366x600: expanded publication settings compress edit-mode textarea content to
zero height. QA's 81 passed scenarios do not cancel its two added geometry
failures. Source/JSON/screenshots and reports are retained under `qa`/`ux-003`.

ADM-DEV-008 fixes only three desktop layout classes: natural minimum-full-height
fields, a 288px minimum Markdown area and a 192px minimum textarea. The existing
outer scroll area carries expanded properties. Mobile layout, business state
and handlers are unchanged. Developer lint/typecheck and 17 writing tests passed;
real minimum visible height still requires the next immutable candidate.

The 9462736 three-service package was prepared and SHA256/image IDs/platform/
revision verified at `iteration-03/prebuilt-final` (240 MiB archive); it is now
explicitly rejected pending replacement and MUST NOT be published. The latest
read-only production SSH check timed out; the native identity flow is still
unavailable with the Mac locked. No upload, restart, policy change or access
bypass occurred. Keep existing packages as evidence; select only a subsequently
accepted release for the next publication attempt.

## Admin redesign acceptance and production recovery

Application `0e7ffc5fec3714d382349227a5db7e845da4d2ef` is accepted. Leader
reviewed the source boundary, actual 1366x600 screenshot and version-bound
independent reports. QA-004 passed 12 scenarios / 72 measured geometry states;
UX-004 independently passed 16 distinct states plus stability confirmation.
The textarea has at least 220px outer / 202px content height, seven visible
28px lines, with actual editing, outer/inner bottom scrolling and retained
mode/cloud-draft content. The prior zero-content-height defect is closed.
Other accepted evidence remains scoped: MOD 94/94; the corrected page identity,
contrast, statistics, configuration save/refresh and PM matrices in rounds
002/003. Later tests did not pretend to rerun unchanged behavior.

Final app gates: clean `vp check`, 101 files / 579 tests, admin production build;
CI `42331118421` succeeded, including server/website builds, HTTP and browser
checks. Before the final local pass, native checking temporarily could not
resolve Vitest in server specs even though package/type files existed.
`vp env doctor` passed; `vp install` completed without dependency/lock changes,
then all gates passed. The initial failure is retained as
`iteration-03/runtime-resolution-failure.log`; its precise transient cause was
not established, and no assertion/configuration was weakened.

The next release bundle must be built from this accepted code or a proven
documentation-only descendant, with exact revision, checksums and image IDs
recorded in `iteration-03/release-pending.json`. The rejected 9462736 package
and older candidates MUST NOT be selected. Source acceptance is not production
acceptance: no upload or restart has occurred. Latest normal SSH reaches an
explicit Tailscale identity-verification gate; the native login flow cannot
continue while the Mac is locked. Earlier TCP timeouts did not lead to any
network, credential or permission changes.

When normal authorized access resumes, first read actual production version,
protected Caddy/host configuration, active routes/containers, memory/storage and
Assistant RUNNING/CANCELLING counts. Retain serving images and use the existing
prebuilt publisher for all pending server/website/admin code. The server still
requires its bounded single-instance restart; never start a parallel API. No
migration was introduced. Verify actual versions, public routes, health and
affected paths after publication; deployment output alone is not acceptance.

The four role chats remain reusable. A next-round candidate is being investigated
read-only: `AdminAccount` inherits `logoutAdmin().finally(onLogout)`, which may
clear only frontend identity after a failed logout. PM must reproduce with
isolated 503/abort and canonical identity/reload evidence before any fix is
selected; this is not yet a confirmed defect or an accepted implementation.
No unattended background recovery/iteration was scheduled.

## Round 4: logout failure recovery

The admin redesign merged as PR #7 /
`8c96d56729dfd43d5a04f8e395d802bdff67a563` after final head CI
`42331674070` succeeded. Its tree exactly matches release source
`82ce826f581d36494b33c620e461ea23b6e67f16`; the verified three-service package
is `iteration-03/prebuilt-accepted`. It remains unpublished at the normal
Tailscale identity check, with no production upload/restart.

LOGOUT-PM-001 confirmed a separate P2: the shared account control calls
`onLogout` in `finally`, so 503/network failure opens the login gate without
feedback while canonical identity remains valid; reloading shows the admin
again, and the rejected promise creates a page error. A successful-logout
control stays unauthenticated on reload. This is isolated fixture evidence,
not a real production logout or a newly introduced redesign regression.

Selected scope LOGOUT-001: consume all failures; clear frontend identity only
after confirmed logout; show pending and explicit unconfirmed-result/retry/close
feedback while preserving page/input state. The real `POST /api/auth/logout`
returns 204 after deleting the session and clearing the cookie, has no auth
guard, and its repository deleteMany is idempotent. Retrying the same logout is
safe; an extra auth/me query is unnecessary and user:null would not prove the
logout itself succeeded. No backend, OAuth, permissions, credentials, API shape,
database, dependency or Agent change is selected.

Work reuses the primary checkout on `codex/admin-logout-recovery-20261107`,
from clean merged `8c96d56`; `vp install` completed before implementation.
PM owns LOGOUT-PM-001 discovery/acceptance; design owns LOGOUT-UX-001; the
existing developer exclusively owns LOGOUT-DEV-002 account UI, one necessary
transient logout coordinator/dialog and Shell/Writing assembly plus adjacent
behavior tests; QA owns LOGOUT-QA-001 independent validation and the 4341
candidate service. Leader owns this record and integration/release. Roles and
chat IDs remain those recorded above; no team expansion or concurrent source
ownership.

Design freezes a 44px trigger with readable pending state; a single local
AlertDialog explains an unconfirmed result and offers retry/close. Desktop and
mobile account triggers coexist in Shell, so they share one in-flight lock and
one dialog. Closing feedback does not cancel HTTP or imply successful logout;
Escape/close returns focus to the currently visible trigger, including after a
breakpoint change. Retry busy state is explicit and feedback remains closable.
Only the API's success invokes the existing onLogout callback.

Acceptance: success then unauthenticated reload; 503/abort retains page with
feedback and no pageerror; lost response then explicit idempotent retry works;
rapid clicks or a breakpoint switch create only one pending request; closing
creates zero new requests and preserves page drafts; keyboard/focus/bright/dark
and mobile/sidebar/writing entries remain usable. All writes are local fixture
only. New evidence lives under
`/Users/liaowenrun/.codex/visualizations/2026/11/07/01a1b1a3-9a22-7af0-8847-123cea344932/iteration-04`;
initial read-only discovery evidence may remain at its original round-3 paths.

LOGOUT-DEV-002 froze a single transient page-level coordinator and pure account
triggers. Shell shares it between responsive entries; Writing creates one for
its independent page. The in-flight lock prevents duplicate requests, all API
failures are consumed, and only confirmed success clears frontend identity.
One existing AlertDialog provides retry/close; closing during retry preserves
the HTTP operation and restores the currently visible, focusable guarded
trigger. Unmounted owners cannot clear a later page. No API/canonical identity
query or session store was added. Leader reviewed the actual fetch-boundary
tests, callback ownership, focus candidates and one-coordinator assembly.

Integrated candidate gates passed: `vp check` (620 formatted / 557 lint-type
files), 102 files / 588 tests, admin production build and whitespace check.
Logs: `iteration-04/check.log`, `test.log`, `admin-build.log`. Independent
candidate browser/product/design acceptance and production remain pending.
QA independently reproduced five baseline failures and prepared 16 scenarios;
all baseline and candidate evidence must remain separate.

LOGOUT candidate `13f01aaa21dd68d4e421ab82130232f7da86ebfd` is PR #8
(draft). PM-002 passed its four scoped outcome/retry checks; QA's original
16 scenarios and strengthened cross-breakpoint visible-trigger focus checks
passed. Design then found, and QA independently reproduced, a new P2: pure
Close -> Tab -> Retry -> Enter -> held response -> repeated Tab/ShiftTab can
leave the still-open dialog when the focused Retry becomes native disabled.
Mouse close/Escape passing cannot substitute for this keyboard path.

LOGOUT-DEV-003 owns only the coordinator and its adjacent regression test.
Transfer focus to the usable Close control before disabling the focused retry
button; retain closable pending feedback and all previous semantics. Never
change the shared primitive or force-focus a control in browser tests to hide
the failure. Preserve old version-bound failure evidence under
`iteration-04/logout-ux-002` and `qa/logout-keyboard`. New targeted pure-keyboard
acceptance is required before the PR can leave draft. Production is unchanged.
