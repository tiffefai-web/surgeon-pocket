'use client';

import { useActionState, useEffect, useState } from 'react';
import { changePasswordAction } from '@/app/actions/auth';
import { updateProfileAction } from '@/app/actions/settings';
import GlobalNavbar from '@/components/GlobalNavbar';

export default function SettingsClient({ user }: { user: any }) {
  const [pwdState, pwdFormAction, isPwdPending] = useActionState(changePasswordAction, { error: '', success: false });
  const [profState, profFormAction, isProfPending] = useActionState(updateProfileAction, { error: '', success: false });
  
  const [successMsg, setSuccessMsg] = useState('');
  const [profSuccessMsg, setProfSuccessMsg] = useState('');
  
  const [avatarPreview, setAvatarPreview] = useState(user?.AvatarURL || '');

  useEffect(() => {
    if (pwdState?.success) {
      setSuccessMsg('Password successfully changed.');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  }, [pwdState]);

  useEffect(() => {
    if (profState?.success) {
      setProfSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfSuccessMsg(''), 3000);
    }
  }, [profState]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16 w-full space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>

        {/* Profile Information */}
        <div className="bg-white shadow-xl rounded-xl border border-blue-50 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4 border-b border-blue-700">
            <h2 className="text-xl font-bold text-white">Personal Information</h2>
          </div>

          <form action={profFormAction} className="p-6 space-y-6">
            {profState?.error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium text-sm">
                {profState.error}
              </div>
            )}
            
            {profSuccessMsg && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg font-medium text-sm">
                {profSuccessMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input 
                name="fullName" 
                type="text" 
                defaultValue={user?.FullName || ''}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" 
                placeholder="Dr. John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avatar Image URL</label>
              <div className="flex gap-4 items-start">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-gray-300 flex-shrink-0 shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-400 font-bold flex-shrink-0">
                    N/A
                  </div>
                )}
                <input 
                  name="avatarUrl" 
                  type="url" 
                  value={avatarPreview}
                  onChange={(e) => setAvatarPreview(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border mt-3" 
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Paste a direct image URL (e.g. .png, .jpg) to update your profile picture. It will preview instantly.</p>
            </div>

            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button 
                type="submit" 
                disabled={isProfPending} 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium disabled:opacity-50 flex items-center shadow-lg"
              >
                {isProfPending ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white shadow-xl rounded-xl border border-blue-50 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4 border-b border-blue-700">
            <h2 className="text-xl font-bold text-white">Change Password</h2>
          </div>

          <form action={pwdFormAction} className="p-6 space-y-6">
            {pwdState?.error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium text-sm">
                {pwdState.error}
              </div>
            )}
            
            {successMsg && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg font-medium text-sm">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
              <input 
                name="currentPassword" 
                type="password" 
                required 
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
              <input 
                name="newPassword" 
                type="password" 
                required 
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
              <input 
                name="confirmPassword" 
                type="password" 
                required 
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" 
              />
            </div>
            <div className="pt-4 border-t border-gray-200 flex justify-end gap-4">
              <button 
                type="submit" 
                disabled={isPwdPending} 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium disabled:opacity-50 flex items-center justify-center shadow-lg"
              >
                {isPwdPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
