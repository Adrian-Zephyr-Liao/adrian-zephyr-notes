const shortDateFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const fullDateFormat = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatShortDate(value: string) {
  const parts = shortDateFormat
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatFullDate(value: string) {
  return fullDateFormat.format(new Date(value));
}

export { formatFullDate, formatShortDate };
