'use client';

import { useState, useEffect } from 'react';
import { getHospitals, getRooms, addRoom, deleteRoom, getDepartments, addDepartment, deleteDepartment, getSurgeons, getMasterTemplates, saveMasterTemplate, deleteMasterTemplate } from '@/app/actions/settings';

export default function AdminSettingsClient() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedHospitalForRoom, setSelectedHospitalForRoom] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  // Template Form States
  const [tHospital, setTHospital] = useState('');
  const [tRoom, setTRoom] = useState('');
  const [tDay, setTDay] = useState('');
  const [tDept, setTDept] = useState('');
  const [tSurgeon, setTSurgeon] = useState('');

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  async function loadData() {
    setLoading(true);
    try {
      const [hData, rData, dData, sData, tData] = await Promise.all([
        getHospitals(), getRooms(), getDepartments(), getSurgeons(), getMasterTemplates()
      ]);
      setHospitals(hData);
      setRooms(rData);
      setDepartments(dData);
      setSurgeons(sData);
      setTemplates(tData);
      if (hData.length > 0) {
        setSelectedHospitalForRoom(hData[0].HospitalID.toString());
        setTHospital(hData[0].HospitalID.toString());
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName || !selectedHospitalForRoom) return;
    await addRoom(Number(selectedHospitalForRoom), newRoomName);
    setNewRoomName('');
    loadData();
  };

  const handleDeleteRoom = async (id: number) => {
    if (confirm('Are you sure you want to delete this room?')) {
      await deleteRoom(id);
      loadData();
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;
    await addDepartment(newDeptName);
    setNewDeptName('');
    loadData();
  };

  const handleDeleteDept = async (id: number) => {
    if (confirm('Are you sure you want to delete this department?')) {
      await deleteDepartment(id);
      loadData();
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tHospital || !tRoom || !tDay || !tDept || !tSurgeon) return;
    await saveMasterTemplate(Number(tHospital), Number(tRoom), Number(tDay), Number(tDept), Number(tSurgeon));
    loadData();
  };

  const handleDeleteTemplate = async (id: number) => {
    if (confirm('Are you sure you want to clear this allocation?')) {
      await deleteMasterTemplate(id);
      loadData();
    }
  };

  if (loading) {
    return <div className="p-10 text-center animate-pulse">Loading settings...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Dynamic Rooms */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Dynamic Room Management</h2>
        
        <form onSubmit={handleAddRoom} className="flex gap-2 mb-6">
          <select 
            value={selectedHospitalForRoom} 
            onChange={e => setSelectedHospitalForRoom(e.target.value)}
            className="border p-2 rounded flex-1"
          >
            {hospitals.map(h => <option key={h.HospitalID} value={h.HospitalID}>{h.Name}</option>)}
          </select>
          <input 
            type="text" 
            placeholder="Room Name (e.g. OR 6)" 
            value={newRoomName} 
            onChange={e => setNewRoomName(e.target.value)} 
            className="border p-2 rounded flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add</button>
        </form>

        <div className="max-h-64 overflow-y-auto border rounded divide-y custom-scrollbar">
          {rooms.map(r => (
            <div key={r.RoomID} className="p-3 flex justify-between items-center hover:bg-gray-50">
              <div>
                <span className="font-bold">{r.RoomName}</span>
                <span className="text-sm text-gray-500 ml-2">({r.HospitalName})</span>
              </div>
              <button onClick={() => handleDeleteRoom(r.RoomID)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
            </div>
          ))}
        </div>
      </div>

      {/* Departments */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Department Management</h2>
        
        <form onSubmit={handleAddDept} className="flex gap-2 mb-6">
          <input 
            type="text" 
            placeholder="New Department Name" 
            value={newDeptName} 
            onChange={e => setNewDeptName(e.target.value)} 
            className="border p-2 rounded flex-1"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add</button>
        </form>

        <div className="max-h-64 overflow-y-auto border rounded divide-y custom-scrollbar flex flex-wrap p-2 gap-2">
          {departments.map(d => (
            <div key={d.DepartmentID} className="bg-gray-100 border px-3 py-1.5 rounded-full flex items-center text-sm">
              <span className="font-semibold">{d.Name}</span>
              <button onClick={() => handleDeleteDept(d.DepartmentID)} className="ml-2 text-gray-400 hover:text-red-600">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Master Templates */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Default Weekly OR Allocation</h2>
        
        <form onSubmit={handleSaveTemplate} className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 items-end bg-gray-50 p-4 rounded border">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Hospital</label>
            <select value={tHospital} onChange={e => {setTHospital(e.target.value); setTRoom('');}} className="w-full border p-2 rounded text-sm">
              <option value="">Select Hospital</option>
              {hospitals.map(h => <option key={h.HospitalID} value={h.HospitalID}>{h.Name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Room</label>
            <select value={tRoom} onChange={e => setTRoom(e.target.value)} className="w-full border p-2 rounded text-sm" disabled={!tHospital}>
              <option value="">Select Room</option>
              {rooms.filter(r => r.HospitalID.toString() === tHospital).map(r => <option key={r.RoomID} value={r.RoomID}>{r.RoomName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Day</label>
            <select value={tDay} onChange={e => setTDay(e.target.value)} className="w-full border p-2 rounded text-sm">
              <option value="">Select Day</option>
              {daysOfWeek.map((day, idx) => <option key={idx} value={idx}>{day}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Department</label>
            <select value={tDept} onChange={e => setTDept(e.target.value)} className="w-full border p-2 rounded text-sm">
              <option value="">Select Dept</option>
              {departments.map(d => <option key={d.DepartmentID} value={d.DepartmentID}>{d.Name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Surgeon</label>
            <select value={tSurgeon} onChange={e => setTSurgeon(e.target.value)} className="w-full border p-2 rounded text-sm">
              <option value="">Select Surgeon</option>
              {surgeons.map(s => <option key={s.UserID} value={s.UserID}>{s.Username}</option>)}
            </select>
          </div>
          <div>
            <button type="submit" className="w-full bg-indigo-600 text-white p-2 rounded text-sm font-bold hover:bg-indigo-700 transition">Save Allocation</button>
          </div>
        </form>

        <div className="overflow-x-auto border rounded">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-3">Hospital</th>
                <th className="p-3">Room</th>
                <th className="p-3">Day</th>
                <th className="p-3">Department</th>
                <th className="p-3">Surgeon</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">No default allocations set.</td></tr>
              ) : (
                templates.map(t => (
                  <tr key={t.TemplateID} className="hover:bg-gray-50">
                    <td className="p-3">{t.HospitalName}</td>
                    <td className="p-3 font-bold">{t.RoomName}</td>
                    <td className="p-3">{daysOfWeek[t.DayOfWeek]}</td>
                    <td className="p-3">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{t.DepartmentName}</span>
                    </td>
                    <td className="p-3 font-medium text-indigo-700">{t.SurgeonName}</td>
                    <td className="p-3">
                      <button onClick={() => handleDeleteTemplate(t.TemplateID)} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
