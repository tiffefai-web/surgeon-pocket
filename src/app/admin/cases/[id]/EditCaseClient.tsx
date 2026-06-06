'use client';

import { useActionState, useState, useEffect, Suspense } from 'react';
import { updateCaseAction } from '@/app/actions/cases';
import { getHospitals, getRooms, getDepartments, getSurgeons, getMasterTemplates } from '@/app/actions/settings';
import { useSearchParams } from 'next/navigation';
import { addMinutes, format } from 'date-fns';

import { isHoliday } from '@/lib/holidays';

const HIGH_RISK_MEDS = ['ASA', 'Warfarin', 'Clopidogrel', 'NOACs', 'None'];
const PREOP_TAGS = ['Bowel prep', 'Difficult case', 'Book ICU', 'Consult URO intra-op', 'Late case', 'Infected'];

function ToggleBadge({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
        selected
          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
      }`}
    >
      {label}
    </button>
  );
}

function EditCaseClientForm({ initialData }: { initialData: any }) {
  const [state, formAction, isPending] = useActionState(updateCaseAction, { error: '' });
  
  const [selectedMeds, setSelectedMeds] = useState<string[]>(initialData.High_Risk_Meds ? JSON.parse(initialData.High_Risk_Meds) : []);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData.PreOp_Tags ? JSON.parse(initialData.PreOp_Tags) : []);

  // Settings Data
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Time Calculation State
  const [date, setDate] = useState(initialData.Date || '');
  const [startTime, setStartTime] = useState(initialData.StartTime || '');
  
  // Calculate duration if possible
  let initialDuration = '60';
  let initialTurnaround = '30';
  if (initialData.StartTime && initialData.EndTime) {
    const startObj = new Date(`1970-01-01T${initialData.StartTime}:00`);
    const endObj = new Date(`1970-01-01T${initialData.EndTime}:00`);
    const totalMins = (endObj.getTime() - startObj.getTime()) / 60000;
    if (totalMins > 0) {
      initialDuration = String(Math.max(30, totalMins - 30));
    }
  }

  const [surgeryDuration, setSurgeryDuration] = useState(initialDuration);
  const [turnaroundTime, setTurnaroundTime] = useState(initialTurnaround);
  const [calculatedEndTime, setCalculatedEndTime] = useState(initialData.EndTime || '--:--');
  const [roomNumber, setRoomNumber] = useState(initialData.RoomNumber || '');

  // Form selections
  const [patientType, setPatientType] = useState(initialData.PatientType || 'IPD');
  const [location, setLocation] = useState(initialData.Location || 'Phitsanulok Hospital');
  const [department, setDepartment] = useState(initialData.Department || '');
  const [surgeonId, setSurgeonId] = useState(initialData.UserID ? String(initialData.UserID) : '');

  useEffect(() => {
    async function loadSettings() {
      try {
        const [hData, rData, dData, sData, tData] = await Promise.all([
          getHospitals(), getRooms(), getDepartments(), getSurgeons(), getMasterTemplates()
        ]);
        setHospitals(hData);
        setRoomsList(rData);
        setDepartments(dData);
        setSurgeons(sData);
        setTemplates(tData);
      } catch (e) {
        console.error("Failed to load settings data", e);
      }
    }
    loadSettings();
  }, []);

  // Auto-fill logic based on Master Templates
  useEffect(() => {
    if (date && roomNumber && templates.length > 0) {
      const dayOfWeek = new Date(date).getDay();
      const matchedRoom = roomsList.find(r => r.RoomName === roomNumber);
      if (matchedRoom) {
        const template = templates.find(t => t.RoomID === matchedRoom.RoomID && t.DayOfWeek === dayOfWeek);
        if (template) {
          setDepartment(template.DepartmentID.toString());
          setSurgeonId(template.SurgeonID.toString());
          // Auto-update location to the hospital of this room
          setLocation(template.HospitalName);
        }
      }
    }
  }, [date, roomNumber, templates, roomsList]);
  
  const isPrivate = location === 'Private Clinic' || location === 'Other';

  useEffect(() => {
    if (isPrivate) {
      setCalculatedEndTime('Open-ended');
    } else if (date && startTime && surgeryDuration && turnaroundTime) {
      try {
        const startObj = new Date(`${date}T${startTime}:00`);
        const totalMins = parseInt(surgeryDuration) + parseInt(turnaroundTime);
        const endObj = addMinutes(startObj, totalMins);
        if (!isNaN(endObj.getTime())) {
          setCalculatedEndTime(format(endObj, 'HH:mm'));
        }
      } catch (e) {
        setCalculatedEndTime('--:--');
      }
    } else {
      setCalculatedEndTime('--:--');
    }
  }, [date, startTime, surgeryDuration, turnaroundTime, isPrivate]);
  
  const toggleMed = (med: string) => {
    if (med === 'None') {
      setSelectedMeds(['None']);
      return;
    }
    const newMeds = selectedMeds.includes(med)
      ? selectedMeds.filter(m => m !== med)
      : [...selectedMeds.filter(m => m !== 'None'), med];
    setSelectedMeds(newMeds);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const isLate = startTime > '15:00';
  const isHolidayDate = !isPrivate && date ? isHoliday(date) : false;
  const isSubmitDisabled = isPending || isHolidayDate;

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-xl border border-blue-50 overflow-hidden mt-4">
      <div className="bg-blue-600 px-6 py-4 border-b border-blue-700 flex items-center justify-between">
        <div className="flex items-center text-white">
          <a href="/surgeon" className="mr-4 hover:text-blue-200 transition">
            <svg className="w-5 h-5 inline-block -mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </a>
          <h2 className="text-xl font-bold">Edit Surgical Case</h2>
        </div>
        <a href="/surgeon" className="text-blue-100 hover:text-white text-sm font-medium">Cancel</a>
      </div>

      <form action={formAction} className="p-6 space-y-8">
        <input type="hidden" name="caseId" value={initialData.CaseID} />
        {state?.error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium">
            {state.error}
          </div>
        )}

        {/* Section 1: Demographics */}
        <section>
          <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-100 pb-2 mb-4">Patient Demographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient HN *</label>
              <input name="patientHn" type="text" required defaultValue={initialData.Patient_HN} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. 1234567" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input name="firstName" type="text" required defaultValue={initialData.FirstName} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input name="lastName" type="text" required defaultValue={initialData.LastName} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input name="contactPhone" type="tel" pattern="[0-9\s\-+]+" defaultValue={initialData.ContactPhone} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. 081-234-5678" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select name="gender" defaultValue={initialData.Gender} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                <option value="">-- Select --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input name="age" type="number" defaultValue={initialData.Age} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
          </div>
        </section>

        {/* Section 2: Clinical History */}
        <section>
          <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-100 pb-2 mb-4">Clinical History</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Underlying Diseases</label>
                <input name="underlyingDiseases" type="text" defaultValue={initialData.Underlying_Diseases} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. HT, DM type 2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Past Surgical History</label>
                <input name="pastSurgicalHistory" type="text" defaultValue={initialData.Past_Surgical_History} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. Appendectomy 2015" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">High-Risk Medications</label>
              <div className="flex flex-wrap gap-2">
                {HIGH_RISK_MEDS.map(med => (
                  <ToggleBadge key={med} label={med} selected={selectedMeds.includes(med)} onClick={() => toggleMed(med)} />
                ))}
              </div>
              <input type="hidden" name="highRiskMeds" value={JSON.stringify(selectedMeds)} />
            </div>
          </div>
        </section>

        {/* Section 3: Surgical Setup */}
        <section>
          <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-100 pb-2 mb-4">Surgical Setup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
              <input name="diagnosis" type="text" required defaultValue={initialData.Diagnosis} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. Acute Appendicitis" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operation *</label>
              <input name="operation" type="text" required defaultValue={initialData.Operation} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. Laparoscopic Appendectomy" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Type</label>
              <select name="patientType" value={patientType} onChange={e => setPatientType(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                <option value="IPD">IPD (Inpatient)</option>
                <option value="OPD">OPD (Outpatient)</option>
                <option value="ODS">ODS (One Day Surgery)</option>
                <option value="SMC">SMC</option>
              </select>
            </div>
            
            {patientType === 'IPD' && (
              <div className="md:col-span-1 animate-fade-in-up">
                <label className="block text-sm font-bold text-orange-600 mb-1">Admission Target</label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Admit</span>
                  <input type="number" name="admitDaysPrior" defaultValue={initialData.AdmitDaysPrior || 1} min={1} className="w-16 text-center border-gray-300 rounded shadow-sm focus:border-blue-500 py-1.5 px-2 border" />
                  <span className="text-sm text-gray-500 ml-2">days prior</span>
                </div>
              </div>
            )}
            
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select name="location" value={location} onChange={e => setLocation(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                {hospitals.map(h => <option key={h.HospitalID} value={h.Name}>{h.Name}</option>)}
                <option value="Private Clinic">Private Clinic</option>
                <option value="Private Hospital">Private Hospital</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select name="department" value={department} onChange={e => setDepartment(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                <option value="">-- Select --</option>
                {departments.map(d => <option key={d.DepartmentID} value={d.Name}>{d.Name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
              <select name="surgeonId" value={surgeonId} onChange={e => setSurgeonId(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border bg-white">
                <option value="">-- Auto (Myself) --</option>
                {surgeons.map(s => <option key={s.UserID} value={s.UserID}>{s.Username}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Section 4: Pre-Op & Logistics */}
        <section>
          <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-100 pb-2 mb-4">Pre-Op & Logistics</h3>
          
          <div className="flex gap-8 mb-6">
            <label className="flex items-center cursor-pointer">
              <span className="text-sm font-medium text-gray-700 mr-3">Consult Anes Ready</span>
              <input type="checkbox" name="consultAnes" value="true" defaultChecked={initialData.ConsultAnes_Status === 1} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            </label>
            <label className="flex items-center cursor-pointer">
              <span className="text-sm font-medium text-gray-700 mr-3">Med Result Ready</span>
              <input type="checkbox" name="medResult" value="true" defaultChecked={initialData.MedResult_Status === 1} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Tags</label>
            <div className="flex flex-wrap gap-2">
              {PREOP_TAGS.map(tag => (
                <ToggleBadge key={tag} label={tag} selected={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
              ))}
            </div>
            <input type="hidden" name="preOpTags" value={JSON.stringify(selectedTags)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extra Notes</label>
            <textarea name="extraNotes" rows={3} defaultValue={initialData.Extra_Notes} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="Any additional information..."></textarea>
          </div>
        </section>

        {/* Section 5: Scheduling */}
        <section>
          <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-100 pb-2 mb-4">Scheduling</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input name="date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Number {isPrivate && <span className="text-gray-400 font-normal">(Opt)</span>}</label>
              <input name="roomNumber" type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" placeholder="e.g. OR 4" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input name="startTime" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Surgery (mins) {isPrivate && <span className="text-gray-400 font-normal">(Opt)</span>}</label>
              <input name="surgeryDuration" type="number" value={surgeryDuration} onChange={e => setSurgeryDuration(e.target.value)} required={!isPrivate} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Turnaround (mins) {isPrivate && <span className="text-gray-400 font-normal">(Opt)</span>}</label>
              <input name="turnaroundTime" type="number" value={turnaroundTime} onChange={e => setTurnaroundTime(e.target.value)} required={!isPrivate} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 border" />
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
            <span className="text-blue-800 font-medium">Calculated End Time:</span>
            <span className="text-xl font-bold text-blue-900">{calculatedEndTime}</span>
          </div>

          {isLate && !isPrivate && (
            <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg font-medium flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Warning: You are scheduling a standard case to start after 15:00. Please ensure out-of-hours staff are available.
            </div>
          )}
          {isHolidayDate && (
            <div className="mt-4 p-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-medium flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              This date is a Thai Public Holiday. Scheduling regular cases is disabled.
            </div>
          )}
        </section>

        <div className="pt-4 border-t border-gray-200 flex justify-end gap-4">
          <a href="/surgeon" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            Cancel
          </a>
          <button type="submit" disabled={isSubmitDisabled} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg">
            {isPending ? 'Updating Case...' : 'Update Case'}
          </button>
        </div>

      </form>
    </div>
  );
}

export default function EditCaseClient({ initialData }: { initialData: any }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading form...</div>}>
      <EditCaseClientForm initialData={initialData} />
    </Suspense>
  );
}
