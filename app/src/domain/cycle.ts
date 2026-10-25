/** Dates in this module are local calendar days written as "YYYY-MM-DD". */
export type DayKey = string;

export interface Cycle {
  /** First day of the Cycle (inclusive). */
  start: DayKey;
  /** First day of the next Cycle (exclusive). */
  end: DayKey;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number): DayKey => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const startDayIn = (y: number, m: number, startDay: number) => Math.min(startDay, daysInMonth(y, m));

function addMonths(y: number, m: number, delta: number): [number, number] {
  const index = y * 12 + (m - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

/** The local calendar day of an ISO timestamp. */
export function dayKeyOf(iso: string): DayKey {
  const d = new Date(iso);
  return key(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export const todayKey = (): DayKey => dayKeyOf(new Date().toISOString());

/** The Cycle that contains `day`, for a Cycle starting on `startDay` of each month. */
export function cycleContaining(day: DayKey, startDay: number): Cycle {
  const [y, m, d] = day.split('-').map(Number);
  let [sy, sm] = [y, m];
  if (d < startDayIn(y, m, startDay)) [sy, sm] = addMonths(y, m, -1);
  const [ey, em] = addMonths(sy, sm, 1);
  return {
    start: key(sy, sm, startDayIn(sy, sm, startDay)),
    end: key(ey, em, startDayIn(ey, em, startDay)),
  };
}

/** Days from `day` to the end of the Cycle, counting `day` itself. */
export function daysLeftInCycle(day: DayKey, cycle: Cycle): number {
  const toUtc = (k: DayKey) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(cycle.end) - toUtc(day)) / 86_400_000);
}

export const inCycle = (day: DayKey, cycle: Cycle) => day >= cycle.start && day < cycle.end;
