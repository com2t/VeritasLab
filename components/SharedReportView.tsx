
import React, { useState, useEffect, useCallback } from 'react';
import { db, doc, getDoc, updateDoc, arrayUnion } from '../firebase';
import { SharedReport, ReportData, ConsultantComment } from '../types';
import { LoadingSpinner, ChartPieIcon, ThumbUpIcon, ArrowTrendingUpIcon, AcademicCapIcon, SparklesIcon, FolderIcon, BoxIcon, ChatIcon } from './icons';

interface SharedReportViewProps {
    reportId: string;
}

const SkillTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 mb-2 px-2.5 py-0.5 rounded-full">
        {children}
    </span>
);

const SharedReportView: React.FC<SharedReportViewProps> = ({ reportId }) => {
    const [report, setReport] = useState<SharedReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [commentAuthor, setCommentAuthor] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const reportDocRef = doc(db, 'sharedReports', reportId);
                const reportSnap = await getDoc(reportDocRef);

                if (!reportSnap.exists()) {
                    throw new Error("공유된 리포트를 찾을 수 없습니다.");
                }

                const reportData = reportSnap.data() as SharedReport;
                const createdAt = new Date(reportData.createdAt);
                const now = new Date();
                const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

                if (hoursDiff > 48) {
                    throw new Error("이 리포트의 공유 기간(48시간)이 만료되었습니다.");
                }

                setReport(reportData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "리포트를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [reportId]);

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !commentAuthor.trim() || !report) return;

        setIsSubmitting(true);
        const comment: ConsultantComment = {
            author: commentAuthor,
            comment: newComment,
            createdAt: new Date().toISOString()
        };

        try {
            const reportDocRef = doc(db, 'sharedReports', reportId);
            await updateDoc(reportDocRef, {
                consultantComments: arrayUnion(comment)
            });
            // Optimistically update UI
            setReport(prev => prev ? { ...prev, consultantComments: [...(prev.consultantComments || []), comment] } : null);
            setNewComment('');
            setCommentAuthor('');
        } catch (error) {
            console.error("Failed to add comment:", error);
            alert("코멘트 추가에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };


    if (isLoading) {
        return (
            <div className="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center text-center p-8">
                <LoadingSpinner isWhite={false} />
                <p className="mt-4 font-semibold text-indigo-600">리포트 로딩 중...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-2xl font-bold text-red-600">오류</h2>
                <p className="text-gray-600 mt-2">{error}</p>
            </div>
        );
    }

    if (!report) {
        return null;
    }

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-8">
            <div id="printable-report-area" className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-lg">
                <div className="text-center mb-8 border-b pb-6">
                    <h1 className="text-3xl font-bold text-gray-800">개인 리포트</h1>
                    <p className="text-gray-500 mt-2">AI가 생성한 커리어 분석 리포트입니다.</p>
                </div>
                <div className="space-y-8">
                    {/* Added safety checks (|| []) and optional chaining to prevent map errors */}
                    <ReportSection icon={<ThumbUpIcon className="w-6 h-6 text-green-500" />} title={report.strengths?.title || '강점'}>
                        <div className="mb-4">{(report.strengths?.skills || []).map((skill, i) => <SkillTag key={i}>{skill}</SkillTag>)}</div>
                        <p className="mb-4">{report.strengths?.content}</p>
                        <ul className="list-disc list-inside space-y-2">{(report.strengths?.examples || []).map((ex, i) => <li key={i}>{ex}</li>)}</ul>
                    </ReportSection>

                    <ReportSection icon={<ArrowTrendingUpIcon className="w-6 h-6 text-blue-500" />} title={report.growthOpportunities?.title || '성장 기회'}>
                        <div className="mb-4">{(report.growthOpportunities?.skills || []).map((skill, i) => <SkillTag key={i}>{skill}</SkillTag>)}</div>
                        <p className="mb-4">{report.growthOpportunities?.content}</p>
                        <ul className="list-disc list-inside space-y-2">{(report.growthOpportunities?.examples || []).map((ex, i) => <li key={i}>{ex}</li>)}</ul>
                    </ReportSection>

                    <ReportSection icon={<AcademicCapIcon className="w-6 h-6 text-indigo-500" />} title="추천 직무">
                        <div className="space-y-4">
                            {(report.jobRecommendations || []).map((job, i) => (
                                <div key={i} className="p-4 bg-gray-100 rounded-md">
                                    <h4 className="font-bold text-gray-800">{job.jobTitle}</h4>
                                    <p className="text-sm text-gray-600 mt-1 mb-3">{job.reason}</p>
                                    <div><h5 className="text-xs font-bold text-gray-500 mb-2">매칭 스킬</h5>{(job.matchingSkills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                                </div>
                            ))}
                        </div>
                    </ReportSection>
                    
                     <ReportSection icon={<FolderIcon className="w-6 h-6 text-gray-500" />} title="경험 요약">
                        <div className="space-y-4">
                            {(report.experienceSummaries || []).map((exp, i) => (
                                <div key={i} className="p-4 bg-gray-100 rounded-md">
                                    <h4 className="font-bold text-gray-800">{exp.title}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{exp.summary}</p>
                                </div>
                            ))}
                        </div>
                    </ReportSection>

                     <ReportSection icon={<BoxIcon className="w-6 h-6 text-purple-500" />} title="스토리 요약">
                        <div className="space-y-4">
                            {(report.storySummaries || []).map((story, i) => (
                                <div key={i} className="p-4 bg-gray-100 rounded-md">
                                    <h4 className="font-bold text-gray-800">{story.title}</h4>
                                    <p className="text-sm text-gray-600 mt-1">{story.summary}</p>
                                </div>
                            ))}
                        </div>
                    </ReportSection>

                    <ReportSection icon={<SparklesIcon className="w-6 h-6 text-amber-500" />} title="종합 코칭"><p>{report.summary}</p></ReportSection>

                    <ReportSection icon={<ChatIcon className="w-6 h-6 text-cyan-500" />} title="컨설턴트 코멘트">
                        <div className="space-y-4 mb-6">
                            {(report.consultantComments || []).length > 0 ? (
                                report.consultantComments.map((comment, i) => (
                                    <div key={i} className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                                        <p className="text-sm text-gray-800">"{comment.comment}"</p>
                                        <p className="text-xs text-gray-500 text-right mt-2 font-semibold">- {comment.author}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 italic">아직 코멘트가 없습니다.</p>
                            )}
                        </div>
                        <form onSubmit={handleAddComment} className="p-4 bg-gray-100 rounded-lg no-print">
                            <h4 className="font-bold text-gray-800 mb-2">코멘트 추가하기</h4>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="이름"
                                    value={commentAuthor}
                                    onChange={(e) => setCommentAuthor(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-slate-900"
                                    required
                                />
                                <textarea
                                    placeholder="코멘트를 입력하세요..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-slate-900"
                                    rows={3}
                                    required
                                />
                                <button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 transition-colors">
                                    {isSubmitting ? '전송 중...' : '코멘트 남기기'}
                                </button>
                            </div>
                        </form>
                    </ReportSection>
                </div>
            </div>
        </div>
    );
};

const ReportSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section>
        <div className="flex items-center gap-3 mb-4">
            {icon}
            <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
        </div>
        <div className="pl-9 text-gray-700 leading-relaxed border-l-2 border-gray-200 ml-3">
            <div className="pl-6">{children}</div>
        </div>
    </section>
);


export default SharedReportView;