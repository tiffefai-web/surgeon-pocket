import AdminDashboardClient from './AdminDashboardClient';

export default function AdminDashboard() {
  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Main Hospital Dashboard</h1>
          <p className="text-gray-600">
            Global view of hospital operations, schedules, and room optimization.
          </p>
        </div>
      </div>
      
      <AdminDashboardClient />
    </div>
  );
}
