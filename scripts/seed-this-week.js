const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { format, startOfWeek, addDays } = require('date-fns');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Current Date configuration
const today = new Date('2026-06-08'); // We use June 8 2026 as Monday of the week
const monday = startOfWeek(today, { weekStartsOn: 1 });
const mondayStr = format(monday, 'yyyy-MM-dd');
const tuesdayStr = format(addDays(monday, 1), 'yyyy-MM-dd');
const wednesdayStr = format(addDays(monday, 2), 'yyyy-MM-dd');
const thursdayStr = format(addDays(monday, 3), 'yyyy-MM-dd');
const fridayStr = format(addDays(monday, 4), 'yyyy-MM-dd');

const WEEKDAYS = [mondayStr, tuesdayStr, wednesdayStr, thursdayStr, fridayStr];

const MAIN_HOSPITAL = 'Main Hospital';
const BKY_HOSPITAL = 'Bueng Kaeng Yai Hospital';

// Helper to add minutes
function addMinutes(timeStr, minsToAdd) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + minsToAdd;
  const newH = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const newM = (totalMins % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

const mockPlan = [
  // OR 1: CVT - Dr. A (3 cases booked - RED/Full)
  { room: 'OR 1', location: MAIN_HOSPITAL, dept: 'CVT', cases: 3, minsPerCase: 180 }, // 9 hours
  // OR 2: Uro Sx - Dr. B (2 cases booked - GREEN/Available)
  { room: 'OR 2', location: MAIN_HOSPITAL, dept: 'Uro Sx', cases: 2, minsPerCase: 120 }, // 4 hours
  // OR 3: Gen Sx - Dr. C (5 cases booked - RED/Full)
  { room: 'OR 3', location: MAIN_HOSPITAL, dept: 'Gen Sx', cases: 5, minsPerCase: 100 }, // ~8.3 hours
  // OR 4: Gen Sx - Dr. D (1 case booked - GREEN/Available)
  { room: 'OR 4', location: MAIN_HOSPITAL, dept: 'Gen Sx', cases: 1, minsPerCase: 120 }, // 2 hours
  // OR 1 (Bueng Kaeng Yai): Ped Sx - Dr. E (Full - RED)
  { room: 'OR 1', location: BKY_HOSPITAL, dept: 'Ped Sx', cases: 4, minsPerCase: 150 }, // 10 hours
];

db.serialize(() => {
  console.log('Starting Realistic Week Seeding...');
  db.run('BEGIN TRANSACTION');

  try {
    // 1. Clear ALL Cases to make it clean
    db.run(`DELETE FROM Schedules`);
    db.run(`DELETE FROM Surgical_Cases`);
    db.run(`DELETE FROM Surgeon_Leaves`);

    // 2. Fetch Surgeons
    db.all(`SELECT UserID, Username FROM Users WHERE Role = 'Surgeon'`, (err, users) => {
      if (!users || users.length === 0) {
        console.error("No surgeons found!");
        return;
      }

      // Assign a different user to A, B, C, D, E. If not enough, reuse.
      const drA = users[0 % users.length].UserID;
      const drB = users[1 % users.length].UserID;
      const drC = users[2 % users.length].UserID;
      const drD = users[3 % users.length].UserID;
      const drE = users[4 % users.length].UserID;

      const drMap = {
        'OR 1': drA,
        'OR 2': drB,
        'OR 3': drC,
        'OR 4': drD,
      };

      // 3. Insert Surgeon Away / Meeting
      db.run(`INSERT INTO Surgeon_Leaves (UserID, Date, Yielded_RoomNumber) VALUES (?, ?, ?)`,
        [drB, tuesdayStr, 'OR 2']
      );

      // 4. Generate Cases
      WEEKDAYS.forEach(dateStr => {
        // Skip Wednesday (Holiday)
        if (dateStr === wednesdayStr) return;

        mockPlan.forEach(plan => {
          // Skip Tuesday OR 2
          if (dateStr === tuesdayStr && plan.room === 'OR 2' && plan.location === MAIN_HOSPITAL) return;

          let surgeonId = drMap[plan.room];
          if (plan.location === BKY_HOSPITAL) surgeonId = drE; // Dr. E for BKY
          
          let startTime = '08:30';

          for (let i = 0; i < plan.cases; i++) {
            const endTime = addMinutes(startTime, plan.minsPerCase); 

            db.run(
              `INSERT INTO Surgical_Cases 
              (UserID, Patient_HN, FirstName, LastName, Gender, Age, Diagnosis, Operation, PatientType, CaseStatus, Location, Department) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                surgeonId,
                `HN-${dateStr}-${plan.location === MAIN_HOSPITAL ? 'M' : 'B'}-${plan.room}-${i}`,
                `Mock`, 
                `Patient ${i+1}`, 
                'Other', 
                45, 
                `Routine ${plan.dept} Diagnosis`, 
                `Standard ${plan.dept} Operation`, 
                'IPD', 
                'Active', 
                plan.location, 
                plan.dept 
              ],
              function(err) {
                if (err) console.error(err);
                const caseId = this.lastID;
                db.run(
                  `INSERT INTO Schedules (CaseID, Date, StartTime, EndTime, RoomNumber, SequenceOrder, ConsultAnes_Status, MedResult_Status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [caseId, dateStr, startTime, endTime, plan.room, i + 1, 1, 1]
                );
              }
            );

            // Update startTime for next case
            startTime = addMinutes(endTime, 30); // 30 min turnaround
          }
        });
      });
    });

    db.run('COMMIT', () => {
      console.log('Successfully seeded Realistic Week workload.');
    });

  } catch (error) {
    db.run('ROLLBACK');
    console.error('Seeding failed:', error);
  }
});
