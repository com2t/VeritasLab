
import React from 'react';
import { User } from '../types';
import ProfileDropdown from './ProfileDropdown';
import { Bars3Icon, DatabaseIcon, ChartPieIcon } from './icons';

interface HeaderProps {
    user: User | null;
    onLogout: () => void;
    onDeleteAccount: () => void;
    isDropdownOpen: boolean;
    setIsDropdownOpen: (isOpen: boolean) => void;
    onToggleSidebar: () => void;
    isOnboarding: boolean;
    showLeftPanel?: boolean;
    setShowLeftPanel?: (show: boolean) => void;
    showRightPanel?: boolean;
    setShowRightPanel?: (show: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ 
    user, onLogout, onDeleteAccount, 
    isDropdownOpen, setIsDropdownOpen, onToggleSidebar, isOnboarding,
    showLeftPanel, setShowLeftPanel, showRightPanel, setShowRightPanel
}) => {
    
    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    }

    if (!user) return null;

    return (
        <header className="bg-white text-slate-800 p-4 flex-shrink-0 flex items-center justify-between border-b border-slate-200 relative z-30">
            <div className="flex items-center gap-3">
                <button 
                    onClick={onToggleSidebar} 
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    aria-label="메뉴 열기"
                >
                    <Bars3Icon className="w-6 h-6" />
                </button>
                <h1 className="m-0 text-xl md:text-2xl font-bold text-slate-900 hidden sm:block">
                    경험 스택
                </h1>

                {/* Desktop Left Panel Toggle */}
                {setShowLeftPanel && !isOnboarding && (
                    <button 
                        onClick={() => setShowLeftPanel(!showLeftPanel)}
                        className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ml-4 border ${showLeftPanel ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
                        title={showLeftPanel ? "경험 목록 숨기기" : "경험 목록 보기"}
                    >
                        <DatabaseIcon className="w-4 h-4" />
                        <span>목록</span>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-4">
                 {/* Desktop Right Panel Toggle */}
                 {setShowRightPanel && !isOnboarding && (
                    <button 
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        className={`hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${showRightPanel ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'text-slate-500 hover:bg-slate-50 border-transparent'}`}
                        title={showRightPanel ? "리포트 숨기기" : "리포트 보기"}
                    >
                        <ChartPieIcon className="w-4 h-4" />
                        <span>리포트</span>
                    </button>
                )}

                <div className="relative">
                    <button
                        onClick={handleProfileClick}
                        className="flex items-center gap-3 sm:gap-4 rounded-full p-1 hover:bg-slate-100 transition-colors"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="font-semibold text-sm truncate text-slate-700">{user.displayName || '사용자'}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email || '이메일 정보 없음'}</p>
                        </div>
                        <img src={user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${user.displayName || 'U'}`} alt="Profile" className="w-10 h-10 rounded-full" />
                    </button>

                    {isDropdownOpen && <ProfileDropdown user={user} onLogout={onLogout} onDeleteAccount={onDeleteAccount} onClose={() => setIsDropdownOpen(false)} />}
                </div>
            </div>
        </header>
    );
};

export default Header;
