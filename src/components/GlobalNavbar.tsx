import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { openDb } from '@/lib/db';
import NavbarClient from './NavbarClient';
import React from 'react';

export default async function GlobalNavbar({ title, role, bgClass, secondaryLinks }: { title: string, role: string, bgClass?: string, secondaryLinks?: React.ReactNode }) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  let user = null;
  if (session && session.userId) {
    const db = await openDb();
    user = await db.get('SELECT UserID, Username, Role, FullName, AvatarURL FROM Users WHERE UserID = ?', [session.userId]);
  }

  return (
    <NavbarClient 
      user={user} 
      role={role} 
      title={title} 
      bgClass={bgClass}
      secondaryLinks={secondaryLinks}
    />
  );
}
