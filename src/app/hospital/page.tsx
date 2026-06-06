import HospitalDashboardClient from './HospitalDashboardClient';

export default function HospitalPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Phitsanulok Hospital Global Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Global view of all Operating Rooms. Patient details are masked for cases belonging to other surgeons. 
          Cases missing mandatory consults/results scheduled for today or tomorrow will show a blinking warning.
        </p>
      </div>
      
      <HospitalDashboardClient />
    </div>
  );
}
