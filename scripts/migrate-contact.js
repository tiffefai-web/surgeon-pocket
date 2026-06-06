const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Running Migration: Add ContactPhone field to Surgical_Cases...');

  db.run(`ALTER TABLE Surgical_Cases ADD COLUMN ContactPhone TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column ContactPhone already exists.');
      } else {
        console.error('Error adding ContactPhone:', err.message);
      }
    } else {
      console.log('Added column ContactPhone successfully.');
    }
  });
});

db.close(() => {
  console.log('Migration finished.');
});
