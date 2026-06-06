'use client';

import { useState, useEffect, useRef } from 'react';
import { getMonthlyCases, getSurgeonLeaves, toggleSurgeonLeave, getCurrentUsername, getRoomWeeklyCases } from '@/app/actions/dashboard';
import { getDailyRemark, saveDailyRemark, reorderAndCascadeCases, updateCaseStatus, getCaseHistory, rescheduleCaseAction } from '@/app/actions/daily';
import { getHospitals, getRooms } from '@/app/actions/settings';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO, isSameDay, startOfWeek, endOfWeek, addWeeks, subWeeks, subDays } from 'date-fns';
import { isHoliday } from '@/lib/holidays';
import { updateAdmissionStatus } from '@/app/actions/cases';
import PrintableSlate from '@/components/PrintableSlate';
import DailySchedule from '@/components/DailySchedule';
import { useReactToPrint } from 'react-to-print';

// --- Main Component ---
export default function DashboardClient() {
  const [currentDate, setCurrentDate] = useState(new Date('2026-06-01'));
  const [cases, setCases] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [username, setUsername] = useState('System');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'room'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRoom, setSelectedRoom] = useState('OR 1');
  const [actionPending, setActionPending] = useState(false);

  // Room Grid State
  const [selectedLocation, setSelectedLocation] = useState('Main Hospital');
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [roomWeeklyCases, setRoomWeeklyCases] = useState<any[]>([]);
  const [gridWeekStart, setGridWeekStart] = useState<Date>(startOfWeek(new Date('2026-06-01'), { weekStartsOn: 0 }));

  // Admission Modal State
  const [admissionModal, setAdmissionModal] = useState<{caseId: number, name: string, hn: string, surgeryDate: string, isAdmitted: boolean} | null>(null);

  // Daily Features State
  const [dailyRemark, setDailyRemark] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Surgical_Slate_${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'Schedule'}`,
  });

  async function loadData() {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const [monthlyCases, monthlyLeaves, hospitals, rooms] = await Promise.all([
        getMonthlyCases(year, month),
        getSurgeonLeaves(year, month),
        getHospitals(),
        getRooms()
      ]);

      setCases(monthlyCases);
      setLeaves(monthlyLeaves);
      setHospitalsList(hospitals);
      setRoomsList(rooms);
      
      const currentUser = await getCurrentUsername();
      setUsername(currentUser);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentDate]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      getDailyRemark(dateStr).then(remark => setDailyRemark(remark || ''));
    }
  }, [selectedDate]);

  const handleSaveRemark = async () => {
    if (!selectedDate) return;
    setSavingRemark(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await saveDailyRemark(dateStr, dailyRemark);
    setSavingRemark(false);
  };

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDayTotalMinutes = (date: Date) => {
    return cases.filter(c => isSameDay(parseISO(c.Date), date) && c.CaseStatus !== 'Off-case').reduce((total, c) => {
      const start = new Date(`${c.Date}T${c.StartTime}:00`);
      const end = new Date(`${c.Date}T${c.EndTime}:00`);
      return total + ((end.getTime() - start.getTime()) / 60000);
    }, 0);
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleToggleLeave = async (dateStr: string) => {
    setActionPending(true);
    await toggleSurgeonLeave(dateStr, 'OR 1');
    await loadData();
    setActionPending(false);
  };

  const renderCalendar = () => {
    const firstDayOfWeek = monthStart.getDay(); 
    const emptyCells = Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-100"></div>);

    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 text-center text-sm font-semibold text-gray-600">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {emptyCells}
          {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayCases = cases.filter(c => c.Date === dateStr && c.CaseStatus !== 'Off-case');
            
            // Calculate admissions for this day
            const dayAdmissions = cases.filter(c => c.PatientType === 'IPD' && c.CaseStatus !== 'Off-case' && c.Date && isSameDay(subDays(parseISO(c.Date), c.AdmitDaysPrior || 1), day));

            const totalMins = getDayTotalMinutes(day);
            const isFullyBooked = totalMins >= 480; 
            const hasCases = dayCases.length > 0;
            const hasPrivateCases = dayCases.some(c => c.Location === 'Private Clinic' || c.Location === 'Private Hospital' || c.Location === 'Other');
            const isHolidayDate = isHoliday(dateStr);
            const isAway = leaves.some(l => l.Date === dateStr);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            let bgClass = "bg-white hover:bg-gray-50 cursor-pointer";
            if (isSelected) bgClass = "bg-blue-50 border-blue-500 border-2 z-10 shadow-sm cursor-pointer";
            else if (isAway) bgClass = "bg-purple-50 hover:bg-purple-100 cursor-pointer border-purple-200";
            else if (isHolidayDate) bgClass = "bg-gray-100 hover:bg-gray-200 cursor-pointer opacity-80";
            else if (hasPrivateCases) bgClass = "bg-indigo-50 hover:bg-indigo-100 cursor-pointer";
            else if (isFullyBooked) bgClass = "bg-red-50 hover:bg-red-100 cursor-pointer";
            else if (hasCases) bgClass = "bg-green-50 hover:bg-green-100 cursor-pointer";

            let indicatorClass = "bg-gray-200";
            if (hasPrivateCases) indicatorClass = "bg-indigo-500";
            else if (isFullyBooked) indicatorClass = "bg-red-500";
            else if (hasCases) indicatorClass = "bg-green-500";

            return (
              <div 
                key={day.toISOString()} 
                onClick={() => setSelectedDate(day)}
                className={`h-24 border border-gray-100 p-2 transition-colors relative ${bgClass}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasCases && !isAway && <div className={`w-2 h-2 rounded-full ${indicatorClass}`}></div>}
                </div>
                {isAway && (
                  <div className="mt-2 text-xs text-purple-700 font-bold flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    AWAY
                  </div>
                )}
                {isHolidayDate && !isAway && (
                  <div className="mt-2 text-xs text-gray-500 font-bold flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>
                    HOLIDAY
                  </div>
                )}
                {hasCases && !isAway && !isHolidayDate && (
                  <div className="mt-2 text-xs text-gray-500 font-medium">
                    {Math.round(totalMins / 60 * 10) / 10}h scheduled
                  </div>
                )}
                {isFullyBooked && !isAway && !isHolidayDate && (
                  <div className="mt-1 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                    Full Slot
                  </div>
                )}
                
                {dayAdmissions.map(adm => (
                  <div 
                    key={`adm-${adm.CaseID}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdmissionModal({
                        caseId: adm.CaseID,
                        name: `${adm.FirstName} ${adm.LastName}`,
                        hn: adm.Patient_HN,
                        surgeryDate: adm.Date,
                        isAdmitted: adm.IsAdmitted === 1
                      });
                    }}
                    className={`mt-1 text-[10px] flex items-center p-1 rounded font-semibold cursor-pointer ${adm.IsAdmitted ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200'} transition-colors`}
                    title={`Admit for Surgery on ${adm.Date}`}
                  >
                    <span className="mr-1">🛏️</span>
                    <span className="truncate">Admit: {adm.FirstName}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRoomGrid = () => {
    const weekDays = eachDayOfInterval({ start: gridWeekStart, end: endOfWeek(gridWeekStart) });
    return (
      <div className="space-y-4 animate-fade-in-up">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow border border-blue-100 gap-4">
          <div className="flex gap-4">
            <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-8 font-medium text-gray-900">
              {hospitalsList.map(h => <option key={h.HospitalID} value={h.Name}>{h.Name === 'Main Hospital' ? 'Phitsanulok Hospital' : h.Name}</option>)}
              <option value="Private Clinic">Private Clinic</option>
              <option value="Other Hospital">Other Hospital</option>
            </select>
            <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 pl-3 pr-8 font-medium text-gray-900">
              {roomsList.map(r => <option key={r.RoomID} value={r.RoomName}>{r.RoomName}</option>)}
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <button onClick={() => setGridWeekStart(subWeeks(gridWeekStart, 1))} className="p-2 text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg hover:bg-blue-50 border">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
            <div className="text-sm font-bold text-blue-900 w-36 text-center">
              {format(gridWeekStart, 'MMM d')} - {format(endOfWeek(gridWeekStart), 'MMM d, yyyy')}
            </div>
            <button onClick={() => setGridWeekStart(addWeeks(gridWeekStart, 1))} className="p-2 text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 rounded-lg hover:bg-blue-50 border">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl shadow overflow-hidden border border-blue-200">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-blue-50">
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-3 text-center border-r border-blue-100 last:border-r-0">
                <div className="text-xs font-semibold text-blue-800 uppercase">{format(day, 'EEE')}</div>
                <div className={`text-lg font-bold mt-1 ${isSameDay(day, new Date()) ? 'text-blue-600 bg-blue-200 rounded-full w-8 h-8 mx-auto flex items-center justify-center' : 'text-gray-900'}`}>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[500px]">
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayCases = roomWeeklyCases.filter(c => c.Date === dateStr);
              return (
                <div key={dateStr} className="border-r border-gray-100 last:border-r-0 relative group">
                  {/* Clickable Background for booking */}
                  <div className="absolute inset-0 z-0 p-1">
                    <a 
                      href={`/surgeon/cases/new?date=${dateStr}&location=${encodeURIComponent(selectedLocation)}&room=${encodeURIComponent(selectedRoom)}`} 
                      className="w-full h-full block rounded-lg hover:bg-blue-50/50 transition-colors cursor-pointer"
                      title="Click to add new case"
                    ></a>
                  </div>
                  {/* Cases Foreground */}
                  <div className="relative z-10 flex flex-col p-1.5 gap-2 pointer-events-none">
                    {dayCases.map(c => (
                      <a 
                        href={`/surgeon/cases/${c.CaseID}`} 
                        key={c.CaseID} 
                        className="block bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs p-2 rounded-lg shadow-sm hover:shadow-md hover:bg-indigo-100 transition-colors pointer-events-auto"
                      >
                        <div className="font-bold text-indigo-700 flex justify-between items-center mb-1">
                          <span>{c.StartTime} - {c.EndTime}</span>
                          {c.CaseStatus !== 'Active' && <span className="text-[10px] bg-red-100 text-red-800 px-1.5 rounded">{c.CaseStatus}</span>}
                        </div>
                        <div className="font-semibold truncate">
                          {c.FirstName} {c.LastName !== 'Patient' && c.LastName ? c.LastName[0] + '.' : ''} 
                          <span className="font-normal text-gray-500 ml-1">({c.Patient_HN})</span>
                        </div>
                        <div className="truncate text-indigo-600/80 mt-0.5">{c.Operation}</div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 mt-8 pb-32">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow border border-blue-100">
        <div className="flex space-x-2">
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Monthly Heatmap
          </button>
          <button 
            onClick={() => setViewMode('room')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'room' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Room Grid
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <h2 className="text-xl font-bold text-blue-900 w-40 text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-96 flex items-center justify-center bg-white rounded-lg shadow border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        viewMode === 'calendar' ? renderCalendar() : renderRoomGrid()
      )}

      {/* Inline Daily Details Section */}
      {selectedDate && (
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden animate-fade-in-up">
          <div className="bg-blue-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Schedule for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="flex gap-2">
              {(() => {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const isHolidayDate = isHoliday(dateStr);
                const isAway = leaves.some(l => l.Date === dateStr);
                
                if (isHolidayDate && !isAway) return null;

                return (
                  <>
                    <button 
                      onClick={handlePrint}
                      className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded shadow hover:bg-indigo-600 transition font-medium mr-2"
                    >
                      <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                      Export PDF
                    </button>
                    <button 
                      onClick={() => handleToggleLeave(dateStr)}
                      disabled={actionPending}
                      className={`px-3 py-1.5 text-sm rounded transition font-medium ${isAway ? 'bg-white text-blue-900 hover:bg-gray-100' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                    >
                      {actionPending ? 'Updating...' : isAway ? "I'm Back (Remove Away)" : "Mark as Away & Yield Room"}
                    </button>
                    {!isAway && (
                      <a 
                        href={`/surgeon/cases/new?date=${dateStr}`}
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded shadow hover:bg-blue-400 transition font-medium"
                      >
                        + Add Case
                      </a>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="p-6">
            {/* Daily Remark Widget */}
            <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <label className="text-sm font-bold text-yellow-800 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  Daily Personal Remark
                </label>
                <button 
                  onClick={handleSaveRemark}
                  disabled={savingRemark}
                  className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 transition shadow-sm"
                >
                  {savingRemark ? 'Saving...' : 'Save Note'}
                </button>
              </div>
              <textarea 
                value={dailyRemark}
                onChange={(e) => setDailyRemark(e.target.value)}
                placeholder="E.g., Starting at 10 AM today due to morning conference..."
                className="w-full bg-white border border-yellow-300 rounded p-3 text-sm text-gray-800 focus:ring-yellow-500 focus:border-yellow-500 shadow-inner resize-none"
                rows={2}
              ></textarea>
            </div>

            {/* Daily Timeline List */}
            {(() => {
              const dayCases = cases.filter(c => isSameDay(parseISO(c.Date), selectedDate));
              if (dayCases.length === 0) return <p className="text-gray-500 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">No cases scheduled for this day.</p>;
              
              const activeCases = dayCases.filter(c => c.CaseStatus !== 'Off-case');
              const offCases = dayCases.filter(c => c.CaseStatus === 'Off-case');

              return (
                <div className="space-y-4">
                  <DailySchedule cases={dayCases} role="surgeon" onRefresh={loadData} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Hidden Printable Component */}
      <div style={{ display: 'none' }}>
        {selectedDate && (
          <PrintableSlate 
            ref={printRef} 
            date={selectedDate} 
            cases={cases.filter(c => isSameDay(parseISO(c.Date), selectedDate))} 
            title="Personal Surgical Slate" 
            printedBy={username}
          />
        )}
      </div>

    </div>
  );
}

