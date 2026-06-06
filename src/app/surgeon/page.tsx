import DashboardClient from './DashboardClient';

export default function SurgeonDashboard() {
  return (
    <div className="bg-transparent">
      <div className="flex justify-between items-center mb-2 px-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Personal Dashboard</h1>
          <p className="text-gray-600">
            Manage your surgical schedule and room utilization.
          </p>
        </div>
        <a href="/surgeon/cases/new" className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Add New Case
        </a>
      </div>
      
      <DashboardClient />
    </div>
  );
}
