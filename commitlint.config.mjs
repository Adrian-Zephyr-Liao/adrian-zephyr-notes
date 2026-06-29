const emojiByType = new Map([
  ["feat", "✨"],
  ["fix", "🐛"],
  ["docs", "📝"],
  ["style", "💄"],
  ["refactor", "♻️"],
  ["perf", "⚡️"],
  ["test", "✅"],
  ["chore", "🔧"],
  ["ci", "👷"],
  ["build", "📦"],
  ["deps", "⬆️"],
  ["remove", "🔥"],
  ["hotfix", "🚑️"],
  ["release", "🚀"],
  ["security", "🔒️"],
  ["i18n", "🌐"],
  ["revert", "⏪️"],
]);

const emojiAliasesByType = new Map([
  ["deps", new Set(["⬆", "⬆️", "⬇", "⬇️"])],
  ["hotfix", new Set(["🚑", "🚑️"])],
  ["perf", new Set(["⚡", "⚡️"])],
  ["refactor", new Set(["♻", "♻️"])],
  ["revert", new Set(["⏪", "⏪️"])],
  ["security", new Set(["🔒", "🔒️"])],
]);

const allowedTypes = [...emojiByType.keys()];
const headerPattern = /^(\S+)\s+([a-z0-9]+)(?:\(([a-z0-9-]+)\))?(!)?: (.+)$/u;

function getAcceptedEmojis(type) {
  return emojiAliasesByType.get(type) ?? new Set([emojiByType.get(type)]);
}

function formatExpectedEmojis(type) {
  const acceptedEmojis = getAcceptedEmojis(type);
  const preferredEmojis = [...acceptedEmojis].filter(
    (emoji) => emoji.includes("\uFE0F") || !acceptedEmojis.has(`${emoji}\uFE0F`),
  );

  return preferredEmojis.map((emoji) => `"${emoji}"`).join(" or ");
}

function createRule(check) {
  return (parsed, when = "always", value) => {
    const [passes, message] = check(parsed, value);
    const negated = when === "never";
    return [negated ? !passes : passes, message];
  };
}

export default {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      headerPattern,
      headerCorrespondence: ["emoji", "type", "scope", "breaking", "subject"],
    },
  },
  plugins: [
    {
      rules: {
        "header-match-pattern": createRule(({ header }) => [
          headerPattern.test(header),
          "header must be `<emoji> <type>(<scope>): <subject>`",
        ]),
        "emoji-type-match": createRule(({ emoji, type }) => {
          const expectedEmoji = emojiByType.get(type);

          if (!expectedEmoji) {
            return [true, ""];
          }

          return [
            getAcceptedEmojis(type).has(emoji),
            `type "${type}" must use emoji ${formatExpectedEmojis(type)}`,
          ];
        }),
        "subject-lowercase-start": createRule(({ subject }) => [
          !subject || /^[a-z]/.test(subject),
          "subject must start with a lowercase English letter",
        ]),
        "subject-max-length": createRule(({ subject }, max = 72) => [
          !subject || subject.length <= max,
          `subject must be ${max} characters or fewer`,
        ]),
        "subject-no-terminal-period": createRule(({ subject }) => [
          !subject || !/[.。]$/.test(subject),
          "subject must not end with a period",
        ]),
      },
    },
  ],
  rules: {
    "emoji-type-match": [2, "always"],
    "header-match-pattern": [2, "always"],
    "subject-case": [0],
    "subject-full-stop": [0],
    "subject-lowercase-start": [2, "always"],
    "subject-max-length": [2, "always", 72],
    "subject-no-terminal-period": [2, "always"],
    "type-enum": [2, "always", allowedTypes],
  },
};
