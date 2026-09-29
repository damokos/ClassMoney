export async function getInstitutionName(db: D1Database): Promise<string> {
  const row = await db.prepare(`
    SELECT setting_value AS value
    FROM app_settings
    WHERE setting_key = 'institution_name'
  `).first<{ value: string }>();
  return row?.value ?? "";
}

export async function setInstitutionName(
  db: D1Database,
  name: string,
  updatedBy: number,
): Promise<void> {
  await db.prepare(`
    INSERT INTO app_settings (setting_key, setting_value, updated_at, updated_by)
    VALUES ('institution_name', ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(name, new Date().toISOString(), updatedBy).run();
}
