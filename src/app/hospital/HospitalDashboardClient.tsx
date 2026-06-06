'use client';

import React, { useState, useEffect } from 'react';
import { getGlobalCases, getSurgeonLeaves, getCurrentUsername } from '@/app/actions/dashboard';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addDays, parseISO } from 'date-fns';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import PrintableSlate from '@/components/PrintableSlate';

export default function HospitalDashboardClient() {
  const [currentDate, setCurrentDate] = useState(new Date('2026-06-08'));
  const [cases, setCases] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [username, setUsername] = useState('System');
  const [loading, setLoading] = useState(true);

  // New State for Drill-Down View
  const [selectedSlot, setSelectedSlot] = useState<{ room: string, dateStr: string, location: string, isHoliday: boolean } | null>(null);

  const HOSPITALS = ['Main Hospital', 'Bueng Kaeng Yai Hospital'];
  const ROOMS = ['OR 1', 'OR 2', 'OR 3', 'OR 4'];

  const printRef = useRef<HTMLDivElement>(null);
  const [printModalDate, setPrintModalDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Global_Surgical_Slate_${printModalDate}`,
  });
  
  const executePrint = () => {
    if (printModalDate) {
      setTimeout(() => handlePrint(), 100);
      setShowPrintModal(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const [casesData, leavesData, fetchedUsername] = await Promise.all([
          getGlobalCases(year, month),
          getSurgeonLeaves(year, month),
          getCurrentUsername()
        ]);
        setCases(casesData);
        setLeaves(leavesData);
        setUsername(fetchedUsername);
      } catch (error) {
        console.error('Failed to load data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentDate]);

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));

  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getMins = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const today = new Date('2026-06-05T23:50:00+07:00');
  const tomorrow = addDays(today, 1);
  const todayStr = format(today, 'yyyy-MM-dd');
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  return (
    <div className="mt-4 space-y-6">
      {/* Main Header with Back Button */}
      <div className="flex justify-between items-center bg-blue-600 p-6 shadow-md border-b border-blue-700 rounded-lg">
        <div className="flex items-center text-white">
          <a href="/surgeon" className="mr-4 hover:text-blue-200 transition flex items-center bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back
          </a>
          <div>
            <h1 className="text-3xl font-bold">Global Hospital Dashboard</h1>
            <p className="text-blue-100 mt-1">Complete OR Utilization & Booking System</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-lg shadow border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : selectedSlot ? (
        // --- DETAIL VIEW ---
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-fade-in-up">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedSlot.location === 'Main Hospital' ? 'Phitsanulok Hospital' : selectedSlot.location} - {selectedSlot.room}</h2>
              <p className="text-gray-600 mt-1 text-lg">{format(parseISO(selectedSlot.dateStr), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <button onClick={() => setSelectedSlot(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition flex items-center shadow-sm">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Back to Matrix
            </button>
          </div>

          {selectedSlot.isHoliday ? (
            <div className="bg-gray-50 text-gray-800 p-12 rounded-xl border-2 border-gray-200 text-center shadow-sm">
              <div className="text-6xl mb-4">👑</div>
              <h3 className="text-3xl font-bold mb-2">Public Holiday</h3>
              <p className="text-xl">No routine cases scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const roomCases = cases.filter(c => c.Date === selectedSlot.dateStr && c.RoomNumber === selectedSlot.room && c.Location === selectedSlot.location);
                const yieldedBy = leaves.find(l => l.Date === selectedSlot.dateStr && l.Yielded_RoomNumber === selectedSlot.room);

                if (yieldedBy) {
                  return (
                    <div className="bg-blue-50 border-2 border-blue-400 p-10 rounded-xl text-center shadow-sm">
                      <h3 className="text-blue-800 font-bold text-2xl">Surgeon Away / In Meeting</h3>
                      <p className="text-blue-700 mt-3 text-xl font-medium">Dr. {yieldedBy.Username || 'Surgeon'}</p>
                    </div>
                  );
                }

                if (roomCases.length === 0) {
                  return <div className="text-center text-gray-400 py-16 text-xl font-medium border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">No cases scheduled for this slot.</div>;
                }

                return roomCases.map(c => {
                  const needsAlert = (c.Date === todayStr || c.Date === tomorrowStr) && (c.ConsultAnes_Status === 0 || c.MedResult_Status === 0);
                  const isMasked = c.Patient_HN === '***';
                  
                  return (
                    <div key={c.CaseID} className={`relative p-5 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 md:items-center justify-between ${isMasked ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-100 hover:border-blue-300 transition'}`}>
                      {needsAlert && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full animate-ping flex items-center justify-center opacity-75"></div>
                      )}
                      {needsAlert && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg" title="Missing Consult or Med Result!">
                          <span className="text-white font-bold text-sm">!</span>
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-lg text-lg border border-indigo-200 shadow-sm">
                            {c.StartTime} - {c.EndTime}
                          </span>
                          <span className="text-sm bg-blue-100 text-blue-800 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider border border-blue-200 shadow-sm">
                            {c.Department || 'N/A'}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-xl">
                          {c.FirstName} {c.LastName !== 'Patient' ? c.LastName[0] + '.' : ''}
                        </h3>
                        <p className="text-gray-600 font-medium text-base mt-1">{c.Operation}</p>
                      </div>
                      
                      <div className="md:text-right bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm min-w-[200px]">
                        <div className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">Surgeon</div>
                        <div className="font-bold text-blue-900 text-lg truncate">{c.SurgeonName}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      ) : (
        // --- MATRIX VIEW ---
        <>
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow border border-blue-100 animate-fade-in-up">
            <h2 className="text-xl font-bold text-gray-900 ml-2">Heatmap Matrix View</h2>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded shadow hover:bg-indigo-600 transition font-medium mr-2 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Export PDF
              </button>
              <button onClick={prevWeek} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              </button>
              <div className="text-lg font-bold text-blue-900 text-center w-48">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </div>
              <button onClick={nextWeek} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr>
                    <th className="p-3 border-b border-r bg-gray-50 font-bold text-gray-700 w-40 sticky left-0 z-10 text-center">Hospital / Room</th>
                    {daysInWeek.map(day => (
                      <th key={day.toISOString()} className="p-3 border-b bg-gray-50 font-bold text-gray-700 text-center min-w-[140px]">
                        <div className="text-sm uppercase tracking-wider text-gray-500">{format(day, 'EEE')}</div>
                        <div className="text-lg text-gray-900">{format(day, 'MMM d')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOSPITALS.map(hospital => (
                    <React.Fragment key={hospital}>
                      <tr>
                        <td colSpan={daysInWeek.length + 1} className="bg-blue-50 p-3 font-bold text-blue-900 border-b border-t uppercase text-sm tracking-widest shadow-inner">
                          {hospital === 'Main Hospital' ? 'Phitsanulok Hospital' : hospital}
                        </td>
                      </tr>
                      {ROOMS.map(room => (
                        <tr key={`${hospital}-${room}`}>
                          <td className="p-4 border-b border-r font-bold text-gray-700 bg-gray-50/50 sticky left-0 z-10 text-center">{room}</td>
                          {daysInWeek.map(day => {
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const isHoliday = dayStr === '2026-06-10'; // Wednesday
                            const roomCases = cases.filter(c => c.Date === dayStr && c.RoomNumber === room && c.Location === hospital);
                            
                            const yieldedBy = leaves.find(l => l.Date === dayStr && l.Yielded_RoomNumber === room);

                            if (isHoliday) {
                              return (
                                <td key={day.toISOString()} onClick={() => setSelectedSlot({ room, dateStr: dayStr, location: hospital, isHoliday: true })} className="p-2 border-b border-gray-100 align-middle text-center cursor-pointer hover:opacity-80 transition hover:bg-gray-100 group">
                                  <div className="bg-gray-400 text-white rounded-lg font-bold text-sm p-4 shadow-sm mx-auto group-hover:scale-105 transition-transform">
                                    HOLIDAY
                                  </div>
                                </td>
                              );
                            }

                            let totalMins = 0;
                            roomCases.forEach(c => {
                              totalMins += (getMins(c.EndTime) - getMins(c.StartTime));
                            });
                            const isFull = totalMins >= 480;

                            if (yieldedBy) {
                              return (
                                <td key={day.toISOString()} onClick={() => setSelectedSlot({ room, dateStr: dayStr, location: hospital, isHoliday: false })} className="p-2 border-b border-gray-100 align-middle text-center cursor-pointer hover:opacity-80 transition hover:bg-blue-50 group">
                                  <div className="bg-blue-500 text-white rounded-lg font-bold text-sm p-4 shadow-sm mx-auto group-hover:scale-105 transition-transform">
                                    AWAY
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={day.toISOString()} onClick={() => setSelectedSlot({ room, dateStr: dayStr, location: hospital, isHoliday: false })} className="p-2 border-b border-gray-100 align-middle text-center cursor-pointer hover:opacity-80 transition hover:bg-gray-50 group">
                                <div className={`rounded-lg font-bold text-sm p-4 shadow-sm mx-auto text-white group-hover:scale-105 transition-transform ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`}>
                                  {isFull ? 'FULL' : 'AVAILABLE'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print Date Picker Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-fade-in-up">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Select Date to Export</h3>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Print Date</label>
              <input 
                type="date" 
                value={printModalDate}
                onChange={e => setPrintModalDate(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 font-medium transition"
              >
                Cancel
              </button>
              <button 
                onClick={executePrint}
                disabled={!printModalDate}
                className="px-4 py-2 text-white bg-indigo-600 rounded hover:bg-indigo-700 font-medium transition disabled:opacity-50"
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Component */}
      <div style={{ display: 'none' }}>
        {printModalDate && (
          <PrintableSlate 
            ref={printRef} 
            date={parseISO(printModalDate)} 
            cases={cases.filter(c => c.Date === printModalDate && c.Location === 'Main Hospital')} 
            title="Global Surgical Slate" 
            printedBy={username}
          />
        )}
      </div>

    </div>
  );
}
