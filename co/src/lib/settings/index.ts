import { connectToDatabase } from "@/lib/mongodb/connection";
import { Setting } from "@/models";

// In-process cache to avoid querying MongoDB on every request/rotation
const settingsCache = new Map<string, any>();

/**
 * Get a setting value by key, with in-process caching and fallback default values.
 * If the setting is missing from the database, it attempts to seed it.
 */
export async function getSettingValue<T>(key: string, defaultValue: T): Promise<T> {
  if (settingsCache.has(key)) {
    return settingsCache.get(key) as T;
  }

  await connectToDatabase();

  try {
    const doc = await Setting.findOne({ key }).lean();
    if (doc) {
      settingsCache.set(key, doc.value);
      return doc.value as T;
    }

    // Attempt to seed the missing setting in the DB for future administrative convenience
    try {
      await Setting.create({ key, value: defaultValue });
    } catch (seedErr) {
      // Ignore write errors (e.g. parallel inserts)
    }

    settingsCache.set(key, defaultValue);
    return defaultValue;
  } catch (err) {
    console.error(`[Settings Service] Error reading setting ${key}:`, err);
    return defaultValue;
  }
}

/**
 * Clear the in-process settings cache (useful for testing or config updates).
 */
export function clearSettingsCache(): void {
  settingsCache.clear();
}
