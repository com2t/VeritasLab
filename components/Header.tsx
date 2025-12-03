
import React, { useMemo } from 'react';
import { User, UserProfile } from '../types';
import ProfileDropdown from './ProfileDropdown';
import { Bars3Icon, SparklesIcon, ChartPieIcon } from './icons';
import { FRIENDSHIP_LEVELS, LEVEL_ZERO } from '../constants';

interface HeaderProps {
    user: User | null;
    userProfile?: UserProfile | null;
    onLogout: () => void;
    onDeleteAccount: () => void;
    isDropdownOpen: boolean;
    setIsDropdownOpen: (isOpen: boolean) => void;
    onToggleSidebar: () => void;
    isOnboarding: boolean;
    onOpenAlarmSettings: () => void;
    onOpenProfileSettings: () => void;
    onOpenTrash: () => void;
    onShowReportModal: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    user, userProfile, onLogout, onDeleteAccount, 
    isDropdownOpen, setIsDropdownOpen, onToggleSidebar, isOnboarding,
    onOpenAlarmSettings, onOpenProfileSettings, onOpenTrash,
    onShowReportModal
}) => {
    
    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDropdownOpen(!isDropdownOpen);
    }

    const { currentLevel, progress } = useMemo(() => {
        if (isOnboarding) {
             return {
                 currentLevel: LEVEL_ZERO,
                 progress: 0
             };
        }

        const score = userProfile?.friendshipScore || 0;
        const level = FRIENDSHIP_LEVELS.find(l => score >= l.min && score <= l.max) || FRIENDSHIP_LEVELS[FRIENDSHIP_LEVELS.length - 1];
        
        let progressPercent = 0;
        
        if (level.max === Infinity) {
             progressPercent = 100;
        } else {
             const range = level.max - level.min;
             const current = score - level.min;
             progressPercent = Math.min(100, Math.max(0, (current / (range + 1)) * 100));
        }

        return { currentLevel: level, progress: progressPercent };
    }, [userProfile, isOnboarding]);

    if (!user) return null;

    const displayName = userProfile?.nickname || userProfile?.name || user.displayName || '사용자';

    return (
        <header className="bg-white text-slate-800 p-4 flex-shrink-0 flex items-center justify-between border-b border-slate-200 relative z-30 h-16 w-full mx-auto">
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

                {/* Friendship Widget */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 shadow-sm max-w-[140px] sm:max-w-none ml-2">
                     <div className="p-1 bg-indigo-100 rounded-full text-indigo-600 hidden sm:block">
                         <SparklesIcon className="w-3 h-3" />
                     </div>
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-slate-700 leading-none mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px] sm:max-w-none">
                            {currentLevel.name}
                         </span>
                         <div className="w-16 sm:w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                             ></div>
                         </div>
                     </div>
                 </div>
            </div>

            {/* Middle Area: Report Button */}
            <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4 mr-2 sm:mr-4">
                 {!isOnboarding && (
                     <button 
                        onClick={onShowReportModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-all border border-indigo-200 shadow-sm group transform active:scale-95"
                     >
                        <ChartPieIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-xs sm:text-sm font-bold whitespace-nowrap">개인 리포트</span>
                     </button>
                 )}
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <button
                        onClick={handleProfileClick}
                        className="flex items-center gap-3 sm:gap-4 rounded-full p-1 hover:bg-slate-100 transition-colors"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="font-semibold text-sm truncate text-slate-700">{displayName}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email || '이메일 정보 없음'}</p>
                        </div>
                        <img src={user.photoURL || `https://api.dicebear.com/8.x/initials/svg?seed=${displayName}`} alt="Profile" className="w-10 h-10 rounded-full border border-slate-200" />
                    </button>

                    {isDropdownOpen && (
                        <ProfileDropdown 
                            user={user} 
                            onLogout={onLogout} 
                            onDeleteAccount={onDeleteAccount} 
                            onClose={() => setIsDropdownOpen(false)} 
                            onOpenAlarmSettings={onOpenAlarmSettings} 
                            onOpenProfileSettings={onOpenProfileSettings}
                            onOpenTrash={onOpenTrash}
                        />
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
