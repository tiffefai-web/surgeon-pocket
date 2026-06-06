'use server';

import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

export async function getCurrentUsername() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  
  if (!session) return 'Unknown User';
  return session.username as string;
}

export async function getMonthlyCases(year: number, month: number) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    throw new Error('Unauthorized');
  }

  // month is 1-indexed (1-12)
  const monthStr = month.toString().padStart(2, '0');
  const likePattern = `${year}-${monthStr}-%`;

  const db = await openDb();

  // If Surgeon, fetch only their cases. If Admin, fetch all (for future reuse).
  const isSurgeon = session.role === 'Surgeon';
  
  let query = `
    SELECT 
      c.CaseID, c.Patient_HN, c.FirstName, c.LastName, c.ContactPhone, c.Diagnosis, c.Operation, c.CaseStatus, c.CancellationReason,
      c.High_Risk_Meds, c.PreOp_Tags, c.PatientType, c.AdmitDaysPrior, c.IsAdmitted, c.Location,
      s.Date, s.StartTime, s.EndTime, s.RoomNumber, s.SequenceOrder
    FROM Surgical_Cases c
    JOIN Schedules s ON c.CaseID = s.CaseID
    WHERE s.Date LIKE ?
  `;
  const params: any[] = [likePattern];

  if (isSurgeon) {
    query += ` AND c.UserID = ?`;
    params.push(session.userId);
  }

  query += ` ORDER BY s.Date ASC, s.SequenceOrder ASC, s.StartTime ASC`;

  const cases = await db.all(query, params);
  return cases;
}

export async function getGlobalCases(year: number, month: number) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    throw new Error('Unauthorized');
  }

  const monthStr = month.toString().padStart(2, '0');
  const likePattern = `${year}-${monthStr}-%`;
  const db = await openDb();

  const query = `
    SELECT 
      c.CaseID, c.Patient_HN, c.FirstName, c.LastName, c.ContactPhone, c.Diagnosis, c.Operation, c.CaseStatus, c.Location, c.UserID,
      c.High_Risk_Meds, c.PreOp_Tags, c.Department,
      s.Date, s.StartTime, s.EndTime, s.RoomNumber, s.SequenceOrder, s.ConsultAnes_Status, s.MedResult_Status,
      u.Username as SurgeonName
    FROM Surgical_Cases c
    JOIN Schedules s ON c.CaseID = s.CaseID
    JOIN Users u ON c.UserID = u.UserID
    WHERE s.Date LIKE ? AND c.CaseStatus != 'Off-case'
    ORDER BY s.Date ASC, s.StartTime ASC
  `;

  const cases = await db.all(query, [likePattern]);

  // Privacy Masking
  const isSurgeon = session.role === 'Surgeon';
  
  if (isSurgeon) {
    return cases.map((c: any) => {
      if (c.UserID !== session.userId) {
        return {
          ...c,
          Patient_HN: '***',
          FirstName: 'Private',
          LastName: 'Patient',
          Diagnosis: 'Masked',
          Operation: 'Masked'
        };
      }
      return c;
    });
  }

  return cases;
}

export async function getSurgeonLeaves(year: number, month: number) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session) return [];

  const monthStr = month.toString().padStart(2, '0');
  const likePattern = `${year}-${monthStr}-%`;
  const db = await openDb();

  if (session.role === 'Admin') {
    return await db.all(`
      SELECT l.*, u.Username 
      FROM Surgeon_Leaves l
      JOIN Users u ON l.UserID = u.UserID
      WHERE l.Date LIKE ?
    `, [likePattern]);
  } else {
    return await db.all(`SELECT * FROM Surgeon_Leaves WHERE UserID = ? AND Date LIKE ?`, [session.userId, likePattern]);
  }
}

export async function toggleSurgeonLeave(dateStr: string, roomToYield: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || session.role !== 'Surgeon') return { error: 'Unauthorized' };

  const db = await openDb();
  
  // Check if leave exists
  const existing = await db.get(`SELECT * FROM Surgeon_Leaves WHERE UserID = ? AND Date = ?`, [session.userId, dateStr]);

  if (existing) {
    await db.run(`DELETE FROM Surgeon_Leaves WHERE LeaveID = ?`, [existing.LeaveID]);
    return { status: 'removed' };
  } else {
    await db.run(`
      INSERT INTO Surgeon_Leaves (UserID, Date, Yielded_RoomNumber) 
      VALUES (?, ?, ?)
    `, [session.userId, dateStr, roomToYield]);
    return { status: 'added' };
  }
}

export async function getRoomWeeklyCases(startDate: string, endDate: string, location: string, roomName: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session) return [];

  const db = await openDb();

  let query = `
    SELECT c.*, s.ScheduleID, s.Date, s.StartTime, s.EndTime, s.RoomNumber, s.SequenceOrder, s.ConsultAnes_Status, s.MedResult_Status, s.Note, u.Username as SurgeonName
    FROM Surgical_Cases c
    JOIN Schedules s ON c.CaseID = s.CaseID
    JOIN Users u ON c.UserID = u.UserID
    WHERE s.Date >= ? AND s.Date <= ?
  `;
  const params: any[] = [startDate, endDate];

  if (location) {
    query += ` AND c.Location = ?`;
    params.push(location);
  }

  if (roomName) {
    query += ` AND s.RoomNumber = ?`;
    params.push(roomName);
  }

  query += ` ORDER BY s.Date ASC, s.StartTime ASC`;

  const cases = await db.all(query, params);
  
  // Format boolean flags
  return cases.map(c => ({
    ...c,
    ConsultAnes_Status: Boolean(c.ConsultAnes_Status),
    MedResult_Status: Boolean(c.MedResult_Status)
  }));
}
