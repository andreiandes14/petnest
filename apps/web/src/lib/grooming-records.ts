type GroomingRecord = { id: number; title: string; date: string; time?: string | null; status: string };

function minutes(time?: string | null) {
  const match = time?.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return -1;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return -1;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + minute;
}

export function groomingTime(time?: string | null) {
  const value = minutes(time);
  if (value < 0) return "Time unavailable";
  const hour = Math.floor(value / 60);
  return `${hour % 12 || 12}:${String(value % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function repeatGroomingService<T extends { name: string; category: string; available?: boolean }>(services: T[], title: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return services.find(service => service.category === "grooming" && service.available === true && normalize(service.name) === normalize(title));
}

export function availableGroomingTime(time: string, slots: { time: string; status: string }[]) {
  return slots.find(slot => slot.status === "available" && minutes(time) >= 0 && minutes(slot.time) === minutes(time))?.time ?? "";
}

/** The input is already scoped to the selected pet by the records endpoint. */
export function latestGroomingRecords<T extends GroomingRecord>(records: T[]): T[] {
  const sorted = records.filter(record => record.status.toLowerCase() === "completed").slice().sort((a, b) =>
    b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)) || minutes(b.time) - minutes(a.time) || b.id - a.id,
  );
  const seen = new Set<string>();
  return sorted.filter(record => {
    const service = record.title.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(service)) return false;
    seen.add(service);
    return true;
  });
}
