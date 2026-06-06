'use server';

import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { redirect } from 'next/navigation';

import { isHoliday } from '@/lib/holidays';

export async function createCaseAction(prevState: any, formData: FormData) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    return { error: 'Unauthorized' };
  }

  // Extract Patient Demographics
  const patientHn = formData.get('patientHn') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const contactPhone = formData.get('contactPhone') as string;
  const gender = formData.get('gender') as string;
  const age = parseInt(formData.get('age') as string, 10);

  // Extract Clinical History
  const underlyingDiseases = formData.get('underlyingDiseases') as string;
  const pastSurgicalHistory = formData.get('pastSurgicalHistory') as string;
  const highRiskMeds = formData.get('highRiskMeds') as string; // JSON array string from hidden input

  // Extract Surgical Setup
  const diagnosis = formData.get('diagnosis') as string;
  const operation = formData.get('operation') as string;
  const patientType = formData.get('patientType') as string;
  const admitDaysPrior = patientType === 'IPD' ? (parseInt(formData.get('admitDaysPrior') as string, 10) || 1) : null;
  const location = formData.get('location') as string;
  const department = formData.get('department') as string;
  const surgeonId = formData.get('surgeonId');
    if (session.role === 'Admin' && (!surgeonId || surgeonId === '')) {
      return { error: 'Admin must select a Surgeon for the case.' };
    }
    const finalUserId = surgeonId ? parseInt(surgeonId as string, 10) : session.userId;

  // Extract Pre-Op Checklists
  const consultAnesStatus = formData.get('consultAnes') === 'true' ? 1 : 0;
  const medResultStatus = formData.get('medResult') === 'true' ? 1 : 0;

  // Extract Logistics
  const preOpTags = formData.get('preOpTags') as string; // JSON array string from hidden input
  const extraNotes = formData.get('extraNotes') as string;

  // Extract Scheduling
  const date = formData.get('date') as string;
  const startTime = formData.get('startTime') as string;
  const surgeryDuration = parseInt(formData.get('surgeryDuration') as string, 10) || 0;
  const turnaroundTime = parseInt(formData.get('turnaroundTime') as string, 10) || 0;
  const roomNumber = formData.get('roomNumber') as string;

  // Validations
  if (!patientHn || !firstName || !lastName || !diagnosis || !operation || !date || !startTime) {
    return { error: 'Please fill in all required fields.' };
  }

  const isPrivate = location === 'Private Clinic' || location === 'Other' || location === 'Private Hospital';

  if (isHoliday(date)) {
    return { error: 'Cannot schedule cases on Thai Public Holidays.' };
  }

  let calculatedEndTime = null;
  const totalMins = surgeryDuration + turnaroundTime;

  if (date && startTime && totalMins > 0) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startObj = new Date(`${date}T${startTime}:00`);
    startObj.setMinutes(startObj.getMinutes() + totalMins);
    calculatedEndTime = startObj.toTimeString().slice(0, 5); // Format HH:mm
  }

  const db = await openDb();

  // Check scheduling conflicts
  if (calculatedEndTime && !isPrivate) {
    const conflict = await checkSchedulingConflicts(db, date, startTime, calculatedEndTime, roomNumber, location || 'Phitsanulok Hospital', session.userId);
    if (conflict.hasConflict) {
      return { error: conflict.error };
    }
  }

  // Check 8-hour total block capacity
  const dayCases = await db.all(`
    SELECT s.StartTime, s.EndTime
    FROM Schedules s
    JOIN Surgical_Cases c ON s.CaseID = c.CaseID
    WHERE s.Date = ? AND c.UserID = ? AND c.CaseStatus != 'Off-case'
  `, [date, session.userId]);

  let totalExistingMins = 0;
  for (const c of dayCases) {
    const start = new Date(`${date}T${c.StartTime}:00`).getTime();
    const end = new Date(`${date}T${c.EndTime}:00`).getTime();
    totalExistingMins += (end - start) / 60000;
  }

  if (totalExistingMins + totalMins > 480) { // 8 hours = 480 mins
    return { error: `This day is fully booked. Adding this case exceeds the 8-hour daily limit. Current total: ${totalExistingMins} mins.` };
  }

  // Check if surgeon is on leave
  const leave = await db.get(`SELECT * FROM Surgeon_Leaves WHERE UserID = ? AND Date = ?`, [session.userId, date]);
  if (leave) {
    return { error: 'You are marked as away/on leave on this date.' };
  }

  try {
    // Note: sqlite wrapper uses standard Promises
    await db.exec('BEGIN TRANSACTION');

    const caseResult = await db.get(`
      INSERT INTO Surgical_Cases (
        UserID, Patient_HN, FirstName, LastName, ContactPhone, Gender, Age, 
        Diagnosis, Operation, PatientType, AdmitDaysPrior, IsAdmitted, CaseStatus, Location, Department,
        Underlying_Diseases, Past_Surgical_History, High_Risk_Meds, PreOp_Tags, Extra_Notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Active', ?, ?, ?, ?, ?, ?, ?)
      RETURNING CaseID
    `, [
      finalUserId, patientHn, firstName, lastName, contactPhone || null, gender || null, age || null,
      diagnosis, operation, patientType || null, admitDaysPrior, location || null, department || null,
      underlyingDiseases || null, pastSurgicalHistory || null, highRiskMeds || null, preOpTags || null, extraNotes || null
    ]);

    const caseId = caseResult.lastID;

    if (!caseId) throw new Error('Failed to create case');

    await db.run(`
      INSERT INTO Schedules (
        CaseID, Date, StartTime, EndTime, RoomNumber, 
        ConsultAnes_Status, MedResult_Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      caseId, date || null, startTime || null, calculatedEndTime || null, roomNumber || null,
      consultAnesStatus, medResultStatus
    ]);

    await db.run(`
      INSERT INTO Case_History_Logs (
        CaseID, Action_Type, ChangedBy_Username
      ) VALUES (?, 'CREATE', ?)
    `, [
      caseId, session.username
    ]);

    await db.exec('COMMIT');

  } catch (error) {
    await db.exec('ROLLBACK');
    console.error(error);
    return { error: 'Failed to save the case to the database.' };
  }

  // Redirect on success
  redirect('/surgeon');
}

export async function checkSchedulingConflicts(
  db: any, 
  date: string, 
  startTime: string, 
  endTime: string, 
  roomNumber: string, 
  location: string, 
  userId: number, 
  excludeCaseId: number | null = null
) {
  if (location === 'Private Clinic' || location === 'Other') {
    return { hasConflict: false };
  }

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const newStart = sh * 60 + sm;
  const newEnd = eh * 60 + em;

  // Fetch all active cases on this date
  const query = `
    SELECT s.CaseID, s.StartTime, s.EndTime, s.RoomNumber, c.Location, c.UserID, u.Username
    FROM Schedules s
    JOIN Surgical_Cases c ON s.CaseID = c.CaseID
    JOIN Users u ON c.UserID = u.UserID
    WHERE s.Date = ? AND c.CaseStatus != 'Off-case'
  `;
  const params: any[] = [date];
  
  const existingCases = await db.all(query, params);

  for (const c of existingCases) {
    if (excludeCaseId && c.CaseID === excludeCaseId) continue;

    const [csh, csm] = c.StartTime.split(':').map(Number);
    const [ceh, cem] = c.EndTime.split(':').map(Number);
    const existStart = csh * 60 + csm;
    const existEnd = ceh * 60 + cem;

    const isOverlap = newStart < existEnd && newEnd > existStart;

    if (isOverlap) {
      // Check 1: Personal Double-Booking across any location
      if (c.UserID === userId) {
        return { hasConflict: true, error: `Scheduling conflict: You already have a case scheduled from ${c.StartTime} to ${c.EndTime} at ${c.Location}.` };
      }
      // Check 2: Room overlap at the same location
      if (c.RoomNumber === roomNumber && c.Location === location) {
         return { hasConflict: true, error: `Scheduling conflict: This room is already booked by Dr. ${c.Username} from ${c.StartTime} to ${c.EndTime}.` };
      }
    }
  }

  return { hasConflict: false };
}

export async function getCaseDetails(caseId: number) {
  const db = await openDb();
  const row = await db.get(`
    SELECT c.*, s.Date, s.StartTime, s.EndTime, s.RoomNumber, s.ConsultAnes_Status, s.MedResult_Status
    FROM Surgical_Cases c
    LEFT JOIN Schedules s ON c.CaseID = s.CaseID
    WHERE c.CaseID = ?
  `, [caseId]);
  return row;
}

export async function deleteCaseAction(caseId: number) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session) {
    return { error: 'Unauthorized' };
  }

  const db = await openDb();
  try {
    await db.exec('BEGIN TRANSACTION');
    await db.run(`DELETE FROM Schedules WHERE CaseID = ?`, [caseId]);
    await db.run(`DELETE FROM Surgical_Cases WHERE CaseID = ?`, [caseId]);
    await db.exec('COMMIT');
    return { success: true };
  } catch (err) {
    await db.exec('ROLLBACK');
    console.error('Failed to delete case:', err);
    return { error: 'Failed to delete case.' };
  }
}

export async function updateAdmissionStatus(caseId: number, isAdmitted: boolean) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session) {
    return { error: 'Unauthorized' };
  }

  const db = await openDb();
  try {
    await db.run(`UPDATE Surgical_Cases SET IsAdmitted = ? WHERE CaseID = ?`, [isAdmitted ? 1 : 0, caseId]);
    return { success: true };
  } catch (err) {
    console.error('Failed to update admission status:', err);
    return { error: 'Failed to update admission status.' };
  }
}

export async function updateCaseAction(prevState: any, formData: FormData) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    return { error: 'Unauthorized' };
  }

  const caseIdStr = formData.get('caseId') as string;
  if (!caseIdStr) return { error: 'Missing Case ID' };
  const caseId = parseInt(caseIdStr, 10);

  // Extract Patient Demographics
  const patientHn = formData.get('patientHn') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const contactPhone = formData.get('contactPhone') as string;
  const gender = formData.get('gender') as string;
  const age = parseInt(formData.get('age') as string, 10);

  // Extract Clinical History
  const underlyingDiseases = formData.get('underlyingDiseases') as string;
  const pastSurgicalHistory = formData.get('pastSurgicalHistory') as string;
  const highRiskMeds = formData.get('highRiskMeds') as string; 

  // Extract Surgical Setup
  const diagnosis = formData.get('diagnosis') as string;
  const operation = formData.get('operation') as string;
  const patientType = formData.get('patientType') as string;
  const admitDaysPrior = patientType === 'IPD' ? (parseInt(formData.get('admitDaysPrior') as string, 10) || 1) : null;
  const location = formData.get('location') as string;
  const department = formData.get('department') as string;
  const surgeonId = formData.get('surgeonId');
    if (session.role === 'Admin' && (!surgeonId || surgeonId === '')) {
      return { error: 'Admin must select a Surgeon for the case.' };
    }
    const finalUserId = surgeonId ? parseInt(surgeonId as string, 10) : session.userId;

  // Extract Pre-Op Checklists
  const consultAnesStatus = formData.get('consultAnes') === 'true' ? 1 : 0;
  const medResultStatus = formData.get('medResult') === 'true' ? 1 : 0;

  // Extract Logistics
  const preOpTags = formData.get('preOpTags') as string; 
  const extraNotes = formData.get('extraNotes') as string;

  // Extract Scheduling
  const date = formData.get('date') as string;
  const startTime = formData.get('startTime') as string;
  const surgeryDuration = parseInt(formData.get('surgeryDuration') as string, 10) || 0;
  const turnaroundTime = parseInt(formData.get('turnaroundTime') as string, 10) || 0;
  const roomNumber = formData.get('roomNumber') as string;

  // Validations
  if (!patientHn || !firstName || !lastName || !diagnosis || !operation || !date || !startTime) {
    return { error: 'Please fill in all required fields.' };
  }

  const isPrivate = location === 'Private Clinic' || location === 'Other' || location === 'Private Hospital';

  let calculatedEndTime = null;
  const totalMins = surgeryDuration + turnaroundTime;

  if (date && startTime && totalMins > 0) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startObj = new Date(`${date}T${startTime}:00`);
    startObj.setMinutes(startObj.getMinutes() + totalMins);
    calculatedEndTime = startObj.toTimeString().slice(0, 5);
  }

  const db = await openDb();

  // Check scheduling conflicts
  if (calculatedEndTime && !isPrivate) {
    const conflict = await checkSchedulingConflicts(db, date, startTime, calculatedEndTime, roomNumber, location || 'Phitsanulok Hospital', session.userId, caseId);
    if (conflict.hasConflict) {
      return { error: conflict.error };
    }
  }

  try {
    await db.exec('BEGIN TRANSACTION');

    await db.run(`
      UPDATE Surgical_Cases SET 
        UserID = ?, Patient_HN = ?, FirstName = ?, LastName = ?, ContactPhone = ?, Gender = ?, Age = ?, 
        Diagnosis = ?, Operation = ?, PatientType = ?, AdmitDaysPrior = ?, Location = ?, Department = ?,
        Underlying_Diseases = ?, Past_Surgical_History = ?, High_Risk_Meds = ?, PreOp_Tags = ?, Extra_Notes = ?
      WHERE CaseID = ?
    `, [
      finalUserId, patientHn, firstName, lastName, contactPhone || null, gender || null, age || null,
      diagnosis, operation, patientType || null, admitDaysPrior, location || null, department || null,
      underlyingDiseases || null, pastSurgicalHistory || null, highRiskMeds || null, preOpTags || null, extraNotes || null,
      caseId
    ]);

    await db.run(`
      UPDATE Schedules SET 
        Date = ?, StartTime = ?, EndTime = ?, RoomNumber = ?, 
        ConsultAnes_Status = ?, MedResult_Status = ?
      WHERE CaseID = ?
    `, [
      date || null, startTime || null, calculatedEndTime || null, roomNumber || null,
      consultAnesStatus, medResultStatus,
      caseId
    ]);

    await db.run(`
      INSERT INTO Case_History_Logs (
        CaseID, Action_Type, ChangedBy_Username
      ) VALUES (?, 'UPDATE', ?)
    `, [
      caseId, session.username
    ]);

    await db.exec('COMMIT');

  } catch (error) {
    await db.exec('ROLLBACK');
    console.error(error);
    return { error: 'Failed to update the case in the database.' };
  }

  redirect('/surgeon');
}


