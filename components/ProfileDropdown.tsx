
import React from 'react';
import { User } from '../types';
import { Cog6ToothIcon, QuestionMarkCircleIcon, ArrowRightOnRectangleIcon, TrashIcon } from './icons';

interface ProfileDropdownProps {
    user: User;
    onClose: () => void;
    onLogout: () => void;
    onDeleteAccount: () => void;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, onClose, onLogout, onDeleteAccount }) => {
    return (
        <div 
            className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 animate-fade-in-down origin-top-right z-50"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-slate-200">
                <p className="font-semibold text-sm text-slate-800 truncate">{user.displayName || '사용자'}</p>
                <p className="text-xs text-slate-500 truncate">{user.email || '이메일 정보 없음'}</p>
            </div>
            <div className="p-2">
                <MenuItem icon={<Cog6ToothIcon className="w-5 h-5 text-slate-500" />} label="설정" disabled />
                <MenuItem icon={<QuestionMarkCircleIcon className="w-5 h-5 text-slate-500" />} label="문의하기" disabled />
            </div>
            <div className="p-2 border-t border-slate-100 space-y-1">
                <MenuItem 
                    icon={<ArrowRightOnRectangleIcon className="w-5 h-5 text-slate-700" />} 
                    label="로그아웃" 
                    onClick={onLogout} 
                />
                <MenuItem 
                    icon={<TrashIcon className="w-5 h-5 text-red-500" />} 
                    label="회원 탈퇴" 
                    onClick={onDeleteAccount} 
                    isDanger={true}
                />
            </div>
        </div>
    );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; disabled?: boolean; onClick?: () => void; isDanger?: boolean; }> = ({ icon, label, disabled, onClick, isDanger = false }) => {
    const textColor = isDanger ? 'text-red-500' : 'text-slate-700';
    const hoverBg = isDanger ? 'hover:bg-red-50' : 'hover:bg-slate-100';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${textColor} ${!disabled ? hoverBg : ''}`}
        >
            {icon}
            <span>{label}</span>
            {disabled && <span className="text-xs text-slate-400 ml-auto">준비 중</span>}
        </button>
    );
}

export default ProfileDropdown;
