'use client';

import { useState, useRef, useEffect } from 'react';
import { logoutAction } from '@/app/actions/auth';

export default function NavbarClient({ user, role, title, bgClass = "bg-blue-600", secondaryLinks }: { user: any, role: string, title: string, bgClass?: string, secondaryLinks?: React.ReactNode }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.FullName || user?.Username || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav className={`${bgClass} text-white shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="font-bold text-xl">{title}</span>
          </div>
          <div className="flex items-center space-x-4">
            {secondaryLinks}
            <span className="text-sm font-medium border-l border-blue-400 pl-4">{role} View</span>
            
            {/* User Profile Widget */}
            <div className="relative ml-4" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 focus:outline-none hover:bg-blue-700 p-1 rounded-full transition"
              >
                {user?.AvatarURL ? (
                  <img src={user.AvatarURL} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-blue-300 shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold border border-blue-300 shadow-sm">
                    {initial}
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:block">{displayName}</span>
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 z-50 border border-gray-100">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm text-gray-900 font-bold truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.Role}</p>
                  </div>
                  <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors">
                    Profile Settings
                  </a>
                  <form action={logoutAction}>
                    <button type="submit" className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      Logout
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
}
