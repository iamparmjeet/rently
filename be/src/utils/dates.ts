export function now(): Date {
  return new Date();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;

  result.setMonth(targetMonth);

  if (result.getDate() !== date.getDate()) {
    result.setDate(0);
  }
  return result;
}
