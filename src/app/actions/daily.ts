'use server';

import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { checkSchedulingConflicts } from './cases';

// Remarks
export async function getDailyRemark(dateStr: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return null;

  const db = await openDb();
  const row = await db.get(`SELECT RemarkText FROM Daily_Remarks WHERE UserID = ? AND Date = ?`, [session.userId, dateStr]);
  return row ? row.RemarkText : '';
}

export async function saveDailyRemark(dateStr: string, text: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return { error: 'Unauthorized' };

  const db = await openDb();
  await db.run(`
    INSERT INTO Daily_Remarks (UserID, Date, RemarkText)
    VALUES (?, ?, ?)
    ON CONFLICT(UserID, Date) DO UPDATE SET RemarkText = excluded.RemarkText
  `, [session.userId, dateStr, text]);

  return { success: true };
}

// Sequence and Cascading
export async function reorderAndCascadeCases(caseIdsInOrder: number[], anchorStartTime: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return { error: 'Unauthorized' };

  if (caseIdsInOrder.length === 0) return { success: true };

  const db = await openDb();
  await db.exec('BEGIN TRANSACTION');
  try {
    // 1. Fetch current schedules for these cases
    const placeholders = caseIdsInOrder.map(() => '?').join(',');
    const currentSchedules = await db.all(`
      SELECT CaseID, StartTime, EndTime, Date, RoomNumber
      FROM Schedules 
      WHERE CaseID IN (${placeholders})
    `, caseIdsInOrder);

    // Map for quick lookup
    const scheduleMap = new Map();
    for (const s of currentSchedules) {
      scheduleMap.set(s.CaseID, s);
    }
    
    // Also need c.Location for conflict check
    const caseDetails = await db.all(`
      SELECT CaseID, Location 
      FROM Surgical_Cases 
      WHERE CaseID IN (${placeholders})
    `, caseIdsInOrder);
    const locationMap = new Map();
    for (const c of caseDetails) {
      locationMap.set(c.CaseID, c.Location);
    }

    // 2. Cascade logic
    let currentStartTimeMinutes = 0;
    if (anchorStartTime) {
      const [ah, am] = anchorStartTime.split(':').map(Number);
      currentStartTimeMinutes = ah * 60 + am;
    }

    for (let i = 0; i < caseIdsInOrder.length; i++) {
      const caseId = caseIdsInOrder[i];
      const sched = scheduleMap.get(caseId);
      if (!sched) continue;

      const loc = locationMap.get(caseId);
      const isPrivate = loc === 'Private Clinic' || loc === 'Other';

      let newStartTimeStr = sched.StartTime;
      let newEndTimeStr = sched.EndTime;

      if (!isPrivate && sched.StartTime && sched.EndTime) {
        // Calculate duration of this specific case
        const [sh, sm] = sched.StartTime.split(':').map(Number);
        const [eh, em] = sched.EndTime.split(':').map(Number);
        const durationMins = (eh * 60 + em) - (sh * 60 + sm);

        let newStartH, newStartM, newEndH, newEndM;

        // Subsequent cases snap to currentStartTimeMinutes
        newStartH = Math.floor(currentStartTimeMinutes / 60);
        newStartM = currentStartTimeMinutes % 60;

        // Calculate new end time
        currentStartTimeMinutes += durationMins;
        newEndH = Math.floor(currentStartTimeMinutes / 60);
        newEndM = currentStartTimeMinutes % 60;

        newStartTimeStr = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`;
        newEndTimeStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

        // Check conflict before updating
        const conflict = await checkSchedulingConflicts(db, sched.Date, newStartTimeStr, newEndTimeStr, sched.RoomNumber, loc || 'Phitsanulok Hospital', session.userId, caseId);
        if (conflict.hasConflict) {
          throw new Error(conflict.error);
        }
      }

      // Update DB
      await db.run(`
        UPDATE Schedules 
        SET SequenceOrder = ?, StartTime = ?, EndTime = ? 
        WHERE CaseID = ?
      `, [i + 1, newStartTimeStr, newEndTimeStr, caseId]);
    }

    await db.exec('COMMIT');
    return { success: true };
  } catch (error: any) {
    await db.exec('ROLLBACK');
    return { error: error.message || 'Failed to reorder and cascade cases' };
  }
}

// Reschedule Action
export async function rescheduleCaseAction(caseId: number, newDate: string, reason: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return { error: 'Unauthorized' };

  const db = await openDb();
  await db.exec('BEGIN TRANSACTION');
  try {
    const oldSched = await db.get(`SELECT Date, StartTime, EndTime, RoomNumber FROM Schedules WHERE CaseID = ?`, [caseId]);
    if (!oldSched) throw new Error('Case not found');

    const caseData = await db.get(`SELECT Location FROM Surgical_Cases WHERE CaseID = ?`, [caseId]);

    // Check conflict
    const conflict = await checkSchedulingConflicts(db, newDate, oldSched.StartTime, oldSched.EndTime, oldSched.RoomNumber, caseData.Location || 'Main Hospital', session.userId, caseId);
    if (conflict.hasConflict) {
      throw new Error(conflict.error);
    }

    await db.run(`UPDATE Schedules SET Date = ? WHERE CaseID = ?`, [newDate, caseId]);

    const actionText = `Rescheduled from ${oldSched.Date} to ${newDate}. Reason: ${reason}`;
    await db.run(`
      INSERT INTO Case_History_Logs (CaseID, Action_Type, ChangedBy_Username)
      VALUES (?, ?, ?)
    `, [caseId, actionText, session.username]);

    await db.exec('COMMIT');
    return { success: true };
  } catch (error: any) {
    await db.exec('ROLLBACK');
    return { error: error.message || 'Failed to reschedule case' };
  }
}

// Status & Audit
export async function updateCaseStatus(caseId: number, status: string, reason: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return { error: 'Unauthorized' };

  const db = await openDb();
  await db.exec('BEGIN TRANSACTION');
  try {
    // Get current state to log
    const oldCase = await db.get(`SELECT CaseStatus FROM Surgical_Cases WHERE CaseID = ?`, [caseId]);
    
    // Update status
    await db.run(`
      UPDATE Surgical_Cases 
      SET CaseStatus = ?, CancellationReason = ? 
      WHERE CaseID = ?
    `, [status, reason || null, caseId]);

    // Log history
    const actionText = `Status changed from ${oldCase.CaseStatus} to ${status}${reason ? `. Reason: ${reason}` : ''}`;
    await db.run(`
      INSERT INTO Case_History_Logs (CaseID, Action_Type, ChangedBy_Username)
      VALUES (?, ?, ?)
    `, [caseId, actionText, session.username]);

    await db.exec('COMMIT');
    return { success: true };
  } catch (error) {
    await db.exec('ROLLBACK');
    return { error: 'Failed to update case status' };
  }
}

export async function getCaseHistory(caseId: number) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  if (!session) return [];

  const db = await openDb();
  return await db.all(`
    SELECT * FROM Case_History_Logs 
    WHERE CaseID = ? 
    ORDER BY Timestamp DESC
  `, [caseId]);
}
