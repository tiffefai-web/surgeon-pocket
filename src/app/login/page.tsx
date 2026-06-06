'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const initialState = {
  error: '',
  success: false,
  role: ''
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      if (state.role === 'Admin') {
        router.push('/admin');
      } else {
        router.push('/surgeon');
      }
    }
  }, [state.success, state.role, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-blue-900">
            Surgeon's Pocket
          </h2>
          <p className="mt-2 text-sm text-blue-600">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" action={formAction}>
          {state.error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
              {state.error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="Username"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-800 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
