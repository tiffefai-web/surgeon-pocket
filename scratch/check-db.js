const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT * FROM Surgical_Cases LIMIT 5", (err, rows) => {
  console.log('Surgical_Cases:', rows);
});
db.all("SELECT * FROM Schedules LIMIT 5", (err, rows) => {
  console.log('Schedules:', rows);
});
