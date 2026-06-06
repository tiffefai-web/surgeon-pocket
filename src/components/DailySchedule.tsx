'use client';

import React, { useState } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderAndCascadeCases, updateCaseStatus, getCaseHistory, rescheduleCaseAction } from '@/app/actions/daily';

const PRESET_REASONS = ["Patient sick", "Doctor in meeting", "Added Public Holiday", "Equipment failure", "Other"];

// --- Sortable Item Component ---
function SortableCaseCard({ c, idx, handleStatusChange, handleViewHistory, handleRescheduleClick, role }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.CaseID });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const isActive = c.CaseStatus === 'Active';
  const isPrivate = c.Location === 'Private Clinic' || c.Location === 'Private Hospital' || c.Location === 'Other';
  const isBueng = c.Location === 'Bueng Kaeng Yai Hospital';

  let cardBorder = "border-gray-200";
  let timeText = "text-gray-900";
  let roomBadge = "bg-blue-100 text-blue-800";
  let dragHandleBg = "bg-gray-50 hover:bg-gray-100";
  let dragHandleText = "text-gray-500";
  let dragHandleIcon = "text-gray-400";
  let hospitalBadge = null;

  if (isBueng) {
    cardBorder = "border-emerald-300";
    timeText = "text-emerald-900";
    roomBadge = "bg-emerald-100 text-emerald-800";
    dragHandleBg = "bg-emerald-500 hover:bg-emerald-600";
    dragHandleText = "text-white";
    dragHandleIcon = "text-emerald-100";
    hospitalBadge = <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded uppercase tracking-wider">Bueng Kaeng Yai</span>;
  } else if (isPrivate) {
    cardBorder = "border-sky-300";
    timeText = "text-sky-900";
    roomBadge = "bg-sky-100 text-sky-800";
    dragHandleBg = "bg-sky-500 hover:bg-sky-600";
    dragHandleText = "text-white";
    dragHandleIcon = "text-sky-100";
    hospitalBadge = <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 rounded uppercase tracking-wider">{c.Location}</span>;
  }

  const editHref = role === 'admin' ? `/admin/cases/${c.CaseID}` : `/surgeon/cases/${c.CaseID}`;

  return (
    <div ref={setNodeRef} style={style} className={`border rounded-xl flex shadow-sm bg-white ${cardBorder} relative overflow-hidden`}>
      {/* Drag Handle (Color Band) */}
      <div 
        {...attributes} 
        {...listeners} 
        className={`${dragHandleBg} border-r ${cardBorder} p-2 flex flex-col items-center justify-center w-12 shrink-0 cursor-grab active:cursor-grabbing transition-colors touch-none`}
      >
        <svg className={`w-5 h-5 ${dragHandleIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
        <span className={`text-xs font-bold my-1 ${dragHandleText}`}>{idx + 1}</span>
      </div>

      {/* Main Card Content */}
      <div className="p-4 flex-1 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`font-bold text-lg ${timeText}`}>{c.StartTime} - {c.EndTime}</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${roomBadge}`}>{c.RoomNumber || 'N/A'}</span>
            {hospitalBadge}
            
            {/* Status Dropdown */}
            <div className="relative inline-block ml-2 group">
              <select 
                value={c.CaseStatus}
                onChange={(e) => handleStatusChange(c.CaseID, e.target.value)}
                className={`appearance-none text-xs font-bold pl-3 pr-6 py-1 rounded-full border shadow-sm cursor-pointer outline-none ${isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
              >
                <option value="Active" className="text-black bg-white">Active</option>
                <option value="Postponed" className="text-black bg-white">Postponed</option>
                <option value="Off-case" className="text-black bg-white">Off-case</option>
              </select>
              <svg className={`w-3 h-3 absolute right-2 top-1.5 pointer-events-none ${isActive ? 'text-green-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
            
            {role === 'admin' && (
              <span className="ml-2 text-xs font-bold text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full bg-gray-50">Dr. {c.SurgeonName || c.Username || 'Unknown'}</span>
            )}
          </div>
          
          <div className={`font-medium text-blue-900`}>
            {c.FirstName} {c.LastName} <span className="text-sm font-normal text-gray-500 ml-1">(HN: {c.Patient_HN})</span>
          </div>
          {c.ContactPhone && (
            <div className="text-sm text-gray-500 mt-0.5 flex items-center">
              <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              <a href={`tel:${c.ContactPhone.replace(/[^0-9+]/g, '')}`} className="text-blue-600 hover:text-blue-800 hover:underline">{c.ContactPhone}</a>
            </div>
          )}
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-semibold">{c.Diagnosis}</span> • {c.Operation}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex sm:flex-col gap-2 shrink-0">
          <button 
            onClick={() => handleViewHistory(c.CaseID)}
            className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            View History
          </button>
          <button 
            onClick={() => handleRescheduleClick(c)}
            className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded flex items-center justify-center transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Change Date
          </button>
          <a 
            href={editHref}
            className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded flex items-center justify-center transition-colors font-medium"
          >
            Edit Case
          </a>
        </div>
      </div>
      
    </div>
  );
}


export default function DailySchedule({ cases, role, onRefresh }: { cases: any[], role: 'admin' | 'surgeon', onRefresh: () => void }) {
  const [localCases, setLocalCases] = useState<any[]>(cases);
  const [actionPending, setActionPending] = useState(false);

  // Modals
  const [showReasonModal, setShowReasonModal] = useState<{ type: 'off-case' | 'reschedule', case: any } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonPreset, setReasonPreset] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState<number | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);

  // Update local state when props change
  React.useEffect(() => {
    setLocalCases(cases);
  }, [cases]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Filter to only active cases (the ones in the sortable list)
    const dayActiveCases = localCases.filter(c => c.CaseStatus !== 'Off-case');
    if (dayActiveCases.length === 0) return;

    const anchorStartTime = dayActiveCases[0].StartTime;

    const oldIndex = dayActiveCases.findIndex(c => c.CaseID === active.id);
    const newIndex = dayActiveCases.findIndex(c => c.CaseID === over.id);

    const reorderedCases = arrayMove(dayActiveCases, oldIndex, newIndex);
    const caseIdsInOrder = reorderedCases.map(c => c.CaseID);

    // Optimistically cascade times
    let currentStartTimeMinutes = 0;
    if (anchorStartTime) {
      const [ah, am] = anchorStartTime.split(':').map(Number);
      currentStartTimeMinutes = ah * 60 + am;
    }

    const cascadedCases = reorderedCases.map((c, i) => {
      const [sh, sm] = c.StartTime.split(':').map(Number);
      const [eh, em] = c.EndTime.split(':').map(Number);
      const durationMins = (eh * 60 + em) - (sh * 60 + sm);

      let newStartH, newStartM, newEndH, newEndM;

      newStartH = Math.floor(currentStartTimeMinutes / 60);
      newStartM = currentStartTimeMinutes % 60;

      currentStartTimeMinutes += durationMins;
      newEndH = Math.floor(currentStartTimeMinutes / 60);
      newEndM = currentStartTimeMinutes % 60;

      return {
        ...c,
        SequenceOrder: i + 1,
        StartTime: `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}`,
        EndTime: `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`
      };
    });

    setLocalCases(prev => prev.map(c => {
      const cascaded = cascadedCases.find(cc => cc.CaseID === c.CaseID);
      return cascaded ? cascaded : c;
    }));

    setActionPending(true);
    try {
      await reorderAndCascadeCases(caseIdsInOrder, anchorStartTime);
      onRefresh(); // Trigger parent reload
    } catch (e) {
      console.error(e);
      alert('Failed to update schedule sequence.');
    } finally {
      setActionPending(false);
    }
  };

  const handleStatusChange = (caseId: number, newStatus: string) => {
    const targetCase = localCases.find(c => c.CaseID === caseId);
    if (newStatus === 'Off-case') {
      setReasonPreset('');
      setReasonText('');
      setShowReasonModal({ type: 'off-case', case: targetCase });
    } else {
      setLocalCases(prev => prev.map(c => c.CaseID === caseId ? { ...c, CaseStatus: newStatus } : c));
      updateCaseStatus(caseId, newStatus, '').then(() => onRefresh());
    }
  };

  const handleRescheduleClick = (targetCase: any) => {
    setRescheduleDate(targetCase.Date);
    setReasonPreset('');
    setReasonText('');
    setShowReasonModal({ type: 'reschedule', case: targetCase });
  };

  const submitReasonModal = async () => {
    if (!showReasonModal) return;
    const finalReason = reasonPreset === 'Other' || !reasonPreset ? reasonText : reasonPreset + (reasonText ? ` - ${reasonText}` : '');
    const c = showReasonModal.case;

    if (showReasonModal.type === 'off-case') {
      setLocalCases(prev => prev.map(x => x.CaseID === c.CaseID ? { ...x, CaseStatus: 'Off-case', CancellationReason: finalReason } : x));
      await updateCaseStatus(c.CaseID, 'Off-case', finalReason);
      
      const originalCases = localCases.filter(x => x.CaseStatus !== 'Off-case').sort((a,b) => (a.SequenceOrder||99)-(b.SequenceOrder||99));
      const anchorStartTime = originalCases.length > 0 ? originalCases[0].StartTime : '08:00';
      const remainingCases = originalCases.filter(x => x.CaseID !== c.CaseID);
      
      if(remainingCases.length > 0) {
          const caseIdsInOrder = remainingCases.map(x=>x.CaseID);
          await reorderAndCascadeCases(caseIdsInOrder, anchorStartTime);
      }
      onRefresh();

    } else if (showReasonModal.type === 'reschedule') {
      await rescheduleCaseAction(c.CaseID, rescheduleDate, finalReason);
      
      const originalCases = localCases.filter(x => x.CaseStatus !== 'Off-case').sort((a,b) => (a.SequenceOrder||99)-(b.SequenceOrder||99));
      const anchorStartTime = originalCases.length > 0 ? originalCases[0].StartTime : '08:00';
      const remainingCases = originalCases.filter(x => x.CaseID !== c.CaseID);
      
      if(remainingCases.length > 0) {
          const caseIdsInOrder = remainingCases.map(x=>x.CaseID);
          await reorderAndCascadeCases(caseIdsInOrder, anchorStartTime);
      }
      onRefresh();
    }

    setShowReasonModal(null);
  };

  const handleViewHistory = async (caseId: number) => {
    const logs = await getCaseHistory(caseId);
    setHistoryLogs(logs);
    setShowHistoryModal(caseId);
  };

  if (localCases.length === 0) return <p className="text-gray-500 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">No cases scheduled.</p>;
  
  const activeCases = localCases.filter(c => c.CaseStatus !== 'Off-case');
  const offCases = localCases.filter(c => c.CaseStatus === 'Off-case');

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeCases.map(c => c.CaseID)} strategy={verticalListSortingStrategy}>
          {activeCases.map((c, idx) => (
            <SortableCaseCard 
              key={c.CaseID} 
              c={c} 
              idx={idx} 
              role={role}
              handleStatusChange={handleStatusChange} 
              handleViewHistory={handleViewHistory}
              handleRescheduleClick={handleRescheduleClick}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Off-case Items separated at bottom */}
      {offCases.length > 0 && (
        <div className="pt-4 mt-8 border-t-2 border-dashed border-gray-200 space-y-4 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Cancelled Cases</div>
          {offCases.map(c => (
             <div key={c.CaseID} className="border rounded-xl flex shadow-sm bg-gray-50 border-red-200 opacity-60 grayscale hover:grayscale-0 transition-all">
               <div className="p-4 flex-1 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div>
                   <div className="flex items-center gap-3 mb-1">
                     <span className="font-bold text-lg text-gray-500 line-through">{c.StartTime} - {c.EndTime}</span>
                     <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-bold rounded">{c.RoomNumber}</span>
                     <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold rounded-full border border-red-200">Off-case</span>
                   </div>
                   <div className="font-medium text-gray-500">
                     {c.FirstName} {c.LastName} <span className="text-sm font-normal ml-1">(HN: {c.Patient_HN})</span>
                   </div>
                   <div className="text-sm text-gray-500 mt-1">
                     <span className="font-semibold">{c.Diagnosis}</span> • {c.Operation}
                   </div>
                   {c.CancellationReason && (
                     <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded inline-block border border-red-200">
                       <strong>Reason:</strong> {c.CancellationReason}
                     </div>
                   )}
                 </div>
                 <div className="flex sm:flex-col gap-2 shrink-0">
                   <button 
                     onClick={() => handleViewHistory(c.CaseID)}
                     className="text-xs text-gray-600 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded flex items-center justify-center transition-colors shadow-sm"
                   >
                     View History
                   </button>
                 </div>
               </div>
             </div>
          ))}
        </div>
      )}

      {/* Reason Prompt Modal */}
      {showReasonModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in-up">
            <h3 className={`text-xl font-bold mb-2 ${showReasonModal.type === 'off-case' ? 'text-red-600' : 'text-indigo-600'}`}>
              {showReasonModal.type === 'off-case' ? 'Mark as Off-case' : 'Reschedule Case'}
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Please provide a reason. This will be recorded in the audit trail.
            </p>
            
            {showReasonModal.type === 'reschedule' && (
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">New Date</label>
                <input 
                  type="date" 
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 border"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Reason Preset</label>
              <select
                value={reasonPreset}
                onChange={e => setReasonPreset(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
              >
                <option value="">-- Select a reason --</option>
                {PRESET_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">Additional Notes (Optional)</label>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border"
                rows={3}
                placeholder="Enter details here..."
              ></textarea>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setShowReasonModal(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded font-medium transition-colors">
                Cancel
              </button>
              <button onClick={submitReasonModal} className={`px-4 py-2 font-bold rounded transition-colors text-white ${showReasonModal.type === 'off-case' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-up">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-lg flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Case Audit Trail
              </h3>
              <button onClick={() => setShowHistoryModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {historyLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No history records found.</p>
              ) : (
                <div className="space-y-4">
                  {historyLogs.map(log => (
                    <div key={log.LogID} className="border-l-2 border-blue-500 pl-4 py-1 relative">
                      <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[5px] top-2"></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-gray-900">{log.Action_Type}</span>
                        <span className="text-xs text-gray-500">{new Date(log.Timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-700">By <span className="font-medium text-blue-600">{log.ChangedBy_Username}</span></div>
                      {log.Notes && <div className="text-sm text-gray-600 mt-1 italic border-l-2 border-gray-200 pl-2">"{log.Notes}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
