# Persistence

The `fieldnotes` database, `worlds` store, `latest` key and database version 1 remain unchanged. Explicit saves write schema version 2, generator version, settings, player structures and clear overrides, and camera state. Loading validates data before creating a session; unversioned records are interpreted as generator 1 in memory and are not rewritten until an explicit save. Invalid or unsupported records are left untouched. Missing legacy angle and zoom use the existing defaults.

The repository closes each database connection after the transaction completes. Validation checks structure types, coordinates, settings, versions and camera values. It does not currently provide a save export or multiple slots.
