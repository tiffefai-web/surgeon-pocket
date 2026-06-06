require('dotenv').config({ path: '.env.local' });
if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

async function initDB() {
    console.log('Connected to the PostgreSQL database.');
    try {
        // 1. Users Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Users (
            UserID SERIAL PRIMARY KEY,
            Username TEXT UNIQUE NOT NULL,
            PasswordHash TEXT NOT NULL,
            Role TEXT NOT NULL CHECK(Role IN ('Surgeon', 'Admin')),
            FullName TEXT,
            AvatarURL TEXT
        )`);
        console.log('Users table created or exists.');

        // 2. Surgical_Cases Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Surgical_Cases (
            CaseID SERIAL PRIMARY KEY,
            UserID INTEGER,
            Patient_HN TEXT NOT NULL,
            FirstName TEXT NOT NULL,
            LastName TEXT NOT NULL,
            Gender TEXT,
            Age INTEGER,
            Diagnosis TEXT,
            Operation TEXT,
            PatientType TEXT CHECK(PatientType IN ('IPD', 'OPD', 'ODS', 'SMC')),
            CaseStatus TEXT DEFAULT 'Active' CHECK(CaseStatus IN ('Active', 'Postponed', 'Off-case')),
            Location TEXT CHECK(Location IN ('Main Hospital', 'Private Clinic', 'Other Hospital')),
            Underlying_Diseases TEXT,
            Past_Surgical_History TEXT,
            High_Risk_Meds TEXT,
            PreOp_Tags TEXT,
            Extra_Notes TEXT,
            CancellationReason TEXT,
            ContactPhone TEXT,
            AdmitDaysPrior INTEGER,
            IsAdmitted INTEGER DEFAULT 0,
            Department TEXT,
            FOREIGN KEY(UserID) REFERENCES Users(UserID)
        )`);
        console.log('Surgical_Cases table created or exists.');

        // 3. Schedules Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Schedules (
            ScheduleID SERIAL PRIMARY KEY,
            CaseID INTEGER,
            Date TEXT,
            StartTime TEXT,
            EndTime TEXT,
            RoomNumber TEXT,
            SequenceOrder INTEGER,
            ConsultAnes_Status BOOLEAN DEFAULT FALSE,
            MedResult_Status BOOLEAN DEFAULT FALSE,
            Note TEXT,
            FOREIGN KEY(CaseID) REFERENCES Surgical_Cases(CaseID) ON DELETE CASCADE
        )`);
        console.log('Schedules table created or exists.');

        // 4. Case_History_Logs Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Case_History_Logs (
            LogID SERIAL PRIMARY KEY,
            CaseID INTEGER,
            Action_Type TEXT,
            Old_Date TEXT,
            New_Date TEXT,
            ChangedBy_Username TEXT,
            Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(CaseID) REFERENCES Surgical_Cases(CaseID) ON DELETE CASCADE
        )`);
        console.log('Case_History_Logs table created or exists.');

        // Daily Remarks Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Daily_Remarks (
            RemarkID SERIAL PRIMARY KEY,
            UserID INTEGER,
            Date TEXT,
            RemarkText TEXT,
            FOREIGN KEY(UserID) REFERENCES Users(UserID)
        )`);
        console.log('Daily_Remarks table created or exists.');

        // Surgeon_Leaves Table
        await pool.query(`CREATE TABLE IF NOT EXISTS Surgeon_Leaves (
            LeaveID SERIAL PRIMARY KEY,
            UserID INTEGER,
            Date TEXT,
            Yielded_RoomNumber TEXT,
            FOREIGN KEY(UserID) REFERENCES Users(UserID)
        )`);
        console.log('Surgeon_Leaves table created or exists.');
        
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        await pool.end();
        console.log('Database connection closed. Initialization complete.');
    }
}

initDB();

