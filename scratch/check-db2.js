const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT RoomNumber, StartTime, EndTime FROM Schedules WHERE Date = '2026-06-08'", (err, rows) => {
  console.log(rows);
});
