require('dotenv').config({ path: '.env.local' });
if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

const SURGEON_ID = 2; // UserID for surgeon
const HOSPITAL = 'Main Hospital'; 
const ROOM = 'OR 4';
const DEPT = 'Gen Sx';

const THURSDAYS = [
  { date: '2026-06-04', type: 'FULL', cases: 4, minsPerCase: 150 },
  { date: '2026-06-11', type: 'FULL', cases: 3, minsPerCase: 180 },
  { date: '2026-06-18', type: 'PARTIAL', cases: 2, minsPerCase: 105 },
  { date: '2026-06-25', type: 'PARTIAL', cases: 1, minsPerCase: 90 },
];

function addMinutes(timeStr, minsToAdd) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + minsToAdd;
  const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const newM = (totalMins % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

async function seed() {
  console.log('Starting Targeted Seeding for Surgeon (Thursdays)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Delete any existing cases for this surgeon on these specific dates
    for (const t of THURSDAYS) {
      await client.query(`
        DELETE FROM Schedules 
        WHERE Date = $1 AND CaseID IN (
          SELECT CaseID FROM Surgical_Cases WHERE UserID = $2
        )
      `, [t.date, SURGEON_ID]);
      
      await client.query(`DELETE FROM Surgical_Cases WHERE UserID = $1 AND CaseID NOT IN (SELECT CaseID FROM Schedules)`, [SURGEON_ID]);
    }

    // 2. Generate new targeted cases
    for (const t of THURSDAYS) {
      let startTime = '08:00';

      for (let i = 0; i < t.cases; i++) {
        const endTime = addMinutes(startTime, t.minsPerCase);
        const currentStartTime = startTime;

        const insertCase = await client.query(
          `INSERT INTO Surgical_Cases 
          (UserID, Patient_HN, FirstName, LastName, Gender, Age, Diagnosis, Operation, PatientType, CaseStatus, Location, Department) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING CaseID`,
          [
            SURGEON_ID,
            `HN-THU-${t.date}-${i}`, 
            `Mock`, 
            `Patient ${i+1}`, 
            'Other', 
            45, 
            `Demo ${DEPT} Diagnosis`, 
            `Demo ${DEPT} Operation`, 
            'IPD', 
            'Active', 
            HOSPITAL, 
            DEPT 
          ]
        );

        const caseId = insertCase.rows[0].caseid || insertCase.rows[0].CaseID;

        await client.query(
          `INSERT INTO Schedules (CaseID, Date, StartTime, EndTime, RoomNumber, SequenceOrder, ConsultAnes_Status, MedResult_Status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [caseId, t.date, currentStartTime, endTime, ROOM, i + 1, true, true]
        );

        startTime = addMinutes(endTime, 30);
      }
    }

    await client.query('COMMIT');
    console.log('Successfully seeded Targeted Thursday cases.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

