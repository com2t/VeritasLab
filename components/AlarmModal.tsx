
import React, { useState, useEffect } from 'react';
import { AlarmSettings } from '../types';
import { BellIcon, XMarkIcon, CheckIcon } from './icons';

interface AlarmModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSettings: AlarmSettings | undefined;
    onSave: (settings: AlarmSettings) => Promise<void>;
}

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const AlarmModal: React.FC<AlarmModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [time, setTime] = useState('20:00');
    const [message, setMessage] = useState('오늘은 어떤 얘기할까?');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (currentSettings) {
                setIsEnabled(currentSettings.isEnabled);
                setSelectedDays(currentSettings.days || []);
                setTime(currentSettings.time || '20:00');
                setMessage(currentSettings.message || '오늘은 어떤 얘기할까?');
            } else {
                // Defaults
                setIsEnabled(false);
                setSelectedDays([1, 3, 5]); // Mon, Wed, Fri
                setTime('20:00');
                setMessage('오늘은 어떤 얘기할까?');
            }
        }
    }, [isOpen, currentSettings]);

    if (!isOpen) return null;

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex].sort()
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                isEnabled,
                days: selectedDays,
                time,
                message
            });
            onClose();
        } catch (error) {
            console.error("Failed to save alarm settings", error);
            alert("설정 저장에 실패했습니다.");
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
                        <BellIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">대화 유도 알람 설정</h2>
                </div>

                <div className="space-y-6">
                    {/* Toggle Switch */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">알람 켜기</span>
                        <button 
                            onClick={() => setIsEnabled(!isEnabled)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${isEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className={`space-y-6 transition-opacity duration-300 ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        {/* Days Selector */}
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">반복 요일</label>
                            <div className="flex justify-between gap-1">
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <button
                                        key={index}
                                        onClick={() => toggleDay(index)}
                                        className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                                            selectedDays.includes(index)
                                                ? 'bg-indigo-500 text-white shadow-md transform scale-105'
                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Picker */}
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">알람 시간</label>
                            <input 
                                type="time" 
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl text-lg font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        {/* Message Input */}
                        <div>
                            <label className="block text-sm font-bold text-slate-500 mb-2">대화 시작 문구</label>
                            <input 
                                type="text" 
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="예: 오늘은 어떤 얘기할까?"
                                className="w-full p-3 border border-slate-200 rounded-xl text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <p className="text-xs text-slate-400 mt-1">이 문구로 알림이 발송됩니다.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                     <button 
                        onClick={onClose}
                        className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        취소
                    </button>
                    <button 
                        onClick={handleSave}
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
            </div>
        </div>
    );
};

export default AlarmModal;
