export const THAI_PUBLIC_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-03-03', // Makha Bucha
  '2026-04-06', // Chakri Memorial Day
  '2026-04-13', // Songkran
  '2026-04-14', // Songkran
  '2026-04-15', // Songkran
  '2026-05-01', // Labor Day
  '2026-05-04', // Coronation Day
  '2026-05-31', // Visakha Bucha
  '2026-06-03', // Queen Suthida's Birthday
  '2026-07-28', // King Vajiralongkorn's Birthday
  '2026-07-29', // Asahna Bucha
  '2026-08-12', // Mother's Day
  '2026-10-13', // King Bhumibol Adulyadej Memorial Day
  '2026-10-23', // Chulalongkorn Day
  '2026-12-05', // Father's Day
  '2026-12-10', // Constitution Day
  '2026-12-31'  // New Year's Eve
];

export function isHoliday(dateStr: string): boolean {
  return THAI_PUBLIC_HOLIDAYS_2026.includes(dateStr);
}
