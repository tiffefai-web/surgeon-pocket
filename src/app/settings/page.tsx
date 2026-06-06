import GlobalNavbar from '@/components/GlobalNavbar';
import SettingsClient from './SettingsClient';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/auth';
import { openDb } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  const session = await decrypt(sessionToken);

  if (!session || !session.userId) {
    redirect('/login');
  }

  const db = await openDb();
  const user = await db.get('SELECT * FROM Users WHERE UserID = ?', [session.userId]);

  return (
    <>
      <GlobalNavbar 
        title="Account Settings" 
        role={user?.Role || 'User'} 
        secondaryLinks={
          <a href={user?.Role === 'Admin' ? '/admin' : '/surgeon'} className="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800 transition font-medium text-white">
            Back to Dashboard
          </a>
        }
      />
      <SettingsClient user={user} />
    </>
  );
}
