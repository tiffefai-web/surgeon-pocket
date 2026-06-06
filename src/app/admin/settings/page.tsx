import AdminSettingsClient from './AdminSettingsClient';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center space-x-4 mb-4">
        <a href="/admin" className="text-blue-600 hover:text-blue-800 font-medium flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Dashboard
        </a>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Master Data Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage dynamic hospital rooms, departments, and default weekly OR schedules.
        </p>
      </div>

      <AdminSettingsClient />
    </div>
  );
}
