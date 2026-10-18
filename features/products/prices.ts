/** Exact decimal text normalization only; no monetary arithmetic or implicit rounding. */
function canonicalDecimal(value: string): string {
  const [mantissa, exponentText] = value.toLowerCase().split("e");
  const [integer, fraction = ""] = mantissa.split(".");
  const digits = integer + fraction;
  const point = integer.length + Number(exponentText ?? 0);
  const expanded = point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? digits + "0".repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [whole, decimal = ""] = expanded.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedDecimal = decimal.replace(/0+$/, "");
  return normalizedWhole + (normalizedDecimal ? `.${normalizedDecimal}` : "");
}

export function parsePrice(text: string): number | undefined {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || canonicalDecimal(normalized) !== canonicalDecimal(String(value))) return undefined;
  return value;
}
