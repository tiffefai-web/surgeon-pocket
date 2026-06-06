const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { addMinutes, format } = require('date-fns');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const cases = [
  // Fully Booked Day: June 10, 2026
  {
    patientHn: 'HN001', firstName: 'John', lastName: 'Doe', age: 45,
    diagnosis: 'Acute Cholecystitis', operation: 'Laparoscopic Cholecystectomy',
    date: '2026-06-10', startTime: '08:00', duration: 120, turnaround: 30, room: 'OR 1'
  },
  {
    patientHn: 'HN002', firstName: 'Jane', lastName: 'Smith', age: 34,
    diagnosis: 'Appendicitis', operation: 'Laparoscopic Appendectomy',
    date: '2026-06-10', startTime: '10:30', duration: 60, turnaround: 30, room: 'OR 1'
  },
  {
    patientHn: 'HN003', firstName: 'Robert', lastName: 'Brown', age: 55,
    diagnosis: 'Inguinal Hernia', operation: 'Hernioplasty',
    date: '2026-06-10', startTime: '12:00', duration: 90, turnaround: 30, room: 'OR 1'
  },
  {
    patientHn: 'HN004', firstName: 'Emily', lastName: 'Davis', age: 60,
    diagnosis: 'Colon Cancer', operation: 'Right Hemicolectomy',
    date: '2026-06-10', startTime: '14:00', duration: 180, turnaround: 30, room: 'OR 1'
  },
  // June 12
  {
    patientHn: 'HN005', firstName: 'Michael', lastName: 'Wilson', age: 28,
    diagnosis: 'Perianal Abscess', operation: 'I&D',
    date: '2026-06-12', startTime: '09:00', duration: 30, turnaround: 15, room: 'OR 2'
  },
  // June 15
  {
    patientHn: 'HN006', firstName: 'Sarah', lastName: 'Taylor', age: 40,
    diagnosis: 'Breast Mass', operation: 'Excision',
    date: '2026-06-15', startTime: '10:00', duration: 60, turnaround: 30, room: 'OR 3'
  },
  // June 18
  {
    patientHn: 'HN007', firstName: 'David', lastName: 'Anderson', age: 50,
    diagnosis: 'Hemorrhoids', operation: 'Hemorrhoidectomy',
    date: '2026-06-18', startTime: '13:00', duration: 45, turnaround: 30, room: 'OR 1'
  },
  // June 20 - Fully booked day OR 2
  {
    patientHn: 'HN008', firstName: 'Linda', lastName: 'Thomas', age: 65,
    diagnosis: 'Gastric Cancer', operation: 'Subtotal Gastrectomy',
    date: '2026-06-20', startTime: '08:00', duration: 240, turnaround: 45, room: 'OR 2'
  },
  {
    patientHn: 'HN009', firstName: 'James', lastName: 'Jackson', age: 70,
    diagnosis: 'Gallstone Pancreatitis', operation: 'ERCP + Lap Chole',
    date: '2026-06-20', startTime: '13:00', duration: 180, turnaround: 30, room: 'OR 2'
  },
  // July 05
  {
    patientHn: 'HN010', firstName: 'Mary', lastName: 'White', age: 32,
    diagnosis: 'Thyroid Nodule', operation: 'Thyroidectomy',
    date: '2026-07-05', startTime: '09:00', duration: 120, turnaround: 30, room: 'OR 1'
  },
  // July 12
  {
    patientHn: 'HN011', firstName: 'William', lastName: 'Harris', age: 48,
    diagnosis: 'Umbilical Hernia', operation: 'Mesh Repair',
    date: '2026-07-12', startTime: '11:00', duration: 60, turnaround: 30, room: 'OR 3'
  },
  // June 25
  {
    patientHn: 'HN012', firstName: 'Elizabeth', lastName: 'Martin', age: 52,
    diagnosis: 'Breast Cancer', operation: 'MRM',
    date: '2026-06-25', startTime: '08:30', duration: 150, turnaround: 30, room: 'OR 4'
  },
  // June 28
  {
    patientHn: 'HN013', firstName: 'Richard', lastName: 'Thompson', age: 61,
    diagnosis: 'Bowel Obstruction', operation: 'Exploratory Laparotomy',
    date: '2026-06-28', startTime: '10:00', duration: 180, turnaround: 30, room: 'OR 1'
  },
  // July 01
  {
    patientHn: 'HN014', firstName: 'Susan', lastName: 'Garcia', age: 29,
    diagnosis: 'Sebaceous Cyst', operation: 'Excision',
    date: '2026-07-01', startTime: '14:00', duration: 30, turnaround: 15, room: 'OR 2'
  },
  // July 10
  {
    patientHn: 'HN015', firstName: 'Joseph', lastName: 'Martinez', age: 41,
    diagnosis: 'Fistula in Ano', operation: 'Fistulectomy',
    date: '2026-07-10', startTime: '09:00', duration: 45, turnaround: 30, room: 'OR 3'
  }
];

function calculateEndTime(dateStr, startTimeStr, duration, turnaround) {
  const [hours, minutes] = startTimeStr.split(':').map(Number);
  const startObj = new Date(`${dateStr}T${startTimeStr}:00`);
  const endObj = addMinutes(startObj, duration + turnaround);
  return format(endObj, 'HH:mm');
}

const run = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

async function seedCases() {
  const surgeonId = 2; // From our previous seed
  try {
    await run('BEGIN TRANSACTION', []);
    
    for (const c of cases) {
      const caseResult = await run(`
        INSERT INTO Surgical_Cases (
          UserID, Patient_HN, FirstName, LastName, Age, 
          Diagnosis, Operation, PatientType, CaseStatus, Location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'IPD', 'Active', 'Main Hospital')
      `, [surgeonId, c.patientHn, c.firstName, c.lastName, c.age, c.diagnosis, c.operation]);
      
      const caseId = caseResult.lastID;
      const endTime = calculateEndTime(c.date, c.startTime, c.duration, c.turnaround);
      
      await run(`
        INSERT INTO Schedules (
          CaseID, Date, StartTime, EndTime, RoomNumber
        ) VALUES (?, ?, ?, ?, ?)
      `, [caseId, c.date, c.startTime, endTime, c.room]);
    }
    
    await run('COMMIT', []);
    console.log('Successfully seeded 15 mock surgical cases!');
  } catch (error) {
    await run('ROLLBACK', []);
    console.error('Error seeding data:', error);
  } finally {
    db.close();
  }
}

seedCases();
