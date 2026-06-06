'use client';

import React, { forwardRef } from 'react';
import { format } from 'date-fns';

interface CaseData {
  CaseID: number;
  SequenceOrder: number;
  StartTime: string;
  EndTime: string;
  RoomNumber: string;
  SurgeonName?: string; // from global
  Patient_HN: string;
  FirstName: string;
  LastName: string;
  Diagnosis: string;
  Operation: string;
  High_Risk_Meds?: string;
  PreOp_Tags?: string; // JSON string
  CaseStatus: string;
}

interface PrintableSlateProps {
  date: Date;
  cases: CaseData[];
  title?: string;
  printedBy?: string;
}

const PrintableSlate = forwardRef<HTMLDivElement, PrintableSlateProps>(({ date, cases, title = "Daily Surgical Slate", printedBy = "System" }, ref) => {
  
  // Sort cases by Room and then Time
  const sortedCases = [...cases].sort((a, b) => {
    const roomA = a.RoomNumber || '';
    const roomB = b.RoomNumber || '';
    if (roomA !== roomB) return roomA.localeCompare(roomB);
    const timeA = a.StartTime || '';
    const timeB = b.StartTime || '';
    return timeA.localeCompare(timeB);
  });

  return (
    <div ref={ref} className="p-8 bg-white text-black font-sans w-full" style={{ width: '210mm', minHeight: '297mm' }}>
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl font-bold text-center uppercase tracking-wider">Phitsanulok Hospital</h1>
        <h2 className="text-xl font-bold text-center uppercase mt-1 text-gray-700">{title}</h2>
        
        <div className="flex justify-between items-end mt-6">
          <div className="text-lg font-bold">
            Date: {format(date, 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="text-xs text-gray-600 text-right space-y-1 font-semibold">
            <div>Printed By: {printedBy}</div>
            <div>Print Time: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
          </div>
        </div>
      </div>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 border-y-2 border-black">
            <th className="py-2 px-2 border-r border-gray-300 w-8">Seq</th>
            <th className="py-2 px-2 border-r border-gray-300 w-24">Time</th>
            <th className="py-2 px-2 border-r border-gray-300 w-16">Room</th>
            {cases.some(c => c.SurgeonName) && <th className="py-2 px-2 border-r border-gray-300 w-24">Surgeon</th>}
            <th className="py-2 px-2 border-r border-gray-300 w-40">Patient HN/Name</th>
            <th className="py-2 px-2 border-r border-gray-300 w-48">Diagnosis & Operation</th>
            <th className="py-2 px-2">Critical Remarks & Med Warnings</th>
          </tr>
        </thead>
        <tbody>
          {sortedCases.map((c, index) => {
            const isOffCase = c.CaseStatus === 'Off-case';
            const meds = c.High_Risk_Meds ? c.High_Risk_Meds.split(',').map(s => s.trim()).filter(s => s) : [];
            let tags: string[] = [];
            if (c.PreOp_Tags) {
              try {
                tags = JSON.parse(c.PreOp_Tags);
              } catch (e) {
                // Ignore parse errors
              }
            }

            return (
              <tr key={c.CaseID} className={`border-b border-gray-300 ${isOffCase ? 'opacity-50 line-through' : ''}`}>
                <td className="py-3 px-2 border-r border-gray-300 font-bold">{index + 1}</td>
                <td className="py-3 px-2 border-r border-gray-300 font-medium">{c.StartTime} - {c.EndTime}</td>
                <td className="py-3 px-2 border-r border-gray-300 font-bold">{c.RoomNumber}</td>
                {c.SurgeonName && <td className="py-3 px-2 border-r border-gray-300">{c.SurgeonName}</td>}
                <td className="py-3 px-2 border-r border-gray-300">
                  <div className="font-bold">{c.Patient_HN}</div>
                  <div>{c.FirstName} {c.LastName !== 'Patient' && c.LastName !== '' ? c.LastName[0] + '.' : c.LastName}</div>
                </td>
                <td className="py-3 px-2 border-r border-gray-300">
                  <div className="font-semibold text-gray-800">{c.Diagnosis}</div>
                  <div className="text-gray-600 italic">{c.Operation}</div>
                </td>
                <td className="py-3 px-2">
                  {isOffCase && <div className="text-red-600 font-bold mb-1">CANCELLED</div>}
                  <div className="flex flex-col gap-1">
                    {meds.length > 0 && (
                      <div className="text-red-700 font-bold uppercase text-xs">
                        MEDS: {meds.join(', ')}
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tags.map(tag => (
                          <span key={tag} className="border border-gray-400 bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {sortedCases.length === 0 && (
        <div className="text-center py-10 text-gray-500 font-semibold">
          No cases scheduled for this date.
        </div>
      )}
      
      <div className="mt-16 pt-8 border-t border-gray-300">
        <div className="flex justify-around">
          <div className="w-1/3 text-center px-4">
            <div className="border-b border-black mb-2 h-8"></div>
            <div className="text-sm font-bold text-gray-800">Head/In-Charge OR Nurse</div>
          </div>
          <div className="w-1/3 text-center px-4">
            <div className="border-b border-black mb-2 h-8"></div>
            <div className="text-sm font-bold text-gray-800">Anesthesiologist In-Charge</div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-xs text-gray-400 text-center border-t border-gray-200 pt-4 font-semibold uppercase tracking-widest">
        Confidential Clinical Document - Do Not Leave Unattended
      </div>
    </div>
  );
});

PrintableSlate.displayName = 'PrintableSlate';

export default PrintableSlate;
