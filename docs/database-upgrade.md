# Database upgrade

The Docker Compose database now runs PostgreSQL 19.0. The embedded development database uses PGlite 0.6.0, which also runs PostgreSQL 19. Fresh installations can start directly on these versions. Existing databases require a logical dump and restore across PostgreSQL major versions. [PostgreSQL upgrade guidance](https://www.postgresql.org/support/versioning/#upgrading) · [PGlite upgrade guidance](https://pglite.dev/docs/upgrade)

## Docker Compose from PostgreSQL 16

Run these commands from the project root using the same Compose project name and database user as the existing installation. The upgraded Compose file uses a separate `postgres19_data` volume. Database dumps contain CRM data, so keep them outside the repository.

1. Stop the app and database. Set the variables to your original Compose volume, database and user, then temporarily start PostgreSQL 16 against that volume.

   ```bash
   docker compose stop app db

   old_volume=spaceborn-management-system_postgres_data
   old_db=spaceborn
   db_user=spaceborn
   new_db=spaceborn_restored
   docker volume inspect "$old_volume"
   docker run -d --rm --name spaceborn-postgres16-migration \
     --mount "type=volume,source=$old_volume,target=/var/lib/postgresql/data" \
     postgres:16-alpine
   docker exec spaceborn-postgres16-migration pg_isready -U "$db_user" -d "$old_db"
   ```

2. When PostgreSQL 16 accepts connections, write the backup and stop the temporary container.

   ```bash
   umask 077
   dump_file="$(mktemp "$HOME/spaceborn-pg16-XXXXXX.dump")"
   docker exec spaceborn-postgres16-migration pg_dump -Fc -U "$db_user" -d "$old_db" > "$dump_file"
   docker stop spaceborn-postgres16-migration
   ```

3. Start the new database service and restore into a fresh database. Choose an unused name for `new_db`.

   ```bash
   docker compose up -d --wait db
   docker compose exec -T db createdb -U "$db_user" "$new_db"
   docker compose exec -T db pg_restore --single-transaction --no-owner --no-acl \
     -U "$db_user" -d "$new_db" < "$dump_file"
   docker compose exec -T db psql -U "$db_user" -d "$new_db" -c 'SELECT count(*) FROM users;'
   ```

4. Set `POSTGRES_DB` in `.env` to the restored database name, then run `docker compose up --build -d --wait`. Confirm the CRM opens with your existing accounts and records. The old database volume, original uploads volume, and backup file remain available.

## Embedded PGlite from 0.5.12

Stop the local backend and run the following from the repository root after installing the upgraded dependencies. It copies the original data directory to a private staging directory, exports the copy with PGlite 0.5.12, and restores into a new directory with PGlite 0.6.0.

```bash
stage_dir="$(mktemp -d)"
old_dir="$PWD/backend/data/spaceborn_pgdata"
new_dir="$PWD/backend/data/spaceborn_pgdata_v19"
cp -a "$old_dir" "$stage_dir/old-data"
npm install --prefix "$stage_dir" @electric-sql/pglite@0.5.12 @electric-sql/pglite-tools@0.4.12

node - "$stage_dir" "$new_dir" <<'NODE'
const { existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');

const [stageDir, destination] = process.argv.slice(2);
const loadLegacy = createRequire(resolve(stageDir, 'package.json'));
const { PGlite: LegacyPGlite } = loadLegacy('@electric-sql/pglite');
const { pgDump } = loadLegacy('@electric-sql/pglite-tools/pg_dump');
const { PGlite } = require('./backend/node_modules/@electric-sql/pglite');

async function upgrade() {
  if (existsSync(destination)) {
    throw new Error('Choose a new destination directory before restoring.');
  }

  const source = await LegacyPGlite.create(resolve(stageDir, 'old-data'));
  let sql;
  try {
    sql = await (await pgDump({ pg: source })).text();
  } finally {
    await source.close();
  }

  const restored = await PGlite.create(destination);
  try {
    await restored.exec(sql);
    await restored.exec('SET search_path TO public');
    console.log('Restored user count:', (await restored.query('SELECT count(*) FROM users')).rows[0].count);
  } finally {
    await restored.close();
  }
}

upgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
NODE
```

Start the app with `PGLITE_DATA_DIR="$new_dir" npm start` and confirm your existing accounts and CRM records. Set `PGLITE_DATA_DIR` to the absolute path for subsequent runs. The original data directory remains in place.
