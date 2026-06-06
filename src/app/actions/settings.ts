'use server';

import { openDb } from '@/lib/db';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';

// Middleware-like check
async function checkAdmin() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);
  
  if (!session || session.role !== 'Admin') {
    throw new Error('Unauthorized. Admins only.');
  }
}

// -- Hospitals --
export async function getHospitals() {
  const db = await openDb();
  return db.all('SELECT * FROM Hospitals ORDER BY Name ASC');
}

// -- Rooms --
export async function getRooms() {
  const db = await openDb();
  return db.all(`
    SELECT r.RoomID, r.HospitalID, r.RoomName, h.Name as HospitalName 
    FROM Rooms r 
    JOIN Hospitals h ON r.HospitalID = h.HospitalID 
    ORDER BY h.Name ASC, r.RoomName ASC
  `);
}

export async function addRoom(hospitalId: number, roomName: string) {
  await checkAdmin();
  const db = await openDb();
  await db.run('INSERT INTO Rooms (HospitalID, RoomName) VALUES (?, ?)', [hospitalId, roomName]);
}

export async function deleteRoom(roomId: number) {
  await checkAdmin();
  const db = await openDb();
  await db.run('DELETE FROM Rooms WHERE RoomID = ?', [roomId]);
}

// -- Departments --
export async function getDepartments() {
  const db = await openDb();
  return db.all('SELECT * FROM Departments ORDER BY Name ASC');
}

export async function addDepartment(name: string) {
  await checkAdmin();
  const db = await openDb();
  await db.run('INSERT INTO Departments (Name) VALUES (?)', [name]);
}

export async function deleteDepartment(departmentId: number) {
  await checkAdmin();
  const db = await openDb();
  await db.run('DELETE FROM Departments WHERE DepartmentID = ?', [departmentId]);
}

// -- Users (Surgeons) --
export async function getSurgeons() {
  const db = await openDb();
  return db.all('SELECT UserID, Username FROM Users WHERE Role = "Surgeon" ORDER BY Username ASC');
}

// -- Weekly Master Schedule --
export async function getMasterTemplates() {
  const db = await openDb();
  return db.all(`
    SELECT t.TemplateID, t.HospitalID, t.RoomID, t.DayOfWeek, t.DepartmentID, t.SurgeonID,
           h.Name as HospitalName, r.RoomName, d.Name as DepartmentName, u.Username as SurgeonName
    FROM Weekly_Master_Schedule t
    JOIN Hospitals h ON t.HospitalID = h.HospitalID
    JOIN Rooms r ON t.RoomID = r.RoomID
    JOIN Departments d ON t.DepartmentID = d.DepartmentID
    JOIN Users u ON t.SurgeonID = u.UserID
    ORDER BY t.HospitalID ASC, t.RoomID ASC, t.DayOfWeek ASC
  `);
}

export async function saveMasterTemplate(hospitalId: number, roomId: number, dayOfWeek: number, departmentId: number, surgeonId: number) {
  await checkAdmin();
  const db = await openDb();
  
  // Check if exists
  const existing = await db.get(
    'SELECT TemplateID FROM Weekly_Master_Schedule WHERE HospitalID = ? AND RoomID = ? AND DayOfWeek = ?',
    [hospitalId, roomId, dayOfWeek]
  );

  if (existing) {
    await db.run(
      'UPDATE Weekly_Master_Schedule SET DepartmentID = ?, SurgeonID = ? WHERE TemplateID = ?',
      [departmentId, surgeonId, existing.TemplateID]
    );
  } else {
    await db.run(
      'INSERT INTO Weekly_Master_Schedule (HospitalID, RoomID, DayOfWeek, DepartmentID, SurgeonID) VALUES (?, ?, ?, ?, ?)',
      [hospitalId, roomId, dayOfWeek, departmentId, surgeonId]
    );
  }
}

export async function deleteMasterTemplate(templateId: number) {
  await checkAdmin();
  const db = await openDb();
  await db.run('DELETE FROM Weekly_Master_Schedule WHERE TemplateID = ?', [templateId]);
}

import { revalidatePath } from 'next/cache';

export async function updateProfileAction(prevState: any, formData: FormData) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    return { error: 'Unauthorized', success: false };
  }

  const fullName = formData.get('fullName') as string;
  const avatarUrl = formData.get('avatarUrl') as string;

  try {
    const db = await openDb();
    await db.run(
      'UPDATE Users SET FullName = ?, AvatarURL = ? WHERE UserID = ?',
      [fullName || null, avatarUrl || null, session.userId]
    );

    // Revalidate the global layout to refresh the Navbar instantly
    revalidatePath('/', 'layout');

    return { error: '', success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Failed to update profile', success: false };
  }
}
