import { getCaseDetails } from '@/app/actions/cases';
import EditCaseClient from './EditCaseClient';

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const caseId = parseInt(resolvedParams.id, 10);
  
  if (isNaN(caseId)) {
    return <div className="p-8 text-center text-red-500 font-bold">Invalid Case ID</div>;
  }

  const caseData = await getCaseDetails(caseId);

  if (!caseData) {
    return <div className="p-8 text-center text-red-500 font-bold">Case Not Found</div>;
  }

  return <EditCaseClient initialData={caseData} />;
}

