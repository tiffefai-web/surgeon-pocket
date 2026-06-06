import { Pool } from 'pg';

const pool = new Pool({
  connectionString: (process.env.POSTGRES_URL || process.env.DATABASE_URL) || 'postgresql://user:password@localhost:5432/surgeon_pocket',
});

function convertSql(sql: string, params: any[]) {
  // Very simple parameter conversion from ? to $1, $2
  let counter = 1;
  const text = sql.replace(/\?/g, () => `$${counter++}`);
  return { text, values: params };
}

const keyMap: Record<string, string> = {
  caseid: 'CaseID',
  userid: 'UserID',
  patient_hn: 'Patient_HN',
  firstname: 'FirstName',
  lastname: 'LastName',
  gender: 'Gender',
  age: 'Age',
  diagnosis: 'Diagnosis',
  operation: 'Operation',
  patienttype: 'PatientType',
  casestatus: 'CaseStatus',
  location: 'Location',
  underlying_diseases: 'Underlying_Diseases',
  past_surgical_history: 'Past_Surgical_History',
  high_risk_meds: 'High_Risk_Meds',
  preop_tags: 'PreOp_Tags',
  extra_notes: 'Extra_Notes',
  cancellationreason: 'CancellationReason',
  contactphone: 'ContactPhone',
  admitdaysprior: 'AdmitDaysPrior',
  isadmitted: 'IsAdmitted',
  department: 'Department',
  scheduleid: 'ScheduleID',
  date: 'Date',
  starttime: 'StartTime',
  endtime: 'EndTime',
  roomnumber: 'RoomNumber',
  sequenceorder: 'SequenceOrder',
  consultanes_status: 'ConsultAnes_Status',
  medresult_status: 'MedResult_Status',
  note: 'Note',
  leaveid: 'LeaveID',
  yielded_roomnumber: 'Yielded_RoomNumber',
  remarkid: 'RemarkID',
  remarktext: 'RemarkText',
  username: 'Username',
  passwordhash: 'PasswordHash',
  role: 'Role',
  fullname: 'FullName',
  avatarurl: 'AvatarURL',
  surgeonname: 'SurgeonName'
};

function makeCaseInsensitive(row: any) {
  if (!row || typeof row !== 'object') return row;
  const newRow: any = {};
  for (const key of Object.keys(row)) {
    const mappedKey = keyMap[key] || key;
    newRow[mappedKey] = row[key];
  }
  return newRow;
}

export async function openDb() {
  return {
    async run(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      const row = makeCaseInsensitive(res.rows[0]);
      return { lastID: row?.CaseID || row?.id || row?.UserID, changes: res.rowCount };
    },
    async all(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return res.rows.map(makeCaseInsensitive);
    },
    async get(sql: string, params: any[] = []) {
      const { text, values } = convertSql(sql, params);
      const res = await pool.query(text, values);
      return makeCaseInsensitive(res.rows[0]);
    },
    async exec(sql: string) {
      return pool.query(sql);
    }
  };
}

