const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const DAY_IN_MILLISECONDS = 86_400_000;

export function getSystemTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimezone(timezone) {
  if (typeof timezone !== "string" || !timezone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseDateOnlyParts(value) {
  const match = DATE_ONLY_PATTERN.exec(value || "");
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isValidDateOnly(value) {
  return Boolean(parseDateOnlyParts(value));
}

export function dateOnlyToLocalDate(value) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return new Date(Number.NaN);
  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
}

export function differenceInDays(fromValue, toValue) {
  const from = parseDateOnlyParts(fromValue);
  const to = parseDateOnlyParts(toValue);
  if (!from || !to) throw new TypeError("differenceInDays requires valid YYYY-MM-DD values");

  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / DAY_IN_MILLISECONDS);
}

export function offsetDate(value, days) {
  const parts = parseDateOnlyParts(value);
  if (!parts || !Number.isFinite(days)) throw new TypeError("offsetDate requires a valid date and day offset");

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function dateOnlyInTimezone(date = new Date(), timezone = getSystemTimezone()) {
  const safeTimezone = isValidTimezone(timezone) ? timezone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function zonedDateTimeToUtc(dateOnly, time, timezone) {
  const dateParts = parseDateOnlyParts(dateOnly);
  const timeMatch = TIME_PATTERN.exec(time || "");
  if (!dateParts || !timeMatch) throw new TypeError("A valid local date and HH:mm time are required");
  if (!isValidTimezone(timezone)) throw new RangeError(`Unknown timezone: ${timezone}`);

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) throw new RangeError("Reminder time is outside the valid clock range");

  const targetAsUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = dateTimePartsInTimezone(new Date(candidate), timezone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const correction = targetAsUtc - actualAsUtc;
    if (correction === 0) return new Date(candidate).toISOString();
    candidate += correction;
  }

  throw new RangeError(`The local time ${dateOnly} ${time} does not exist in ${timezone}`);
}

export function dateOnlyFromUtc(utcValue, timezone) {
  const date = new Date(utcValue);
  if (Number.isNaN(date.getTime())) return "";
  return dateOnlyInTimezone(date, isValidTimezone(timezone) ? timezone : "UTC");
}

function dateTimePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}
