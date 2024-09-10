import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

sqlite3.verbose();
const DATABASE_FILE = './database.db';


// init database
export const database = await open({
  filename: DATABASE_FILE,
  driver: sqlite3.Database,
});

const IS_PROD = process.env.NODE_ENV === 'production'

await database.exec(
  `
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  participants JSONB
);
CREATE TABLE IF NOT EXISTS lines (
  id VARCHAR(50),
  updated_at DATE NOT NULL,
  created_at DATE NOT NULL,
  deleted_at DATE,
  name VARCHAR(255) NOT NULL COLLATE NOCASE,
  amount REAL NOT NULL,
  paid VARCHAR(255) NOT NULL,
  
  project_id VARCHAR(50) REFERENCES projects(id),
  PRIMARY KEY (id, project_id)
);

CREATE TABLE IF NOT EXISTS split (
  participant VARCHAR(255) NOT NULL COLLATE NOCASE,
  amount REAL NOT NULL,

  project_id VARCHAR(50) REFERENCES projects(id),
  line_id VARCHAR(50) REFERENCES lines(id),
  PRIMARY KEY (participant, line_id, project_id)
);
`,
);

const {hasDeletedAt} = await database.get(`SELECT COUNT(*) as hasDeletedAt FROM pragma_table_info('lines') 
          WHERE name = 'deleted_at'`)
if(!hasDeletedAt) await database.exec(`ALTER TABLE lines ADD COLUMN deleted_at DATE DEFAULT NULL`)

console.log({IS_PROD, hasDeletedAt})
if(!IS_PROD){
  const projects = await database.all(`SELECT * FROM projects`)
  if (projects.length === 0)
    await database.exec(`
  -- Insert projects
  INSERT INTO projects (id, name, participants, currency)
  VALUES ('pro_123', 'Gui !', '["francois", "kaille"]', 'EUR')
  ON CONFLICT (id) DO NOTHING;
  `)
  
}

export default database