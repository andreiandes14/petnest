export function normalizeCity(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/^(?:city|municipality) of /i, "").replace(/ (?:city|municipality)$/i, "").toLowerCase();
}

/** Only explicit, standalone city/municipality address components are inferred. */
export function detectCity(address: string): string | null {
  const cities = address.split(/[,;\n]/).map(part => part.trim()).filter(part =>
    /^(?:(?:city|municipality) of [\p{L} .'-]+|[\p{L} .'-]+ (?:city|municipality))$/iu.test(part),
  );
  const unique = new Map(cities.map(city => [normalizeCity(city), city]));
  if (unique.size !== 1) return null;
  const city = [...unique.values()][0];
  return city.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}
