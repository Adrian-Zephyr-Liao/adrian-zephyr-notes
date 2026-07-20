# Admin article image upload

## Goal

Let an authenticated administrator upload an article image from the Markdown editor and insert a permanent CDN URL at the current cursor position. The first release is an editor workflow, not a general media library.

## User flow

1. The administrator chooses or drops a JPEG, PNG, WebP, or GIF image in the Markdown editor.
2. The editor validates the file type and 10 MB size limit before sending it.
3. The Admin sends `multipart/form-data` to the same authenticated API used by the rest of the console.
4. The server validates the real file signature, creates a month-partitioned random object key, and uploads the bytes to private OSS with the ECS RAM role.
5. The server returns the CDN URL and the editor inserts `![file name](url)` at the saved cursor position.
6. Upload state and failures are announced without discarding the local article draft.

## API contract

`POST /api/admin/articles/images`

- Authentication: existing Admin session cookie and `AdminAuthGuard`.
- Content type: `multipart/form-data`.
- Field: `file`, exactly one file.
- Maximum size: 10 MiB.
- Supported content: JPEG, PNG, WebP, and GIF.
- Success: `201` with `{ key, url, mimeType, size, originalName }`.
- Invalid input: `400` with the existing `{ error: { code, message } }` envelope. Multipart payloads rejected before application validation, such as files above 10 MiB, use the framework's `413` response.
- Missing storage configuration: `503` with a stable error code; no local or mock fallback.
- Storage failure: `502` with a stable error code and no provider credentials or internal response body.

## Architecture

- `packages/contracts` owns the upload response type.
- The article application layer owns validation, key generation, and the upload use case.
- An `ArticleImageStorage` port isolates the application layer from Alibaba Cloud.
- The OSS adapter uses `@alicloud/credentials` with `ecs_ram_role` and `ali-oss`. Temporary STS credentials refresh automatically; permanent keys never reach source code, environment files, logs, or the browser.
- The controller owns HTTP multipart limits, authentication, and error mapping.
- The Admin API client owns `FormData`; the editor owns selection restoration and Markdown insertion.

## Object and cache policy

- Object key: `articles/YYYY/MM/<uuid-v4>.<verified-extension>`.
- The path exposes the upload month for operational grouping, but the UUID contains no sortable timestamp.
- `Content-Type` comes from the verified signature, not the browser-provided MIME type.
- Objects are immutable: replacing an image creates a new key. This matches the one-year CDN cache policy and avoids purge requirements.
- Public URLs use `https://img.zephyrai.site/<key>`. The OSS bucket remains private and CDN origin authorization remains enabled.

## Configuration

Required on the server:

- `OSS_REGION=oss-cn-hangzhou`
- `OSS_BUCKET=zephyrai-images`
- `OSS_PUBLIC_BASE_URL=https://img.zephyrai.site`

Optional:

- `ALIBABA_CLOUD_ECS_METADATA=<attached-role-name>` to avoid an extra metadata request. When omitted, the credentials provider discovers the attached role.

## Security boundaries

- Only authenticated administrators can upload.
- Reject empty files, oversized files, unsupported signatures, and MIME/signature mismatches.
- Ignore client paths and generate object keys server-side.
- Escape Markdown alt text before insertion.
- Do not expose OSS endpoints or credentials in API errors.
- Grant the ECS role only `oss:PutObject` for `acs:oss:*:*:zephyrai-images/articles/*` (and only any additional actions proven necessary by the SDK).

## Verification

- Unit tests cover image signature detection, size/type rejection, key generation, storage calls, and Markdown insertion.
- API client tests cover multipart requests and existing credentials/error handling.
- Typecheck, lint, formatting, all tests, Admin build, and Server build pass.
- Browser verification covers choosing an image, upload state, insertion at the cursor, preview rendering, keyboard focus, and failure messaging.
