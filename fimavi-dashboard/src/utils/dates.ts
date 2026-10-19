// Outils de dates (heure locale, semaines ISO : lundi → dimanche, semaine 1 = celle du 4 janvier)

const DAY_MS = 86400000;

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

// Numéro et année ISO de la semaine contenant d
export function isoWeek(d: Date): { year: number; week: number } {
  const thursday = addDays(mondayOf(d), 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round((thursday.getTime() - mondayOf(jan4).getTime()) / (7 * DAY_MS));
  return { year: thursday.getFullYear(), week };
}

// Lundi de la semaine ISO 1 de l'année
export function isoYearStart(year: number): Date {
  return mondayOf(new Date(year, 0, 4));
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}

export const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
