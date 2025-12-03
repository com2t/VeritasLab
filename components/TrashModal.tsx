
import React, { useState, useEffect } from 'react';
import { Experience, ChatSession } from '../types';
import { XMarkIcon, TrashIcon, ArrowPathIcon, MessageIcon, FolderIcon, LoadingSpinner, ClockIcon } from './icons';
import { db, collection, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch } from '../firebase';
import { User } from 'firebase/auth';

interface TrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onRestoreExperience: (id: string) => void;
    onRestoreSession: (id: string) => void;
}

const TrashModal: React.FC<TrashModalProps> = ({ isOpen, onClose, user, onRestoreExperience, onRestoreSession }) => {
    const [activeTab, setActiveTab] = useState<'experiences' | 'sessions'>('experiences');
    const [deletedExperiences, setDeletedExperiences] = useState<Experience[]>([]);
    const [deletedSessions, setDeletedSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            fetchDeletedItems();
        }
    }, [isOpen, user]);

    const fetchDeletedItems = async () => {
        setIsLoading(true);
        try {
            // Fetch Deleted Experiences
            const expRef = collection(db, 'users', user.uid, 'experiences');
            const expQ = query(expRef, where("deletedAt", "!=", null));
            const expSnap = await getDocs(expQ);
            const exps = expSnap.docs.map(d => ({ ...d.data(), id: d.id } as Experience));
            exps.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
            setDeletedExperiences(exps);

            // Fetch Deleted Sessions
            const sessionRef = collection(db, 'users', user.uid, 'chatSessions');
            const sessionQ = query(sessionRef, where("deletedAt", "!=", null));
            const sessionSnap = await getDocs(sessionQ);
            const sessions = sessionSnap.docs.map(d => ({ ...d.data(), id: d.id } as ChatSession));
            sessions.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
            setDeletedSessions(sessions);

            await checkAndCleanupOldItems(exps, sessions);

        } catch (error) {
            console.error("Error fetching trash:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkAndCleanupOldItems = async (exps: Experience[], sessions: ChatSession[]) => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const oldExps = exps.filter(e => new Date(e.deletedAt!) < sevenDaysAgo);
        const oldSessions = sessions.filter(s => new Date(s.deletedAt!) < sevenDaysAgo);

        if (oldExps.length === 0 && oldSessions.length === 0) return;

        setIsCleaning(true);
        const batch = writeBatch(db);

        oldExps.forEach(e => {
            const ref = doc(db, 'users', user.uid, 'experiences', e.id);
            batch.delete(ref);
        });

        for (const s of oldSessions) {
             const ref = doc(db, 'users', user.uid, 'chatSessions', s.id);
             batch.delete(ref);
             const messagesRef = collection(db, 'users', user.uid, 'chatSessions', s.id, 'messages');
             const msgsSnap = await getDocs(messagesRef);
             msgsSnap.docs.forEach(m => batch.delete(m.ref));
        }

        try {
            await batch.commit();
            setDeletedExperiences(prev => prev.filter(e => new Date(e.deletedAt!) >= sevenDaysAgo));
            setDeletedSessions(prev => prev.filter(s => new Date(s.deletedAt!) >= sevenDaysAgo));
        } catch (e) {
            console.error("Cleanup failed", e);
        } finally {
            setIsCleaning(false);
        }
    };

    const handlePermanentDelete = async (id: string, type: 'experience' | 'session') => {
        if (!window.confirm("정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
        
        try {
            if (type === 'experience') {
                await deleteDoc(doc(db, 'users', user.uid, 'experiences', id));
                setDeletedExperiences(prev => prev.filter(e => e.id !== id));
            } else {
                 const messagesRef = collection(db, 'users', user.uid, 'chatSessions', id, 'messages');
                 const msgsSnap = await getDocs(messagesRef);
                 const batch = writeBatch(db);
                 msgsSnap.docs.forEach(m => batch.delete(m.ref));
                 batch.delete(doc(db, 'users', user.uid, 'chatSessions', id));
                 await batch.commit();
                 
                 setDeletedSessions(prev => prev.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error("Permanent delete failed:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleRestore = async (id: string, type: 'experience' | 'session') => {
        try {
            const collectionName = type === 'experience' ? 'experiences' : 'chatSessions';
            const ref = doc(db, 'users', user.uid, collectionName, id);
            
            await updateDoc(ref, { deletedAt: null });

            if (type === 'experience') {
                setDeletedExperiences(prev => prev.filter(e => e.id !== id));
                onRestoreExperience(id);
            } else {
                setDeletedSessions(prev => prev.filter(s => s.id !== id));
                onRestoreSession(id);
            }
        } catch (error) {
            console.error("Restore failed:", error);
            alert("복구 중 오류가 발생했습니다.");
        }
    };

    const getRemainingDays = (deletedAt: string) => {
        if (!deletedAt) return 0;
        const deleteDate = new Date(deletedAt);
        const expireDate = new Date(deleteDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffTime = expireDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
             <div className="bg-white rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600">
                            <TrashIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">휴지통</h2>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">삭제된 항목은 <span className="text-red-500 font-bold">7일 후</span> 영구적으로 제거됩니다.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs - Segmented Control */}
                <div className="px-6 pt-6 pb-2 bg-white">
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setActiveTab('experiences')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                activeTab === 'experiences' 
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <FolderIcon className="w-4 h-4" />
                            경험 & 스토리
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'experiences' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                {deletedExperiences.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                activeTab === 'sessions' 
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <MessageIcon className="w-4 h-4" />
                            대화 목록
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'sessions' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                {deletedSessions.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-white scroll-smooth pb-8">
                    {isLoading || isCleaning ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <LoadingSpinner isWhite={false} />
                            <p className="mt-3 text-sm font-medium">{isCleaning ? "오래된 항목 정리 중..." : "휴지통 비우는 중..."}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* EXPERIENCES LIST */}
                            {activeTab === 'experiences' && (
                                deletedExperiences.length === 0 ? (
                                    <EmptyState message="휴지통이 비었습니다." />
                                ) : (
                                    deletedExperiences.map(exp => (
                                        <div key={exp.id} className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-300">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold border ${exp.type === 'story' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {exp.type === 'story' ? '스토리' : '경험'}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                                                        <ClockIcon className="w-3 h-3" />
                                                        D-{getRemainingDays(exp.deletedAt!)}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-1">{exp.type === 'story' ? exp.story_title : exp.activity_name}</h3>
                                                <p className="text-sm text-slate-500 line-clamp-1">{exp.activity_date || '날짜 미상'}</p>
                                            </div>

                                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-50">
                                                <button 
                                                    onClick={() => handleRestore(exp.id, 'experience')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                                    복구
                                                </button>
                                                <button 
                                                    onClick={() => handlePermanentDelete(exp.id, 'experience')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    영구 삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}

                            {/* SESSIONS LIST */}
                            {activeTab === 'sessions' && (
                                deletedSessions.length === 0 ? (
                                    <EmptyState message="휴지통이 비었습니다." />
                                ) : (
                                    deletedSessions.map(session => (
                                        <div key={session.id} className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-300">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] px-2 py-1 rounded-md font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                        대화
                                                    </span>
                                                    <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                                                        <ClockIcon className="w-3 h-3" />
                                                        D-{getRemainingDays(session.deletedAt!)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-1">{session.title || '새로운 대화'}</h3>
                                                <p className="text-sm text-slate-500 line-clamp-1">{new Date(session.createdAt).toLocaleDateString()} 에 시작됨</p>
                                            </div>

                                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-50">
                                                <button 
                                                    onClick={() => handleRestore(session.id, 'session')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <ArrowPathIcon className="w-3.5 h-3.5" />
                                                    복구
                                                </button>
                                                <button 
                                                    onClick={() => handlePermanentDelete(session.id, 'session')}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    영구 삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <TrashIcon className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium text-lg">{message}</p>
        <p className="text-xs text-slate-400 mt-1">삭제된 항목이 여기에 보관됩니다.</p>
    </div>
);

export default TrashModal;
