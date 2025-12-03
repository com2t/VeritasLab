
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { UserIcon, IdentificationIcon, XMarkIcon, CheckIcon, PencilSquareIcon, AcademicCapIcon } from './icons';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: UserProfile | null | undefined;
    onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, userProfile, onSave }) => {
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [school, setSchool] = useState('');
    const [major, setMajor] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && userProfile) {
            setName(userProfile.name || '');
            setNickname(userProfile.nickname || '');
            setSchool(userProfile.school || '');
            setMajor(userProfile.major || '');
        }
    }, [isOpen, userProfile]);

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                name,
                nickname: nickname.trim() || null, 
                school: school.trim() || null,     
                major: major.trim() || null        
            } as any); 
            onClose();
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("프로필 수정 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                    <XMarkIcon className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                        <PencilSquareIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">내 정보 수정</h2>
                        <p className="text-sm text-slate-500">프로필 정보를 업데이트하세요.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">이름 (본명)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <IdentificationIcon className="w-5 h-5" />
                            </span>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                                placeholder="이름을 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    {/* Nickname Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">
                            닉네임 (별명)
                            <span className="text-indigo-500 ml-1 text-xs font-normal">* AI가 이 이름으로 불러줍니다</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <UserIcon className="w-5 h-5" />
                            </span>
                            <input 
                                type="text" 
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                                placeholder="예: 미진, 써니, 캡틴"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 ml-1">
                            팁: 3글자 이름(예: 김미진)이라면 성을 뺀 이름(예: 미진)을 입력해보세요. 훨씬 친근하게 대화할 수 있어요!
                        </p>
                    </div>

                    {/* School & Major Inputs (Side by Side) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">학교</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <AcademicCapIcon className="w-5 h-5" />
                                </span>
                                <input 
                                    type="text" 
                                    value={school}
                                    onChange={(e) => setSchool(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                                    placeholder="학교명"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">전공(학과)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <AcademicCapIcon className="w-5 h-5" />
                                </span>
                                <input 
                                    type="text" 
                                    value={major}
                                    onChange={(e) => setMajor(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                                    placeholder="학과명"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                         <button 
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            취소
                        </button>
                        <button 
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none flex items-center gap-2"
                        >
                            {isSaving ? '저장 중...' : (
                                <>
                                    <CheckIcon className="w-5 h-5" />
                                    저장하기
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSettingsModal;
