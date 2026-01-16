export function pickCoreCard<T>(params: { dueCards: T[]; newCards: T[] }): T | null {
  return params.dueCards[0] ?? params.newCards[0] ?? null
}
