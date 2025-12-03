
import React from 'react';
import { XMarkIcon } from './icons';
import CareerReportView from './CareerReportView';
import { Experience, ReportData, User, JobFitAnalysis } from '../types';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    experiences: Experience[];
    user: User | null;
    report: ReportData | null;
    setReport: (report: ReportData | null) => void;
    jobFitData?: JobFitAnalysis | null;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, experiences, user, report, setReport, jobFitData }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:p-0 print:static print:bg-white print:h-auto print:block" 
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden print:h-auto print:max-h-none print:w-full print:max-w-none print:shadow-none print:rounded-none print:overflow-visible print:block" 
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-white/50 hover:bg-white rounded-full shadow-sm text-slate-500 hover:text-slate-800 transition-colors print:hidden"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
                
                <div className="flex-1 overflow-hidden print:overflow-visible print:h-auto">
                    <CareerReportView 
                        experiences={experiences}
                        user={user}
                        report={report}
                        setReport={setReport}
                        jobFitData={jobFitData}
                    />
                </div>
            </div>
        </div>
    );
};

export default ReportModal;