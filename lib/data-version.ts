export const CURRENT_DATA_VERSION = 'account-beta-v1';

export function getLegacyStorageKeysToClear(keys: readonly string[], storedVersion: string | null) {
  if (storedVersion === CURRENT_DATA_VERSION) return [];
  return keys.filter((key) => key.startsWith('verse-legacy-') && key !== 'verse-legacy-data-version');
}
