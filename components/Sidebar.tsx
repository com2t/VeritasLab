
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { ChatSession } from '../types';
import { db, collection, query, orderBy, onSnapshot } from '../firebase';
import { XCircleIcon, PlusIcon, MessageIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, LogoutIcon } from './icons';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onDeleteSession: (sessionId: string) => Promise<void>;
    onClearAllSessions: () => Promise<void>; // New prop
    onRenameSession: (sessionId: string, newTitle: string) => Promise<void>;
    user: User | null;
    currentSessionId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, 
    onClose, 
    onSelectSession, 
    onNewChat, 
    onDeleteSession,
    onClearAllSessions, 
    onRenameSession, 
    user, 
    currentSessionId 
}) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // 세션 목록 불러오기
    useEffect(() => {
        if (!user) {
            setSessions([]);
            return;
        }

        const sessionsRef = collection(db, 'users', user.uid, 'chatSessions');
        // 생성일 역순 (최신순) 정렬
        const q = query(sessionsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedSessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatSession))
            // Filter out soft-deleted sessions client-side
            .filter(session => !session.deletedAt);
            
            setSessions(loadedSessions);
        });

        return () => unsubscribe();
    }, [user]);

    const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(session.id);
        setEditTitle(session.title);
    };

    const handleSaveEdit = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingSessionId && editTitle.trim()) {
            await onRenameSession(editingSessionId, editTitle.trim());
            setEditingSessionId(null);
        }
    };

    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSessionId(null);
    };

    const handleDeleteClick = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("이 대화를 휴지통으로 이동하시겠습니까?")) {
            try {
                setIsDeleting(true);
                await onDeleteSession(sessionId);
            } catch (error) {
                console.error("Delete failed", error);
                alert("삭제 중 오류가 발생했습니다.");
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <>
            {/* 모바일용 오버레이 */}
            {isOpen && (
                <div 
                    className="absolute inset-0 bg-black/30 z-40 sm:hidden"
                    onClick={onClose}
                />
            )}

            {/* 사이드바 패널 */}
            <div className={`
                absolute top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col border-r border-slate-200
            `}>
                {/* 헤더 */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h2 className="font-bold text-slate-700 text-lg">대화 목록</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* 새 채팅 버튼 */}
                <div className="p-4">
                    <button 
                        onClick={() => {
                            onNewChat();
                            if (window.innerWidth < 640) onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg transform active:scale-95 font-medium"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>새로운 대화 시작</span>
                    </button>
                </div>

                {/* 세션 리스트 */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                    {sessions.length === 0 ? (
                        <div className="text-center text-slate-400 py-10 text-sm">
                            저장된 대화가 없습니다.
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div 
                                key={session.id}
                                onClick={() => {
                                    onSelectSession(session.id);
                                    if (window.innerWidth < 640) onClose();
                                }}
                                className={`
                                    group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                                    ${currentSessionId === session.id 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                                    }
                                `}
                            >
                                <div className={`p-2 rounded-lg ${currentSessionId === session.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <MessageIcon className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    {editingSessionId === session.id ? (
                                        <input 
                                            type="text" 
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full text-sm border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            autoFocus
                                        />
                                    ) : (
                                        <>
                                            <h3 className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                {session.title || '새로운 대화'}
                                            </h3>
                                            <p className="text-xs text-slate-400 truncate">
                                                {new Date(session.createdAt).toLocaleDateString()}
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* 액션 버튼들 */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    {editingSessionId === session.id ? (
                                        <>
                                            <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                <CheckIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={handleCancelEdit} className="p-1 text-red-500 hover:bg-red-100 rounded">
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={(e) => handleStartEdit(session, e)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => handleDeleteClick(session.id, e)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" disabled={isDeleting}>
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 대화 목록 전체 삭제 버튼 */}
                {sessions.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                        <button 
                            onClick={() => {
                                onClearAllSessions();
                                if (window.innerWidth < 640) onClose();
                            }}
                            className="w-full text-xs text-red-500 hover:text-red-700 hover:underline text-center py-1 transition-colors"
                        >
                            모든 대화 휴지통으로 이동
                        </button>
                    </div>
                )}

                {/* 하단 유저 정보 */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {user?.email?.[0].toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">{user?.displayName || '사용자'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;