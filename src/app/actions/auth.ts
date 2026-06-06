'use server';

import { cookies } from 'next/headers';
import { encrypt } from '@/lib/auth';
import { openDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function loginAction(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required', success: false, role: '' };
  }

  const db = await openDb();
  const user = await db.get('SELECT * FROM Users WHERE Username = ?', [username]);

  if (!user) {
    return { error: 'Invalid username or password', success: false, role: '' };
  }

  const passwordMatch = await bcrypt.compare(password, user.PasswordHash);

  if (!passwordMatch) {
    return { error: 'Invalid username or password', success: false, role: '' };
  }

  // Create JWT session
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
  const session = await encrypt({
    userId: user.UserID,
    username: user.Username,
    role: user.Role,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  // Redirect based on role happens in the client or middleware,
  // but we can return success and the role here.
  return { error: '', success: true, role: user.Role };
}

import { redirect } from 'next/navigation';

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  redirect('/login');
}

import { decrypt } from '@/lib/auth';

export async function changePasswordAction(prevState: any, formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'All fields are required', success: false };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match', success: false };
  }

  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long', success: false };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    return { error: 'Unauthorized', success: false };
  }

  const db = await openDb();
  const user = await db.get('SELECT * FROM Users WHERE UserID = ?', [session.userId]);

  if (!user) {
    return { error: 'User not found', success: false };
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.PasswordHash);

  if (!passwordMatch) {
    return { error: 'Incorrect current password', success: false };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await db.run('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [newPasswordHash, session.userId]);

  return { error: '', success: true };
}
