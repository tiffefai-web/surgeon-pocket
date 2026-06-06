const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Add CancellationReason to Surgical_Cases
  db.run(`ALTER TABLE Surgical_Cases ADD COLUMN CancellationReason TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('CancellationReason column already exists.');
      } else {
        console.error('Error adding CancellationReason:', err.message);
      }
    } else {
      console.log('Added CancellationReason to Surgical_Cases.');
    }
  });

  // 2. Create Daily_Remarks table
  db.run(`
    CREATE TABLE IF NOT EXISTS Daily_Remarks (
      RemarkID INTEGER PRIMARY KEY AUTOINCREMENT,
      UserID INTEGER NOT NULL,
      Date TEXT NOT NULL,
      RemarkText TEXT NOT NULL,
      FOREIGN KEY(UserID) REFERENCES Users(UserID),
      UNIQUE(UserID, Date)
    )
  `, (err) => {
    if (err) console.error('Error creating Daily_Remarks:', err.message);
    else console.log('Daily_Remarks table created or already exists.');
  });
});

db.close();
