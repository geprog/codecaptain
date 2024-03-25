import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate as _migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import Database from 'better-sqlite3';

const config = useRuntimeConfig();

const sqlite = new Database(path.join(config.data_path, 'code_captain.db'));

export const db: BetterSQLite3Database = drizzle(sqlite);
