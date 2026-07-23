/**
 * Create the same complete backup used by the admin UI.
 * Includes SQLite, static fallback data and uploaded images.
 */
(async function () {
  try {
    const { createBackup } = await import('../server/src/services/backup.js');
    const backup = createBackup({ reason: 'manual' });
    const mb = (backup.bytes / 1024 / 1024).toFixed(2);
    console.log(`Backup written: _backups/${backup.id} (${backup.files} files, ${mb} MB)`);
  } catch (error) {
    console.error(`Backup failed: ${error.message}`);
    process.exitCode = 1;
  }
})();