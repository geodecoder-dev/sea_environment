import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'database.json');
try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Local database reset. Fresh seed data will be generated on next start.');
  } else {
    console.log('ℹ️  No existing database file found. Initial seed will load automatically.');
  }
} catch (err) {
  console.error('Failed to reset database:', err);
}
