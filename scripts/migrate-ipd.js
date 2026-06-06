const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Running Migration: Add IPD fields to Surgical_Cases...');

  db.run(`ALTER TABLE Surgical_Cases ADD COLUMN AdmitDaysPrior INTEGER DEFAULT 1`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column AdmitDaysPrior already exists.');
      } else {
        console.error('Error adding AdmitDaysPrior:', err.message);
      }
    } else {
      console.log('Added column AdmitDaysPrior successfully.');
    }
  });

  db.run(`ALTER TABLE Surgical_Cases ADD COLUMN IsAdmitted BOOLEAN DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column IsAdmitted already exists.');
      } else {
        console.error('Error adding IsAdmitted:', err.message);
      }
    } else {
      console.log('Added column IsAdmitted successfully.');
    }
  });
});

db.close(() => {
  console.log('Migration finished.');
});
