# Commit Convention

Commit messages are checked by `commitlint` through the Husky `commit-msg` hook.
They must use Emoji + Conventional Commits:

```text
<emoji> <type>(<scope>): <subject>
```

Examples:

```text
✨ feat(auth): add GitHub login
🐛 fix(api): handle empty responses
🔧 chore(config): update workspace checks
```

Rules:

- The emoji must match the type.
- `scope` is optional and must be lowercase, numeric, or hyphenated.
- `subject` must start with a lowercase English letter.
- `subject` must not end with a period.
- `subject` should be 72 characters or fewer.

You can verify a message manually:

```shell
vp exec commitlint --from HEAD~1 --to HEAD --verbose
```

Allowed types:

| Emoji | Type       |
| ----- | ---------- |
| ✨    | `feat`     |
| 🐛    | `fix`      |
| 📝    | `docs`     |
| 💄    | `style`    |
| ♻️    | `refactor` |
| ⚡️    | `perf`     |
| ✅    | `test`     |
| 🔧    | `chore`    |
| 👷    | `ci`       |
| 📦    | `build`    |
| ⬆️    | `deps`     |
| ⬇️    | `deps`     |
| 🔥    | `remove`   |
| 🚑️    | `hotfix`   |
| 🚀    | `release`  |
| 🔒️    | `security` |
| 🌐    | `i18n`     |
| ⏪️    | `revert`   |
