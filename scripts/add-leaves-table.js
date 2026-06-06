const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Surgeon_Leaves (
      LeaveID INTEGER PRIMARY KEY AUTOINCREMENT,
      UserID INTEGER NOT NULL,
      Date TEXT NOT NULL,
      Yielded_RoomNumber TEXT,
      FOREIGN KEY (UserID) REFERENCES Users(UserID)
    )
  `, (err) => {
    if (err) console.error(err);
    else console.log('Surgeon_Leaves table created successfully.');
  });
});

db.close();
