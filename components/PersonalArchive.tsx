
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, DiaryEntry, CalendarEvent } from '../types';
import { db, collection, query, where, getDocs, doc, setDoc, orderBy, addDoc, deleteDoc } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import { BookOpenIcon, LoadingSpinner, SparklesIcon, CalendarIcon, ChevronDownIcon, ClockIcon, CheckIcon, XMarkIcon, ChartBarIcon, PlusIcon, DocumentIcon, PencilIcon, TrashIcon } from './icons';

interface PersonalArchiveProps {
    user: User | null;
}

interface PeriodSummary {
    id: string;
    type: 'WEEKLY' | 'MONTHLY';
    periodKey: string;
    content: string;
    createdAt: string;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
};

const getWeekNumber = (date: Date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    return Math.ceil((date.getDate() + dayOfWeek) / 7);
};

// --- KST Date Helper Functions ---

// 1. Get exact YYYY-MM-DD string in Korea
const getKSTDateString = () => {
    const now = new Date();
    // Using en-US with Asia/Seoul ensures proper conversion
    const kstDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 2. Get Start and End timestamps (ISO UTC) for a specific KST Date
// Example: If KST Date is 2024-05-20,
// Start is 2024-05-19 15:00:00 UTC (which is 2024-05-20 00:00:00 KST)
// End is 2024-05-20 14:59:59 UTC (which is 2024-05-20 23:59:59 KST)
const getRangeForKSTDate = (kstDateStr: string) => {
    // Construct string as if it's in KST timezone (+09:00)
    // "2024-05-20T00:00:00+09:00" will be parsed correctly by Date constructor
    const startKST = new Date(`${kstDateStr}T00:00:00+09:00`).toISOString();
    const endKST = new Date(`${kstDateStr}T23:59:59.999+09:00`).toISOString();
    return { startKST, endKST };
};

// 3. Get Date Object representing KST 'Today'
const getKSTTodayObject = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
};

const PersonalArchive: React.FC<PersonalArchiveProps> = ({ user }) => {
    // Initialize view to KST month/year
    const [currentDate, setCurrentDate] = useState(() => {
        const kst = getKSTTodayObject();
        return new Date(kst.getFullYear(), kst.getMonth(), 1);
    });

    const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [summaries, setSummaries] = useState<PeriodSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatingSummary, setGeneratingSummary] = useState<'WEEKLY' | 'MONTHLY' | null>(null);
    
    // Modal State
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Get Today String in KST (YYYY-MM-DD) for highlighting
    const todayStr = useMemo(() => getKSTDateString(), []);

    // Helper to get formatted date string for comparisons
    const getDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch Diaries
            const diariesRef = collection(db, 'users', user.uid, 'diaries');
            const qDiaries = query(diariesRef, orderBy('date', 'desc'));
            const diarySnap = await getDocs(qDiaries);
            const loadedDiaries = diarySnap.docs.map(d => ({ id: d.id, ...d.data() } as DiaryEntry));
            setDiaries(loadedDiaries);

            // Fetch Calendar Events
            const eventsRef = collection(db, 'users', user.uid, 'calendarEvents');
            const qEvents = query(eventsRef);
            const eventSnap = await getDocs(qEvents);
            const loadedEvents = eventSnap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
            setEvents(loadedEvents);

            // Fetch Summaries
            const summariesRef = collection(db, 'users', user.uid, 'periodSummaries');
            const qSummaries = query(summariesRef);
            const summarySnap = await getDocs(qSummaries);
            const loadedSummaries = summarySnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodSummary));
            setSummaries(loadedSummaries);

        } catch (error) {
            console.error("Failed to fetch archive data", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddEvent = async (newEvent: Omit<CalendarEvent, 'id'>) => {
        if (!user) return;
        try {
            const safeEvent = { ...newEvent };
            // Sanitize undefined
            Object.keys(safeEvent).forEach(key => {
                if ((safeEvent as any)[key] === undefined) {
                    delete (safeEvent as any)[key];
                }
            });

            const docRef = await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), {
                ...safeEvent,
                createdAt: new Date().toISOString()
            });
            
            const eventWithId = { ...safeEvent, id: docRef.id, createdAt: new Date().toISOString() } as CalendarEvent;
            setEvents(prev => [...prev, eventWithId]);
        } catch (error) {
            console.error("Failed to add event:", error);
            alert(`일정 등록에 실패했습니다.\n오류 내용: ${(error as any).message || error}`);
        }
    };

    const handleUpdateEvent = async (eventId: string, updates: Partial<CalendarEvent>) => {
        if (!user) return;
        try {
            const eventRef = doc(db, 'users', user.uid, 'calendarEvents', eventId);
            const safeUpdates = { ...updates };
            // Sanitize undefined
            Object.keys(safeUpdates).forEach(key => {
                if ((safeUpdates as any)[key] === undefined) delete (safeUpdates as any)[key];
            });

            await setDoc(eventRef, safeUpdates, { merge: true });
            
            setEvents(prev => prev.map(evt => evt.id === eventId ? { ...evt, ...safeUpdates } : evt));
        } catch (error) {
            console.error("Failed to update event:", error);
            alert("일정 수정에 실패했습니다.");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!user) return;
        if (!confirm("정말 이 일정을 삭제하시겠습니까?")) return;
        try {
            const eventRef = doc(db, 'users', user.uid, 'calendarEvents', eventId);
            await deleteDoc(eventRef);
            
            setEvents(prev => prev.filter(evt => evt.id !== eventId));
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert("일정 삭제에 실패했습니다.");
        }
    };

    const generateTodayDiary = async () => {
        if (!user) return;
        setGenerating(true);

        try {
            // 1. Calculate Today's range in KST converted to UTC
            // This ensures that "Today's Log" includes messages from 00:00 KST to 23:59 KST
            const todayKST = getKSTDateString();
            const { startKST, endKST } = getRangeForKSTDate(todayKST);

            // Query sessions updated after KST midnight (optimization)
            const sessionsRef = collection(db, 'users', user.uid, 'chatSessions');
            const sessionQ = query(sessionsRef, where('updatedAt', '>=', startKST));
            const sessionSnap = await getDocs(sessionQ);

            let allMessages = "";

            for (const sessionDoc of sessionSnap.docs) {
                const msgsRef = collection(db, 'users', user.uid, 'chatSessions', sessionDoc.id, 'messages');
                const msgsSnap = await getDocs(msgsRef);
                const sessionMsgs = msgsSnap.docs
                    .map(d => d.data())
                    .filter((m: any) => m.createdAt >= startKST && m.createdAt <= endKST) // Precise KST day range check
                    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                
                if (sessionMsgs.length > 0) {
                    allMessages += `\n[Session: ${sessionDoc.data().title}]\n`;
                    sessionMsgs.forEach((m: any) => {
                        allMessages += `${m.sender}: ${m.text}\n`;
                    });
                }
            }

            if (!allMessages.trim()) {
                alert("오늘의 대화 기록이 충분하지 않아 다이어리를 생성할 수 없습니다.");
                setGenerating(false);
                return;
            }

            // 2. Call Gemini
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `
            You are a warm, reflective AI diary writer.
            Based on the following conversation log from today (${todayKST} KST), write a personal diary entry from the user's perspective (First Person "I").
            
            **CRITICAL LANGUAGE RULE**: 
            - The 'title', 'content', and 'tags' MUST be written in **Korean** (한국어).
            - Use a natural, reflective, and warm tone (e.g., "오늘 ~했다.", "~한 기분이 들었다.").
            
            **CONSTRAINTS**:
            1. **Length Limit**: The 'content' MUST be strictly under **500 characters**. Concise is better.
            2. **Data Integrity**: Only use facts present in the [CHAT LOG]. Do not invent details.
            3. **Brevity**: If the chat log is sparse or contains very little information, write a very short, simple entry (e.g., "오늘은 별다른 일 없이 조용히 보냈다."). Do NOT try to stretch it. Realism is key.
            
            Focus on:
            - Emotions and feelings expressed.
            - Key events or topics discussed.
            - Personal insights or self-reflection.
            
            Output strictly in JSON format:
            {
                "title": "Creative and emotional title for the day (in Korean)",
                "content": "The diary content (Korean, MAX 500 chars)",
                "mood": "Single Emoji representing the mood",
                "tags": ["Tag1", "Tag2", "Tag3 (in Korean)"]
            }

            [CHAT LOG]
            ${allMessages}
            `;

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { responseMimeType: "application/json" }
            });

            const responseData = JSON.parse(result.text || '{}');
            
            // 3. Save to Firestore using KST todayStr as ID
            // This prevents duplicate entries for the same "KST day" even if generated at different UTC times
            const diaryData: DiaryEntry = {
                id: todayKST,
                date: todayKST,
                title: responseData.title || `오늘의 기록`,
                content: responseData.content || '',
                mood: responseData.mood || '✨',
                tags: responseData.tags || [],
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'users', user.uid, 'diaries', todayKST), diaryData);
            
            setDiaries(prev => {
                const existingIndex = prev.findIndex(d => d.date === todayKST);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = diaryData;
                    return updated;
                }
                return [diaryData, ...prev];
            });

        } catch (error) {
            console.error("Diary generation failed", error);
            alert("다이어리 생성 중 오류가 발생했습니다.");
        } finally {
            setGenerating(false);
        }
    };

    const generatePeriodSummary = async (type: 'WEEKLY' | 'MONTHLY') => {
        if (!user) return;
        setGeneratingSummary(type);

        try {
            // Get KST today object
            const todayKST = getKSTTodayObject();
            
            let targetDiaries: DiaryEntry[] = [];
            let periodKey = '';

            if (type === 'WEEKLY') {
                const year = todayKST.getFullYear();
                const month = todayKST.getMonth();
                const weekNum = getWeekNumber(todayKST);
                periodKey = `${year}-${String(month + 1).padStart(2, '0')}-W${weekNum}`;
                
                targetDiaries = diaries.filter(d => {
                    // d.date is YYYY-MM-DD string. Creating new Date(d.date) works, 
                    // but we must be careful. "YYYY-MM-DD" is usually parsed as UTC.
                    // However, our d.date IS the KST date string.
                    // To compare correctly, we treat the components as numbers.
                    const [dYear, dMonth, dDay] = d.date.split('-').map(Number);
                    const dDateObj = new Date(dYear, dMonth - 1, dDay);
                    
                    return dYear === year && (dMonth - 1) === month && getWeekNumber(dDateObj) === weekNum;
                });
            } else {
                const year = todayKST.getFullYear();
                const month = todayKST.getMonth();
                periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
                
                targetDiaries = diaries.filter(d => d.date.startsWith(periodKey));
            }

            if (targetDiaries.length < 3) {
                alert("요약을 생성하기 위한 기록이 부족합니다. (최소 3개 필요)");
                setGeneratingSummary(null);
                return;
            }

            // Call Gemini
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const diaryText = targetDiaries.map(d => `[${d.date}] ${d.title} (Mood: ${d.mood})\n${d.content}`).join('\n\n');
            
            const prompt = `
            You are a thoughtful AI life coach.
            Analyze the following diary entries for this ${type === 'WEEKLY' ? 'week' : 'month'}.
            
            Task:
            Write a warm, insightful summary of the ${type === 'WEEKLY' ? 'week' : 'month'}.
            - Highlight key themes, emotional changes, and any small wins.
            - Offer a brief encouragement or advice for the next period.
            - Write in Korean, casual but polite tone (해요체).
            - Keep it around 3-5 sentences.

            [DIARIES]
            ${diaryText}
            `;

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            const summaryContent = result.text || "요약을 생성하지 못했습니다.";

            // Save
            const newSummary: PeriodSummary = {
                id: periodKey + '-' + type,
                type,
                periodKey,
                content: summaryContent,
                createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'users', user.uid, 'periodSummaries', newSummary.id), newSummary);
            setSummaries(prev => [...prev.filter(s => s.id !== newSummary.id), newSummary]);

        } catch (error) {
            console.error("Summary generation failed", error);
            alert("요약 생성 중 오류가 발생했습니다.");
        } finally {
            setGeneratingSummary(null);
        }
    };

    // Calendar Navigation
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };
    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDateClick = (day: number) => {
        const dateStr = getDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
        setSelectedDate(dateStr);
        setIsDetailModalOpen(true);
    };

    // Render Calendar Grid
    const renderCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        
        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 sm:h-32 bg-slate-50/50 border border-slate-100/50"></div>);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = getDateString(new Date(year, month, day));
            const diary = diaries.find(d => d.date === dateStr);
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = dateStr === todayStr;

            days.push(
                <div 
                    key={day} 
                    onClick={() => handleDateClick(day)}
                    className={`
                        h-24 sm:h-32 border border-slate-100 p-1 relative flex flex-col cursor-pointer transition-all hover:bg-indigo-50/30 group overflow-hidden
                        ${isToday ? 'bg-indigo-50/20 ring-2 ring-inset ring-indigo-500/20' : 'bg-white'}
                    `}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`
                            text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700'}
                        `}>
                            {day}
                        </span>
                        {diary && <span className="text-base sm:text-lg filter drop-shadow-sm">{diary.mood}</span>}
                    </div>

                    <div className="flex flex-col gap-0.5 w-full">
                        {dayEvents.slice(0, 3).map((evt, idx) => (
                            <div 
                                key={idx} 
                                className={`
                                    text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium w-full text-left leading-tight
                                    ${evt.type === 'FUTURE_PLAN' 
                                        ? 'bg-blue-100 text-blue-700' 
                                        : 'bg-emerald-100 text-emerald-700'}
                                `}
                                title={evt.title}
                            >
                                {evt.title}
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <span className="text-[9px] text-slate-400 font-bold pl-1">
                                +{dayEvents.length - 3}
                            </span>
                        )}
                    </div>
                </div>
            );
        }

        return days;
    };

    // Calculate current period keys and diary counts based on KST
    const todayKST = getKSTTodayObject();
    
    const currentWeekKey = `${todayKST.getFullYear()}-${String(todayKST.getMonth() + 1).padStart(2, '0')}-W${getWeekNumber(todayKST)}`;
    const currentMonthKey = `${todayKST.getFullYear()}-${String(todayKST.getMonth() + 1).padStart(2, '0')}`;
    
    const weeklyDiaryCount = diaries.filter(d => {
        // Safe comparison using numbers
        const [dYear, dMonth, dDay] = d.date.split('-').map(Number);
        const dDateObj = new Date(dYear, dMonth - 1, dDay);
        return dYear === todayKST.getFullYear() && (dMonth - 1) === todayKST.getMonth() && getWeekNumber(dDateObj) === getWeekNumber(todayKST);
    }).length;

    const monthlyDiaryCount = diaries.filter(d => d.date.startsWith(currentMonthKey)).length;

    const weeklySummary = summaries.find(s => s.id === currentWeekKey + '-WEEKLY');
    const monthlySummary = summaries.find(s => s.id === currentMonthKey + '-MONTHLY');

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <LoadingSpinner isWhite={false} />
                <p className="mt-2 text-sm">아카이브 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
            {/* Header - Centered Title */}
            <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200 relative z-10 grid grid-cols-3 items-center">
                <div className="flex items-center gap-2 justify-start">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                </div>
                
                <h2 className="text-xl font-bold text-slate-800 text-center">
                    {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                </h2>

                <div className="flex justify-end">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-white rounded-md transition-colors text-slate-600">
                            <ChevronDownIcon className="w-5 h-5 rotate-90" />
                        </button>
                        <button onClick={nextMonth} className="p-1 hover:bg-white rounded-md transition-colors text-slate-600">
                            <ChevronDownIcon className="w-5 h-5 -rotate-90" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50">
                <div className="w-full bg-white shadow-sm min-h-full">
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-10 shadow-sm">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 bg-slate-200 gap-px border-b border-slate-200">
                        {renderCalendarDays()}
                    </div>
                    
                    {/* Actions Area */}
                    <div className="p-6 space-y-4">
                        {/* Generate Today Button */}
                        <div className="flex justify-center">
                            <div className="w-full max-w-sm">
                                <button 
                                    onClick={generateTodayDiary}
                                    disabled={generating}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 font-bold transform active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {generating ? <LoadingSpinner /> : (
                                        <>
                                            <SparklesIcon className="w-5 h-5" />
                                            오늘의 하루 기록 생성하기
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs text-slate-400 mt-2">오늘 나눈 대화를 바탕으로 AI가 일기를 작성합니다.</p>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                            {/* Weekly Summary Card */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:border-indigo-200 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-indigo-500" />
                                        주간 요약
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{getWeekNumber(todayKST)}주차</span>
                                </div>
                                
                                {weeklySummary ? (
                                    <div className="flex-1 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {weeklySummary.content}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                                        <p className="text-xs text-slate-500 mb-3">
                                            이번 주 일기: <span className={`font-bold ${weeklyDiaryCount >= 3 ? 'text-indigo-600' : 'text-slate-400'}`}>{weeklyDiaryCount}/3</span>
                                        </p>
                                        <button 
                                            onClick={() => generatePeriodSummary('WEEKLY')}
                                            disabled={weeklyDiaryCount < 3 || generatingSummary === 'WEEKLY'}
                                            className="px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                        >
                                            {generatingSummary === 'WEEKLY' ? <LoadingSpinner isWhite={false}/> : <SparklesIcon className="w-3 h-3"/>}
                                            {weeklyDiaryCount < 3 ? '기록 부족' : '요약 생성'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Monthly Summary Card */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:border-purple-200 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        <DocumentIcon className="w-4 h-4 text-purple-500" />
                                        월간 회고
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{todayKST.getMonth() + 1}월</span>
                                </div>
                                
                                {monthlySummary ? (
                                    <div className="flex-1 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {monthlySummary.content}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                                        <p className="text-xs text-slate-500 mb-3">
                                            이번 달 일기: <span className={`font-bold ${monthlyDiaryCount >= 3 ? 'text-purple-600' : 'text-slate-400'}`}>{monthlyDiaryCount}/3</span>
                                        </p>
                                        <button 
                                            onClick={() => generatePeriodSummary('MONTHLY')}
                                            disabled={monthlyDiaryCount < 3 || generatingSummary === 'MONTHLY'}
                                            className="px-4 py-2 bg-purple-50 text-purple-600 font-bold text-xs rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                                        >
                                            {generatingSummary === 'MONTHLY' ? <LoadingSpinner isWhite={false}/> : <SparklesIcon className="w-3 h-3"/>}
                                            {monthlyDiaryCount < 3 ? '기록 부족' : '회고 생성'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Insights Section */}
                    <MonthlyInsights 
                        currentDate={currentDate} 
                        diaries={diaries} 
                        events={events} 
                    />
                </div>
            </div>

            {/* Daily Detail Modal */}
            {isDetailModalOpen && selectedDate && createPortal(
                <DailyDetailModal 
                    date={selectedDate}
                    diary={diaries.find(d => d.date === selectedDate)}
                    events={events.filter(e => e.date === selectedDate)}
                    onClose={() => setIsDetailModalOpen(false)}
                    onAddEvent={handleAddEvent}
                    onUpdateEvent={handleUpdateEvent}
                    onDeleteEvent={handleDeleteEvent}
                />,
                document.body
            )}
        </div>
    );
};

const MonthlyInsights: React.FC<{ 
    currentDate: Date; 
    diaries: DiaryEntry[]; 
    events: CalendarEvent[]; 
}> = ({ currentDate, diaries, events }) => {
    // 1. Filter Data for Current Month
    const { monthDiaries, monthEvents } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        
        return {
            monthDiaries: diaries.filter(d => d.date.startsWith(prefix)),
            monthEvents: events.filter(e => e.date.startsWith(prefix))
        };
    }, [currentDate, diaries, events]);

    // 2. Calculate Stats
    const stats = useMemo(() => {
        // Mood
        const moodCounts: Record<string, number> = {};
        monthDiaries.forEach(d => {
            moodCounts[d.mood] = (moodCounts[d.mood] || 0) + 1;
        });
        const dominantMood = Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b, '❓');

        // Tags
        const tagCounts: Record<string, number> = {};
        monthDiaries.flatMap(d => d.tags).forEach(t => {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
        const topTags = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([t]) => t);

        return { dominantMood, topTags };
    }, [monthDiaries]);

    // 3. Weekly Breakdown
    const weeklyData = useMemo(() => {
        const weeks: Record<number, { events: CalendarEvent[], diaries: DiaryEntry[] }> = {};
        
        monthEvents.forEach(e => {
            const [y, m, d] = e.date.split('-').map(Number);
            const date = new Date(y, m-1, d);
            const w = getWeekNumber(date);
            if (!weeks[w]) weeks[w] = { events: [], diaries: [] };
            weeks[w].events.push(e);
        });

        monthDiaries.forEach(d => {
            const [y, m, day] = d.date.split('-').map(Number);
            const date = new Date(y, m-1, day);
            const w = getWeekNumber(date);
            if (!weeks[w]) weeks[w] = { events: [], diaries: [] };
            weeks[w].diaries.push(d);
        });

        return Object.entries(weeks).sort(([a], [b]) => Number(a) - Number(b));
    }, [monthEvents, monthDiaries]);

    if (monthDiaries.length === 0 && monthEvents.length === 0) {
        return null; // Don't show if no data
    }

    return (
        <div className="px-6 pb-20 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4 pt-6 border-t border-slate-200">
                <ChartBarIcon className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-800">
                    {currentDate.getMonth() + 1}월의 기록 요약
                </h3>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-1">{stats.dominantMood}</span>
                    <span className="text-xs text-slate-500 font-medium">주된 기분</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-indigo-600 mb-1">{monthDiaries.length}</span>
                    <span className="text-xs text-slate-500 font-medium">작성한 일기</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-emerald-600 mb-1">{monthEvents.length}</span>
                    <span className="text-xs text-slate-500 font-medium">등록된 일정</span>
                </div>
            </div>

            {/* Weekly Timeline */}
            <div className="space-y-6">
                {weeklyData.map(([weekNum, data]) => (
                    <div key={weekNum} className="relative pl-4 border-l-2 border-slate-200">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 bg-slate-100 border-2 border-slate-300 rounded-full"></div>
                        <h4 className="text-sm font-bold text-slate-700 mb-3 ml-2">{weekNum}주차</h4>
                        
                        <div className="space-y-3 ml-2">
                            {/* Events List */}
                            {data.events.length > 0 && (
                                <div className="space-y-2">
                                    {data.events.map(evt => (
                                        <div key={evt.id} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                            <div className={`w-1.5 h-8 rounded-full ${evt.type === 'FUTURE_PLAN' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className="text-xs font-bold text-slate-700 truncate">{evt.title}</span>
                                                    <span className="text-[10px] text-slate-400">{evt.date.slice(5)}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate">{evt.category} | {evt.description || '상세 없음'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Diaries List (Condensed) */}
                            {data.diaries.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {data.diaries.map(diary => (
                                        <span key={diary.id} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] rounded-md border border-indigo-100">
                                            <span>{diary.mood}</span>
                                            <span className="truncate max-w-[80px]">{diary.title}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {data.events.length === 0 && data.diaries.length === 0 && (
                                <p className="text-xs text-slate-400 italic">기록이 없습니다.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Keyword Cloud */}
            {stats.topTags.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">이달의 키워드</h4>
                    <div className="flex flex-wrap gap-2">
                        {stats.topTags.map((tag, i) => (
                            <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Daily Detail Modal Component ---
const DailyDetailModal: React.FC<{ 
    date: string; 
    diary?: DiaryEntry; 
    events: CalendarEvent[]; 
    onClose: () => void;
    onAddEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
    onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
    onDeleteEvent: (id: string) => Promise<void>;
}> = ({ date, diary, events, onClose, onAddEvent, onUpdateEvent, onDeleteEvent }) => {
    const sortedEvents = [...events].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
    const [y, m, d] = date.split('-');

    // Add/Edit Event Form State
    const [isAdding, setIsAdding] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [type, setType] = useState<'FUTURE_PLAN' | 'PAST_RECORD'>('FUTURE_PLAN');
    const [category, setCategory] = useState('MEETING');
    const [desc, setDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const resetForm = () => {
        setIsAdding(false);
        setEditingEventId(null);
        setTitle('');
        setTime('');
        setDesc('');
        setType('FUTURE_PLAN');
        setCategory('MEETING');
    };

    const handleStartEdit = (evt: CalendarEvent) => {
        setEditingEventId(evt.id);
        setTitle(evt.title);
        setTime(evt.time || '');
        setType(evt.type);
        setCategory(evt.category);
        setDesc(evt.description || '');
        setIsAdding(true);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('제목을 입력해주세요.');
            return;
        }
        setIsSaving(true);
        try {
            const eventData = {
                date,
                title,
                time: time || undefined,
                type,
                category: category as any,
                description: desc
            };

            if (editingEventId) {
                await onUpdateEvent(editingEventId, eventData);
            } else {
                await onAddEvent(eventData);
            }
            resetForm();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-indigo-600 p-6 text-white relative flex-shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                        <XMarkIcon className="w-5 h-5 text-white" />
                    </button>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold">{d}</span>
                        <span className="text-lg opacity-80">{y}년 {m}월</span>
                        <span className="text-lg opacity-80">({['일','월','화','수','목','금','토'][new Date(Number(y), Number(m)-1, Number(d)).getDay()]})</span>
                    </div>
                    {diary && (
                        <div className="absolute bottom-4 right-6 text-5xl filter drop-shadow-md transform translate-y-1/4">
                            {diary.mood}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
                    {/* Diary Section */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <BookOpenIcon className="w-4 h-4" />
                            오늘의 일기 요약
                        </h3>
                        {diary ? (
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-slate-800 mb-2 font-serif">"{diary.title}"</h4>
                                <p className="text-sm text-slate-600 leading-relaxed font-serif whitespace-pre-wrap">{diary.content}</p>
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {diary.tags.map(t => <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#{t}</span>)}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                                <p className="text-slate-400 text-sm">작성된 일기가 없습니다.</p>
                            </div>
                        )}
                    </section>

                    {/* Timeline Section */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <ClockIcon className="w-4 h-4" />
                                타임라인 / 일정
                            </h3>
                            {!isAdding && (
                                <button 
                                    onClick={() => {
                                        resetForm();
                                        setIsAdding(true);
                                    }}
                                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    일정 추가
                                </button>
                            )}
                        </div>

                        {/* ADD/EDIT FORM */}
                        {isAdding && (
                            <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-md mb-4 animate-fade-in-up">
                                <div className="space-y-3">
                                    <input 
                                        type="text" 
                                        placeholder="제목 (예: 멘토링 세션)" 
                                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-indigo-500 outline-none"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        autoFocus
                                    />
                                    
                                    <div className="flex gap-2">
                                        <input 
                                            type="time" 
                                            className="p-2 border border-slate-300 rounded text-sm focus:border-indigo-500 outline-none"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                        />
                                        <select 
                                            className="flex-1 p-2 border border-slate-300 rounded text-sm focus:border-indigo-500 outline-none"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value as any)}
                                        >
                                            <option value="MEETING">미팅/약속</option>
                                            <option value="STUDY">공부/작업</option>
                                            <option value="DEADLINE">마감/제출</option>
                                            <option value="TRAVEL">이동/여행</option>
                                            <option value="ETC">기타</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-2 text-xs font-bold">
                                        <button 
                                            onClick={() => setType('FUTURE_PLAN')}
                                            className={`flex-1 py-2 rounded border transition-colors ${type === 'FUTURE_PLAN' ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-100'}`}
                                        >
                                            미래 계획
                                        </button>
                                        <button 
                                            onClick={() => setType('PAST_RECORD')}
                                            className={`flex-1 py-2 rounded border transition-colors ${type === 'PAST_RECORD' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                                        >
                                            과거 이력
                                        </button>
                                    </div>

                                    <textarea 
                                        placeholder="상세 내용 (선택)" 
                                        rows={2}
                                        className="w-full p-2 border border-slate-300 rounded text-sm focus:border-indigo-500 outline-none resize-none"
                                        value={desc}
                                        onChange={(e) => setDesc(e.target.value)}
                                    />

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button 
                                            onClick={resetForm}
                                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded"
                                        >
                                            취소
                                        </button>
                                        <button 
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm disabled:opacity-50"
                                        >
                                            {isSaving ? '저장 중...' : (editingEventId ? '수정' : '저장')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="relative pl-4 space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {sortedEvents.length > 0 ? sortedEvents.map((evt) => (
                                <div key={evt.id} className="relative pl-8 group">
                                    <div className={`
                                        absolute left-[13px] top-3 w-3.5 h-3.5 rounded-full z-10 border-2 border-white shadow-sm
                                        ${evt.type === 'FUTURE_PLAN' ? 'bg-blue-500' : 'bg-emerald-500'}
                                    `}></div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group-hover:border-indigo-200 transition-colors">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${evt.type === 'FUTURE_PLAN' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                                                    {evt.type === 'FUTURE_PLAN' ? '계획' : '이력'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">{evt.time || 'All Day'}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-700 text-sm">{evt.title}</h4>
                                            {evt.description && <p className="text-xs text-slate-500 mt-0.5">{evt.description}</p>}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                {evt.category}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => handleStartEdit(evt)} 
                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                    title="수정"
                                                >
                                                    <PencilIcon className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => onDeleteEvent(evt.id)} 
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="삭제"
                                                >
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                !isAdding && <div className="pl-8 text-sm text-slate-400">등록된 일정이 없습니다.</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PersonalArchive;
