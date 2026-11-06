# Assistant UI Rules

Read and follow [Agent 工程标准](../../../../../docs/assistant-engineering-standards.md) and the admin app guidelines before changing this feature.

- Reuse local UI, theme tokens, shared Markdown, admin HTTP and the native AG-UI client. Do not add a second transport parser or a new UI framework.
- Keep conversation coordination, input interaction and typed result rendering as clear responsibilities; split files for those responsibilities rather than line counts.
- Canonical server state owns completion, cancellation and approvals. Preserve request identity on uncertain submissions and ignore stale responses after navigation, including revisiting the same conversation.
- Loading failure is not an empty conversation. Keep input and Stop reachable in long histories and narrow layouts; preserve reading position and IME behavior.
- Unknown moderation results retain the same action and decision until reconciled. Do not enable the opposite decision or equate answer completion with mutation success.
- Test risky async behavior and confirm desktop/narrow, light/dark and failure states in a real browser. Label mocked visual evidence explicitly.
