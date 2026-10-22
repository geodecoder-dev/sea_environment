import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'database.json');
try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✅ Local JSON cache cleaned.');
  }
} catch {
  // Ignored
}

console.log('🌿 Database reset instructions:');
console.log('   - For Cloudflare D1 local: npm run d1:local');
console.log('   - For Cloudflare D1 production: npm run d1:init');
console.log('   - For Node dev server: In-memory database automatically boots with fresh seed.');
