import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

sqlite3.verbose();
const DATABASE_FILE = './src/database.db';


// init database
export const database = await open({
  filename: DATABASE_FILE,
  driver: sqlite3.Database,
});

await database.exec(
  `
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  
  participants JSONB
);
CREATE TABLE IF NOT EXISTS lines (
  id VARCHAR(50),
  created_at DATE NOT NULL,
  name VARCHAR(255) NOT NULL COLLATE NOCASE,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  paid VARCHAR(255) NOT NULL,
  project_id VARCHAR(50) REFERENCES projects(id),
  split JSONB,

  PRIMARY KEY (id, project_id)
);
`,
);

await database.exec(`
-- Insert projects
INSERT INTO projects (id, name, participants)
VALUES ('pro_123', 'Suka makan', '["francois", "kaille"]')
ON CONFLICT (id) DO NOTHING;

-- Insert lines
INSERT INTO lines (id, created_at, name, amount, currency, paid, project_id, split)
VALUES ('lin_2', '2024-01-03', 'Grab', 133024, 'IDR', 'francois', 'pro_123', '[{"participant": "francois", "amount": 66512}, {"participant": "kaille", "amount": 66512}]')
ON CONFLICT (id, project_id) DO NOTHING;

INSERT INTO lines (id, created_at, name, amount, currency, paid, project_id, split)
VALUES ('lin_3', '2024-01-02', 'Beers', 429762, 'IDR', 'francois', 'pro_123', '[{"participant": "francois", "amount": 66512}, {"participant": "kaille", "amount": 66512}]')
ON CONFLICT (id, project_id) DO NOTHING;

INSERT INTO lines (id, created_at, name, amount, currency, paid, project_id, split)
VALUES ('lin_4', '2024-01-01', 'Weekend camille', 170730, 'IDR', 'kaille', 'pro_123', '[{"participant": "francois", "amount": 66512}, {"participant": "kaille", "amount": 66512}]')
ON CONFLICT (id, project_id) DO NOTHING;
`)

export default database