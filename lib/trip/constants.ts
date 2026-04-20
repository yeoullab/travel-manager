export const TRIP_CURRENCIES = ["KRW", "JPY", "USD", "EUR", "CNY", "THB"] as const;
export type TripCurrency = (typeof TRIP_CURRENCIES)[number];
