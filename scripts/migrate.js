require('dotenv').config({ path: '.env.local' });
if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

async function migrate() {
  console.log('Starting Migration...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create New Tables
    await client.query(`CREATE TABLE IF NOT EXISTS Users (
      UserID SERIAL PRIMARY KEY,
      Username TEXT UNIQUE NOT NULL,
      PasswordHash TEXT NOT NULL,
      Role TEXT NOT NULL CHECK(Role IN ('Surgeon', 'Admin')),
      FullName TEXT,
      AvatarURL TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS Hospitals (
      HospitalID SERIAL PRIMARY KEY,
      Name TEXT UNIQUE NOT NULL,
      Type TEXT NOT NULL CHECK(Type IN ('Government', 'Private'))
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS Rooms (
      RoomID SERIAL PRIMARY KEY,
      HospitalID INTEGER,
      RoomName TEXT NOT NULL,
      FOREIGN KEY(HospitalID) REFERENCES Hospitals(HospitalID),
      UNIQUE(HospitalID, RoomName)
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS Departments (
      DepartmentID SERIAL PRIMARY KEY,
      Name TEXT UNIQUE NOT NULL
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS Weekly_Master_Schedule (
      TemplateID SERIAL PRIMARY KEY,
      HospitalID INTEGER,
      RoomID INTEGER,
      DayOfWeek INTEGER,
      DepartmentID INTEGER,
      SurgeonID INTEGER,
      FOREIGN KEY(HospitalID) REFERENCES Hospitals(HospitalID),
      FOREIGN KEY(RoomID) REFERENCES Rooms(RoomID),
      FOREIGN KEY(DepartmentID) REFERENCES Departments(DepartmentID),
      FOREIGN KEY(SurgeonID) REFERENCES Users(UserID)
    )`);

    // 2. Seed Data
    // Hospitals
    await client.query(`INSERT INTO Hospitals (Name, Type) VALUES ('Phitsanulok Hospital', 'Government') ON CONFLICT (Name) DO NOTHING`);
    await client.query(`INSERT INTO Hospitals (Name, Type) VALUES ('Bueng Kaeng Yai Hospital', 'Government') ON CONFLICT (Name) DO NOTHING`);

    // Rooms
    let res = await client.query(`SELECT HospitalID FROM Hospitals WHERE Name = 'Phitsanulok Hospital'`);
    if (res.rows.length > 0) {
      const hid = res.rows[0].hospitalid || res.rows[0].HospitalID;
      for (let i = 1; i <= 20; i++) {
        await client.query(`INSERT INTO Rooms (HospitalID, RoomName) VALUES ($1, $2) ON CONFLICT (HospitalID, RoomName) DO NOTHING`, [hid, `OR ${i}`]);
      }
    }

    res = await client.query(`SELECT HospitalID FROM Hospitals WHERE Name = 'Bueng Kaeng Yai Hospital'`);
    if (res.rows.length > 0) {
      const hid = res.rows[0].hospitalid || res.rows[0].HospitalID;
      for (let i = 1; i <= 5; i++) {
        await client.query(`INSERT INTO Rooms (HospitalID, RoomName) VALUES ($1, $2) ON CONFLICT (HospitalID, RoomName) DO NOTHING`, [hid, `OR ${i}`]);
      }
    }

    // Departments
    const depts = ['Gen Sx', 'CVT', 'URO', 'Ped Sx', 'Ortho', 'Neuro Sx', 'Ob-Gyn', 'ENT'];
    for (const d of depts) {
      await client.query(`INSERT INTO Departments (Name) VALUES ($1) ON CONFLICT (Name) DO NOTHING`, [d]);
    }

    await client.query('COMMIT');
    console.log('Migration Completed Successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration Failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

