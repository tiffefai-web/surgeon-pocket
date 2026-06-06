require('dotenv').config({ path: '.env.local' });
if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) require('dotenv').config();

const { Pool } = require('pg');
const { getWeekOfMonth } = require('date-fns');

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

const HOLIDAY_DATE = '2026-06-10'; // Wednesday of week 2
const AWAY_DATE = '2026-06-09'; // Tuesday of week 2
const AWAY_ROOM = 'OR 2';
const MAIN_HOSPITAL = 'Main Hospital'; 
const BKY_HOSPITAL = 'Bueng Kaeng Yai Hospital'; 

const DEPARTMENTS = ['Gen Sx', 'CVT', 'URO', 'Ped Sx', 'Ortho', 'Neuro Sx', 'Ob-Gyn', 'ENT'];
const DOCTORS = ['Dr. A', 'Dr. B', 'Dr. C', 'Dr. D', 'Dr. E', 'Dr. F', 'Dr. G', 'Dr. H'];

function addMinutes(timeStr, minsToAdd) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + minsToAdd;
  const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const newM = (totalMins % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

async function seed() {
  console.log('Starting Intelligent June 2026 Seeding...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Clear ALL Cases to make it clean
    await client.query(`DELETE FROM Schedules`);
    await client.query(`DELETE FROM Surgical_Cases`);
    await client.query(`DELETE FROM Surgeon_Leaves`);

    // 2. Ensure mock users exist
    for (const doc of DOCTORS) {
      await client.query(`INSERT INTO Users (Username, PasswordHash, Role) VALUES ($1, 'mock', 'Surgeon') ON CONFLICT (Username) DO NOTHING`, [doc]);
    }

    const res = await client.query(`SELECT UserID, Username FROM Users WHERE Role = 'Surgeon'`);
    const users = res.rows;
    if (!users || users.length === 0) {
      throw new Error("No users found");
    }
    
    const docMap = {};
    users.forEach(u => {
      docMap[u.username || u.Username] = u.userid || u.UserID;
    });

    // 3. Insert Surgeon Away / Meeting
    const drB_Id = docMap['Dr. B'] || users[0].userid || users[0].UserID;
    await client.query(`INSERT INTO Surgeon_Leaves (UserID, Date, Yielded_RoomNumber) VALUES ($1, $2, $3)`,
      [drB_Id, AWAY_DATE, AWAY_ROOM]
    );

    // 4. Generate Cases for June 2026 (1 to 30)
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-06-${day.toString().padStart(2, '0')}`;
      
      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      if (dateStr === HOLIDAY_DATE) continue;

      const weekNum = getWeekOfMonth(dateObj);
      const isHighDensity = weekNum <= 2;
      const hospitals = [MAIN_HOSPITAL, BKY_HOSPITAL];
      
      for (const hospital of hospitals) {
        const rooms = ['OR 1', 'OR 2', 'OR 3', 'OR 4'];
        
        for (let roomIdx = 0; roomIdx < rooms.length; roomIdx++) {
          const room = rooms[roomIdx];
          if (dateStr === AWAY_DATE && room === AWAY_ROOM && hospital === MAIN_HOSPITAL) continue;

          let caseCount = 0;
          let minsPerCase = 0;

          if (isHighDensity) {
             if (Math.random() < 0.8) {
               caseCount = Math.floor(Math.random() * 3) + 3;
               minsPerCase = Math.floor(500 / caseCount);
             } else {
               caseCount = Math.floor(Math.random() * 2) + 1;
               minsPerCase = 120;
             }
          } else {
             if (Math.random() < 0.7) {
               caseCount = Math.floor(Math.random() * 2) + 1;
               minsPerCase = 120;
             } else {
               caseCount = 0;
             }
          }

          if (caseCount === 0) continue;

          let startTime = '08:30';
          const dept = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
          const surgeonName = DOCTORS[Math.floor(Math.random() * DOCTORS.length)];
          const surgeonId = docMap[surgeonName] || users[0].userid || users[0].UserID;

          for (let i = 0; i < caseCount; i++) {
            const endTime = addMinutes(startTime, minsPerCase); 
            const currentStartTime = startTime;

            const insertCase = await client.query(
              `INSERT INTO Surgical_Cases 
              (UserID, Patient_HN, FirstName, LastName, Gender, Age, Diagnosis, Operation, PatientType, CaseStatus, Location, Department) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING CaseID`,
              [
                surgeonId,
                `HN-JUNE-${day}-${hospital === MAIN_HOSPITAL ? 'M' : 'B'}-${room.replace(' ', '')}-${i}`, 
                `Mock`, 
                `Patient ${i+1}`, 
                'Other', 
                45, 
                `Routine ${dept} Diagnosis`, 
                `Standard ${dept} Operation`, 
                'IPD', 
                'Active', 
                hospital, 
                dept 
              ]
            );

            const caseId = insertCase.rows[0].caseid || insertCase.rows[0].CaseID;

            await client.query(
              `INSERT INTO Schedules (CaseID, Date, StartTime, EndTime, RoomNumber, SequenceOrder, ConsultAnes_Status, MedResult_Status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [caseId, dateStr, currentStartTime, endTime, room, i + 1, true, true]
            );

            startTime = addMinutes(endTime, 30);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('Successfully seeded Intelligent June workload.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

