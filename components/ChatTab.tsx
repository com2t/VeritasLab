
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Part, LiveServerMessage, Modality, Blob, Content, Chat } from '@google/genai';
import { ChatMessage, Experience, UserProfile, User, JobFitAnalysis } from '../types';
import { LoadingSpinner, PaperclipIcon, XCircleIcon, PhoneIcon, PaperAirplaneIcon, PhoneHangUpIcon, PauseIcon, PlayIcon, MicrophoneIcon, ChatIcon, FolderIcon, ChartPieIcon, ArrowLeftIcon } from './icons';
import { db, collection, addDoc, query, orderBy, doc, updateDoc, onSnapshot, setDoc } from '../firebase';
import { 
    requestToSaveExperience, 
    saveFinalizedStory, 
    saveExperienceAnalysis,
    saveExperienceShell, 
    saveBulkExperiences, 
    showExperienceTable, 
    completeOnboardingCollection, 
    showJobFitDashboard,
    createTextChatSystemInstruction 
} from '../utils/chatPrompts';
import JobFitAnalysisView from './JobFitAnalysisView';

// FIX: A local LiveSession interface is defined for type safety.
interface LiveSession {
    sendRealtimeInput(input: { media: Blob }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; }; }): void;
    close(): void;
}

// --- Web Speech API type definitions ---
interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onstart: () => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
}

// --- Voice Prompt for Live API ---
const VOICE_SYSTEM_INSTRUCTION_NATURAL = `You are a friendly and helpful AI career coach. You are speaking with the user over a real-time voice call.
Your goal is to help them organize their career experiences or just have a casual chat about their day.

Key Behaviors:
1. **Speak Korean:** All responses must be in natural, spoken Korean.
2. **Be Conversational:** Keep responses concise (1-3 sentences) to maintain a natural back-and-forth flow. Avoid long monologues.
3. **Listen Activey:** If the user talks about a project or experience, ask follow-up questions to dig deeper (STAR method).
4. **Use Tools:** If you identify a distinct experience, use the 'requestToSaveExperience' tool to save it.

Style: Warm, encouraging, professional but casual (like a mentor).
`;


// --- Component Props & Types ---
interface ChatTabProps {
    onAddExperience: (newExperienceData: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'>) => Promise<string | void>; 
    onUpdateExperience: (storyId: string, updates: Partial<Experience>) => void;
    experiences: Experience[];
    userProfile: UserProfile | null;
    sessionId: string | null;
    user: User;
    onSessionChange: (sessionId: string | null) => void;
    isOnboarding: boolean;
    onJobFitAnalysis?: (data: JobFitAnalysis) => void; // New prop
    onNavigateToData?: () => void; // New nav prop
    onNavigateToReport?: () => void; // New nav prop
}
type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
type ViewMode = 'landing' | 'chat' | 'call';

interface ConfirmationRequest {
    id: string;
    summary: string;
    toolName: string;
    rawData?: any; 
}

const QUICK_SUGGESTIONS = [
    "오늘 하루 기록하기 📝",
    "기억에 남는 프로젝트 정리 📂",
    "동아리/대외활동 다시보기 🚩",
    "내 직무 적합도 분석해줘 📊"
];


// --- Audio Helper Functions for Live API ---
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before scaling
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


// --- Helper Functions ---
const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
};

const ExperienceTable: React.FC<{ experiences: Experience[] }> = ({ experiences }) => {
    const { matrix, uniquePeriods, uniqueCategories } = useMemo(() => {
        const uniquePeriodsSet = new Set<string>();
        const uniqueCategoriesSet = new Set<string>();

        experiences.forEach(exp => {
            if (exp.activity_date) uniquePeriodsSet.add(exp.activity_date);
            if (exp.activity_type) uniqueCategoriesSet.add(exp.activity_type);
        });

        const sortPeriods = (a: string, b: string) => {
            const getYear = (s: string) => parseInt(s.match(/\d{4}/)?.[0] || '0');
            const getTermOrder = (s: string) => {
                if (s.includes('1학기')) return 1;
                if (s.includes('여름')) return 2;
                if (s.includes('2학기')) return 3;
                if (s.includes('겨울')) return 4;
                return 5;
            };

            const yearA = getYear(a);
            const yearB = getYear(b);
            if (yearA !== yearB) return yearA - yearB;
            return getTermOrder(a) - getTermOrder(b);
        };

        const uniquePeriods = Array.from(uniquePeriodsSet).sort(sortPeriods);
        // Added '자격증' to the default order
        const defaultOrder = ['수강과목', '동아리', '스터디', '자격증', '봉사활동', '프로젝트', '공모전', '대외활동', '인턴', '알바'];
        const uniqueCategories = Array.from(uniqueCategoriesSet).sort((a, b) => {
             const idxA = defaultOrder.indexOf(a);
             const idxB = defaultOrder.indexOf(b);
             if (idxA !== -1 && idxB !== -1) return idxA - idxB;
             if (idxA !== -1) return -1;
             if (idxB !== -1) return 1;
             return a.localeCompare(b);
        });

        const matrix: Record<string, Record<string, string[]>> = {};
        
        uniquePeriods.forEach(period => {
            matrix[period] = {};
            uniqueCategories.forEach(cat => {
                matrix[period][cat] = [];
            });
        });

        experiences.forEach(exp => {
            if (exp.activity_date && exp.activity_type && matrix[exp.activity_date] && matrix[exp.activity_date][exp.activity_type]) {
                matrix[exp.activity_date][exp.activity_type].push(exp.activity_name);
            }
        });

        return { matrix, uniquePeriods, uniqueCategories };
    }, [experiences]);

    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white my-4">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                            시기 / 카테고리
                        </th>
                        {uniqueCategories.map(cat => (
                            <th key={cat} scope="col" className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                {cat}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200 text-sm">
                    {uniquePeriods.map((period, rowIdx) => (
                        <tr key={period} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-3 py-3 whitespace-nowrap font-semibold text-indigo-600 border-r border-slate-200 sticky left-0 bg-inherit z-10">
                                {period}
                            </td>
                            {uniqueCategories.map(cat => (
                                <td key={`${period}-${cat}`} className="px-3 py-3 align-top">
                                    {matrix[period][cat].length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {matrix[period][cat].map((name, i) => (
                                                <span key={i} className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300">-</span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- Voice Call Overlay Component ---
const VoiceCallOverlay: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    status: VoiceState; 
    transcript?: string;
}> = ({ isOpen, onClose, status, transcript }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black z-50 flex flex-col items-center justify-between py-12 animate-fade-in text-white">
            <div className="text-center mt-10">
                <h2 className="text-2xl font-bold tracking-wider mb-2 opacity-90">경험 스택 AI 코치</h2>
                <p className="text-indigo-200 text-sm font-medium uppercase tracking-widest">{status === 'connecting' ? '연결 중...' : '통화 중'}</p>
            </div>

            <div className="flex-1 flex items-center justify-center relative w-full">
                {/* Visualizer Circles */}
                <div className={`w-32 h-32 rounded-full bg-white/10 blur-xl absolute transition-all duration-700 ${status === 'speaking' ? 'scale-150 opacity-50' : 'scale-100 opacity-20'}`}></div>
                <div className={`w-48 h-48 rounded-full bg-indigo-500/20 blur-2xl absolute transition-all duration-1000 ${status === 'listening' ? 'scale-125 opacity-60' : 'scale-90 opacity-30'}`}></div>
                
                {/* Main Avatar */}
                <div className="relative w-32 h-32 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-float">
                    <span className="text-5xl">🤖</span>
                    
                    {/* Ripple Effect when AI speaks */}
                    {status === 'speaking' && (
                         <>
                            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping"></span>
                         </>
                    )}
                </div>
            </div>

            <div className="px-6 w-full max-w-md text-center h-20 mb-10">
                <p className="text-lg font-medium text-slate-200 transition-opacity duration-300">
                    {transcript || (status === 'listening' ? "듣고 있어요..." : "...")}
                </p>
            </div>

            <div className="mb-10">
                <button 
                    onClick={onClose}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                >
                    <PhoneHangUpIcon className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
};


// --- Main ChatTab Component ---
const ChatTab: React.FC<ChatTabProps> = ({ onAddExperience, onUpdateExperience, experiences, userProfile, sessionId, user, onSessionChange, isOnboarding, onJobFitAnalysis, onNavigateToData, onNavigateToReport }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [attachedUrl, setAttachedUrl] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('landing');
    
    // Voice Call State
    const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
    const [voiceCallStatus, setVoiceCallStatus] = useState<VoiceState>('idle');
    const [voiceTranscript, setVoiceTranscript] = useState('');

    const [isListeningForText, setIsListeningForText] = useState(false);
    const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
    const [lastSavedExperienceId, setLastSavedExperienceId] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(true);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatMessagesRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatRef = useRef<Chat | null>(null);

    // Live API Refs
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<{ in: AudioContext | null, out: AudioContext | null }>({ in: null, out: null });
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const liveUserTranscriptRef = useRef('');
    const liveAiTranscriptRef = useRef('');
    const hasTriggeredInit = useRef(false);
    const prevSessionIdRef = useRef<string | null>(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    // Sanitize experiences to avoid Circular JSON errors during initChat
    const safeExperiences = useMemo(() => {
        return experiences.map(exp => ({
            activity_name: exp.activity_name || '',
            activity_type: exp.activity_type || '',
            activity_date: exp.activity_date || '',
            story_title: exp.story_title || '',
            story_summary: exp.story_summary || ''
        } as Experience)); 
    }, [experiences]);

    const initChat = useCallback(async (history: Content[] = []) => {
        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: createTextChatSystemInstruction(safeExperiences, userProfile, isOnboarding),
                temperature: 0.7,
                tools: [{ functionDeclarations: [
                    requestToSaveExperience, 
                    saveExperienceShell, 
                    saveBulkExperiences, 
                    saveFinalizedStory, 
                    saveExperienceAnalysis, 
                    showExperienceTable, 
                    completeOnboardingCollection,
                    showJobFitDashboard
                ] }],
            },
            history: history,
        });
    }, [safeExperiences, userProfile, isOnboarding]);

    // --- Live API (Voice Call) Implementation ---
    const startVoiceSession = async () => {
        setIsVoiceCallOpen(true);
        setVoiceCallStatus('connecting');
        
        // Initialize Audio Contexts
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = { in: inputCtx, out: outputCtx };
        nextStartTimeRef.current = 0;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log("Live API Connected");
                        setVoiceCallStatus('listening');
                        
                        // Setup Input Stream
                        const source = inputCtx.createMediaStreamSource(stream);
                        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        audioProcessorRef.current = processor;

                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };

                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const { serverContent } = msg;

                        if (serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                            // Audio Output
                            setVoiceCallStatus('speaking');
                            const base64Audio = serverContent.modelTurn.parts[0].inlineData.data;
                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                outputCtx,
                                24000,
                                1
                            );
                            
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            
                            const currentTime = outputCtx.currentTime;
                            const startTime = Math.max(currentTime, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            
                            audioSourcesRef.current.add(source);
                            source.onended = () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                     setVoiceCallStatus('listening');
                                }
                            };
                        }

                        if (serverContent?.turnComplete) {
                            setVoiceCallStatus('listening');
                            setVoiceTranscript('');
                        }
                        
                        if (serverContent?.interrupted) {
                             audioSourcesRef.current.forEach(s => s.stop());
                             audioSourcesRef.current.clear();
                             nextStartTimeRef.current = 0;
                             setVoiceCallStatus('listening');
                        }

                        // Tool Calling Support in Voice Mode
                        if (msg.toolCall) {
                             for (const fc of msg.toolCall.functionCalls) {
                                 // Simple handling for requestToSaveExperience in voice mode
                                 // We just confirm it was heard, actual saving might be tricky without UI confirmation in voice mode.
                                 // For V1, we will just acknowledge.
                                 const result = "확인했습니다. (음성 모드에서는 자동 저장됩니다)";
                                 if (fc.name === 'requestToSaveExperience') {
                                     const args = fc.args as any;
                                     // Background save attempt (simplified)
                                     const newExperience: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'> = {
                                        type: 'basic', 
                                        activity_date: args.period || 'Unknown', 
                                        activity_type: args.category || 'Voice',
                                        activity_name: args.activity_name || 'Voice Entry', 
                                        story_summary: args.result || "음성으로 기록됨",
                                        result_achievement: args.result, 
                                        key_insight: args.learning,
                                        detailed_content: `[Voice Entry]\nTask: ${args.task}\nAction: ${args.actions}`,
                                        what: args.activity_name, when: args.period, where: '', who: '', why: '', how: '',
                                        story_title: '', core_competency: '', job_alignment: '', situation: '', task: '', action: '', result_quantitative: '', result_qualitative: '', learning: '',
                                    };
                                    onAddExperience(newExperience);
                                 }
                                 
                                 sessionPromise.then(session => session.sendToolResponse({
                                     functionResponses: {
                                         id: fc.id,
                                         name: fc.name,
                                         response: { result: result }
                                     }
                                 }));
                             }
                        }
                    },
                    onclose: () => {
                        console.log("Live API Closed");
                        stopVoiceSession();
                    },
                    onerror: (err) => {
                        console.error("Live API Error", err);
                        setVoiceCallStatus('error');
                        setTimeout(stopVoiceSession, 2000);
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                    },
                    systemInstruction: VOICE_SYSTEM_INSTRUCTION_NATURAL,
                    tools: [{ functionDeclarations: [requestToSaveExperience] }]
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (error) {
            console.error("Failed to start voice session", error);
            stopVoiceSession();
        }
    };

    const stopVoiceSession = () => {
        // Close session
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        
        // Stop audio tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Close Audio Contexts
        if (audioContextRef.current.in) audioContextRef.current.in.close();
        if (audioContextRef.current.out) audioContextRef.current.out.close();
        audioContextRef.current = { in: null, out: null };
        
        setIsVoiceCallOpen(false);
        setVoiceCallStatus('idle');
    };


    useEffect(() => {
        if (!sessionId) {
            setMessages([]);
            initChat([]); 
            setViewMode('landing');
            hasTriggeredInit.current = false;
            prevSessionIdRef.current = null;
            return;
        }

        if (sessionId !== prevSessionIdRef.current) {
             prevSessionIdRef.current = sessionId;
             
             if (sessionId.startsWith('onboarding-')) {
                 setViewMode('landing');
             } else {
                 setViewMode('chat');
             }
             setShowSuggestions(true);
        }
        
        const messagesRef = collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatMessage));
            setMessages(loadedMessages);
            
            if (loadedMessages.length > 0) {
                setShowSuggestions(false);
            } else {
                setShowSuggestions(true);
            }
            
            const history: Content[] = loadedMessages.map(msg => ({
                role: msg.sender === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));
            
            if (!chatRef.current) {
                initChat(history);
            }
        });

        return () => unsubscribe();
    }, [sessionId, user.uid, initChat]);

    const AiMessage: React.FC<{ msg: ChatMessage }> = ({ msg }) => (
        <div className="message flex gap-3 animate-fade-in-up">
            <div className="message-avatar w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                🤖
            </div>
            <div className="message-content max-w-lg md:max-xl p-3 px-4 rounded-2xl rounded-bl-lg bg-slate-100 text-slate-800 leading-relaxed shadow-sm overflow-x-auto">
                <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                {msg.component}
            </div>
        </div>
    );
    
    const UserMessage: React.FC<{ text: string }> = ({ text }) => (
        <div className="message flex gap-3 self-end flex-row-reverse animate-fade-in-up">
            <div className="message-avatar w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 bg-emerald-500 text-white">
                👤
            </div>
            <div className="message-content max-w-lg md:max-xl p-3 px-4 rounded-2xl rounded-br-lg bg-indigo-500 text-white leading-relaxed shadow-sm">
                <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
            </div>
        </div>
    );
    
    const ConfirmationComponent: React.FC<{ onConfirm: () => void; onCancel: () => void; }> = ({ onConfirm, onCancel }) => (
        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors">
                수정하기
            </button>
            <button onClick={onConfirm} className="px-4 py-1.5 text-sm font-semibold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors">
                저장하기
            </button>
        </div>
    );
    
    const QuickSuggestions = () => {
        if (!showSuggestions) return null;
        
        return (
            <div className="absolute bottom-[80px] left-0 right-0 flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide bg-gradient-to-t from-white via-white/80 to-transparent z-10">
                {QUICK_SUGGESTIONS.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="flex-shrink-0 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full border border-indigo-100 transition-all shadow-sm active:scale-95 whitespace-nowrap backdrop-blur-sm"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        );
    };

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition: SpeechRecognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'ko-KR';

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                setInputValue(prev => (prev ? prev + ' ' : '') + transcript);
            };
            recognition.onstart = () => setIsListeningForText(true);
            recognition.onend = () => setIsListeningForText(false);
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);
                setIsListeningForText(false);
            };
            recognitionRef.current = recognition;
        } else {
            console.warn("Speech Recognition API is not supported in this browser.");
        }
        return () => recognitionRef.current?.stop();
    }, []);

    const handleToggleListen = () => {
        if (!recognitionRef.current) return;
        if (isListeningForText) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    const persistMessage = async (text: string, sender: 'user' | 'ai', sid: string) => {
        const newMessage: Omit<ChatMessage, 'id'> = {
            text,
            sender,
            createdAt: new Date().toISOString()
        };
        
        try {
            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sid, 'messages'), newMessage);
        } catch (e) {
            console.error("Error adding message:", e);
        }
        
        const sessionRef = doc(db, 'users', user.uid, 'chatSessions', sid);

        try {
            await updateDoc(sessionRef, {
                lastMessage: text,
                updatedAt: new Date().toISOString()
            });
        } catch (e: any) {
            if (e.code === 'not-found' || e.message?.includes("No document to update")) {
                const title = sid.includes('onboarding') ? '온보딩' : '새로운 대화';
                await setDoc(sessionRef, {
                    title: title,
                    createdAt: new Date().toISOString(),
                    lastMessage: text,
                    updatedAt: new Date().toISOString()
                });
            } else {
                console.error("Error updating session:", e);
            }
        }
    };

    const ensureSession = async (): Promise<string> => {
        if (sessionId) return sessionId;
        const newSessionId = `session_${Date.now()}`;
        const today = new Date();
        const dateString = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}. 대화`;
        
        const newSessionRef = doc(collection(db, 'users', user.uid, 'chatSessions'), newSessionId);
        await setDoc(newSessionRef, {
            createdAt: new Date().toISOString(),
            title: dateString,
            lastMessage: '',
            updatedAt: new Date().toISOString()
        });
        
        onSessionChange(newSessionId);
        return newSessionId;
    };

    const addAiMessage = useCallback(async (text: string, component?: React.ReactNode) => {
        const newMsg = { id: Date.now().toString() + Math.random(), sender: 'ai' as const, text, component };
        setMessages(prev => [...prev, newMsg]);
        return newMsg.id;
    }, []);

    const addUserMessage = useCallback((text: string) => {
        setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender: 'user', text }]);
    }, []);
    
    const scrollToBottom = () => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, showSuggestions]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [inputValue]);

    useEffect(() => {
        if (viewMode === 'chat') {
            if (!chatRef.current) {
                 initChat([]);
            }

            if (messages.length === 0 && !hasTriggeredInit.current) {
                 hasTriggeredInit.current = true;
                 
                 if (isOnboarding) {
                     const triggerOnboarding = async () => {
                         try {
                             setIsLoading(true);
                             const result = await chatRef.current?.sendMessage({
                                 message: " " 
                             });
                             if (result && result.text) {
                                 await persistMessage(result.text, 'ai', sessionId || `onboarding-${user.uid}`);
                             }
                         } catch(e) {
                             console.error(e);
                             addAiMessage("안녕하세요! 경험 스택 코치입니다. 경험 정리를 시작해볼까요?");
                         } finally {
                             setIsLoading(false);
                         }
                     };
                     triggerOnboarding();
                 } else {
                     addAiMessage(`안녕하세요 ${userProfile?.name || '사용자'}님! 경험 스택 코치입니다. \n어떤 활동을 정리하거나, 새로운 이야기를 만들어볼까요?`);
                 }
            }
        }
    }, [viewMode, safeExperiences, userProfile, isOnboarding]);

    const handleSendMessage = async (textOverride?: string) => {
        const textToSend = textOverride || inputValue;
        if (!textToSend.trim() && attachedFiles.length === 0 && !attachedUrl) return;
        if (isLoading) return;

        setInputValue('');
        setAttachedFiles([]);
        setAttachedUrl('');
        setIsLoading(true);
        setShowSuggestions(false); 
        
        const activeSessionId = await ensureSession();
        
        await persistMessage(textToSend, 'user', activeSessionId);
        
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        try {
            if (!chatRef.current) throw new Error("Chat not initialized");

            const parts: (string | Part)[] = [{ text: textToSend }];
            
            if (attachedFiles.length > 0) {
                for (const file of attachedFiles) {
                    const part = await fileToGenerativePart(file);
                    parts.push(part);
                }
            }

            if (attachedUrl) {
                parts.push({ text: `\n[User attached URL: ${attachedUrl}]` });
            }

            const result = await chatRef.current.sendMessage({
                message: parts
            });

            const responseText = result.text;
            const functionCalls = result.functionCalls;
            
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                const args = call.args;
                
                if (call.name === 'requestToSaveExperience') {
                    const actionsList = Array.isArray(args.actions) ? args.actions.join('\n- ') : args.actions;
                    const summaryText = `[활동명] ${args.activity_name}\n[결과] ${args.result}\n\n[행동]\n- ${actionsList}`;
                    
                    const aiText = `경험(Fact) 추출이 완료되었습니다. 저장할까요?\n\n${summaryText}`;
                    await persistMessage(aiText, 'ai', activeSessionId);

                    addAiMessage(aiText,
                        <ConfirmationComponent
                            onConfirm={() => handleConfirmSave({
                                id: call.id,
                                summary: summaryText,
                                toolName: 'requestToSaveExperience',
                                rawData: args
                            })}
                            onCancel={() => handleCancelSave({
                                id: call.id,
                                summary: summaryText,
                                toolName: 'requestToSaveExperience'
                            })}
                        />
                    );
                } else if (call.name === 'saveFinalizedStory') {
                     const aiText = `스토리가 완성되었습니다. 저장할까요?\n\n[${args.story_title}]\n${args.star_text_short}`;
                     await persistMessage(aiText, 'ai', activeSessionId);

                     addAiMessage(aiText,
                        <ConfirmationComponent
                             onConfirm={() => handleConfirmSave({
                                id: call.id,
                                summary: args.star_text_short as string,
                                toolName: 'saveFinalizedStory',
                                rawData: args
                             })}
                             onCancel={() => handleCancelSave({
                                id: call.id,
                                summary: args.star_text_short as string,
                                toolName: 'saveFinalizedStory'
                             })}
                        />
                     );

                } else if (call.name === 'saveExperienceShell') {
                     const newShell: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'> = {
                        type: 'basic',
                        activity_name: args.activity_name as string,
                        activity_date: args.activity_date as string,
                        activity_type: args.activity_type ? (args.activity_type as string) : '미분류',
                        what: '', when: args.activity_date as string, where: '', who: '', why: '', how: '', result_achievement: '', key_insight: '', detailed_content: '',
                        story_title: '', story_summary: '', core_competency: '', job_alignment: '', situation: '', task: '', action: '', result_quantitative: '', result_qualitative: '', learning: ''
                     };
                     await onAddExperience(newShell);
                     
                     const toolResult = await chatRef.current.sendMessage({
                         message: [{ functionResponse: { name: 'saveExperienceShell', id: call.id, response: { result: "Success." } } }]
                     });
                     
                     if (toolResult.text && !toolResult.text.includes("saveExperienceShell_response")) {
                         await persistMessage(toolResult.text, 'ai', activeSessionId);
                     }

                } else if (call.name === 'save_bulk_experiences') {
                    const list = args.experience_list as any[];
                    if (Array.isArray(list)) {
                        for (const item of list) {
                             const newShell: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'> = {
                                type: 'basic',
                                activity_name: item.title,
                                activity_date: item.period || '날짜 미상',
                                activity_type: item.category || '미분류',
                                what: '', when: item.period || '', where: '', who: '', why: '', how: '', result_achievement: '', key_insight: '', detailed_content: '',
                                story_title: '', story_summary: '', core_competency: '', job_alignment: '', situation: '', task: '', action: '', result_quantitative: '', result_qualitative: '', learning: ''
                            };
                            await onAddExperience(newShell);
                        }
                    }

                    const toolResult = await chatRef.current.sendMessage({
                        message: [{ functionResponse: { name: 'save_bulk_experiences', id: call.id, response: { result: `Saved ${list?.length || 0} items.` } } }]
                    });

                    if (toolResult.text && !toolResult.text.includes("save_bulk_experiences")) {
                        await persistMessage(toolResult.text, 'ai', activeSessionId);
                    }

                } else if (call.name === 'showExperienceTable') {
                     const aiText = "네, 지금까지 수집된 경험들을 표로 정리해드릴게요.";
                     await persistMessage(aiText, 'ai', activeSessionId);
                     
                     addAiMessage(aiText, <ExperienceTable experiences={experiences} />);
                     
                     await chatRef.current.sendMessage({
                         message: [{ functionResponse: { name: 'showExperienceTable', id: call.id, response: { result: "Table shown." } } }]
                     });

                } else if (call.name === 'completeOnboardingCollection') {
                    if (user) {
                        await updateDoc(doc(db, 'users', user.uid), {
                            isOnboardingFinished: true
                        });
                    }

                    const toolResult = await chatRef.current.sendMessage({
                        message: [{ functionResponse: { name: 'completeOnboardingCollection', id: call.id, response: { result: "Onboarding completed. User unlocked." } } }]
                    });

                    if (toolResult.text) {
                        await persistMessage(toolResult.text, 'ai', activeSessionId);
                    }
                
                } else if (call.name === 'saveExperienceAnalysis') {
                    if (lastSavedExperienceId) {
                        const { skills, jobs, nlpUnits } = args;
                        onUpdateExperience(lastSavedExperienceId, { 
                            skills: skills as string[], 
                            jobs: jobs as string[], 
                            nlpUnits: nlpUnits as any 
                        });
                    }

                    await chatRef.current.sendMessage({
                        message: [{ functionResponse: { name: 'saveExperienceAnalysis', id: call.id, response: { result: "Analysis saved successfully." } } }]
                    });
                
                } else if (call.name === 'showJobFitDashboard') {
                     const analysisData = args as unknown as JobFitAnalysis;
                     
                     const aiText = `${analysisData.targetJob} 직무에 대한 분석 결과입니다.`;
                     await persistMessage(aiText, 'ai', activeSessionId);
                     
                     addAiMessage(aiText, <JobFitAnalysisView data={analysisData} />);

                     if (onJobFitAnalysis) {
                         onJobFitAnalysis(analysisData);
                     }

                     const toolResult = await chatRef.current.sendMessage({
                         message: [{ functionResponse: { name: 'showJobFitDashboard', id: call.id, response: { result: "Dashboard shown. Proceed to Deep Dive (Role 1)." } } }]
                     });
                     
                     if (toolResult.text) {
                         await persistMessage(toolResult.text, 'ai', activeSessionId);
                     }
                }

            } else {
                if (responseText) {
                    await persistMessage(responseText, 'ai', activeSessionId);
                }
            }

        } catch (error: any) {
            console.error("Chat Error:", error);
            let errorMessage = "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            addAiMessage(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        handleSendMessage(suggestion);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleConfirmSave = useCallback(async (request: ConfirmationRequest) => {
        setConfirmationRequest(null);
        setIsLoading(true);

        setMessages(prev => prev.map(m => m.component && (m.component as any).props.onConfirm.name === request.toolName ? { ...m, component: undefined } : m));
        
        const activeSessionId = sessionId || await ensureSession();
        await persistMessage("네, 저장해주세요.", 'user', activeSessionId);

        try {
            if (request.toolName === 'saveFinalizedStory' && request.rawData) {
                const data = request.rawData;
                const starData = data.star_json || {};
                
                const baseExperience = experiences.find(exp => exp.activity_name === data.activity_name);
                
                const newStory: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'> = {
                    activity_name: data.activity_name || "새로운 스토리",
                    activity_date: baseExperience?.activity_date || new Date().toISOString().split('T')[0],
                    activity_type: baseExperience?.activity_type || '스토리',
                    type: 'story',
                    story_title: data.story_title,
                    story_summary: data.star_text_short, 
                    situation: starData.situation,
                    task: starData.task,
                    action: starData.action,
                    result_quantitative: starData.result,
                    result_qualitative: `Learning: ${starData.learning}`, 
                    learning: starData.learning,
                    core_competency: Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords,
                    job_alignment: '미분류',
                    what: baseExperience?.what || '', when: '', where: '', who: '', why: data.task, how: starData.action, result_achievement: starData.result, key_insight: starData.learning,
                    detailed_content: data.star_text_long
                };
                
                const newId = await onAddExperience(newStory);
                if (newId) setLastSavedExperienceId(newId);

                if (!chatRef.current) throw new Error("Chat not initialized");
                
                const result = await chatRef.current.sendMessage({
                    message: [{ functionResponse: { name: 'saveFinalizedStory', id: request.id, response: { result: "Story saved. Proceed to ROLE 3: Automated Analysis." } } }]
                });
                
                if (result.functionCalls && result.functionCalls.length > 0) {
                     const call = result.functionCalls[0];
                     if (call.name === 'saveExperienceAnalysis') {
                         const { skills, jobs, nlpUnits } = call.args;
                         if (newId) {
                            onUpdateExperience(newId, { 
                                skills: skills as string[], 
                                jobs: jobs as string[], 
                                nlpUnits: nlpUnits as any 
                            });
                         }
                         await chatRef.current.sendMessage({
                             message: [{ functionResponse: { name: 'saveExperienceAnalysis', id: call.id, response: { result: "Analysis saved." } } }]
                         });
                     }
                }
                if (result.text) {
                    await persistMessage(result.text, 'ai', activeSessionId);
                }

            } else if (request.toolName === 'requestToSaveExperience' && request.rawData) {
                 const data = request.rawData;
                 const actionsStr = Array.isArray(data.actions) ? data.actions.join('\n') : data.actions;
                 
                 const structuredContent = `[Situation]\n${data.situation}\n\n[Task]\n${data.task}\n\n[Actions]\n${actionsStr}\n\n[Result]\n${data.result}\n\n[Learning]\n${data.learning}`;

                 const newExperience: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'> = {
                    type: 'basic', 
                    activity_date: data.period, 
                    activity_type: data.category,
                    activity_name: data.activity_name, 
                    story_summary: data.result || "경험 추출 완료",
                    result_achievement: data.result, 
                    key_insight: data.learning,
                    detailed_content: structuredContent,
                    what: data.activity_name, when: data.period, where: '', who: '', why: data.task, how: actionsStr,
                    story_title: '', core_competency: '', job_alignment: '', situation: '', task: '', action: '', result_quantitative: '', result_qualitative: '', learning: '',
                };
                await onAddExperience(newExperience);

                 if (!chatRef.current) throw new Error("Chat not initialized");
                 const result = await chatRef.current.sendMessage({
                    message: [{ functionResponse: { name: 'requestToSaveExperience', id: request.id, response: { result: "Experience facts saved." } } }]
                });
                await persistMessage(result.text, 'ai', activeSessionId);
            }

        } catch (error) {
            console.error("Save confirm error:", error);
            addAiMessage("저장 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [experiences, sessionId, user.uid, onAddExperience, onUpdateExperience, ensureSession]);

    const handleCancelSave = useCallback(async (request: ConfirmationRequest) => {
        setConfirmationRequest(null);
        setIsLoading(true);

        setMessages(prev => prev.map(m => m.component && (m.component as any).props.onConfirm.name === request.toolName ? { ...m, component: undefined } : m));
        
        const activeSessionId = sessionId || await ensureSession();
        await persistMessage("아니요, 수정할게요.", 'user', activeSessionId);

        try {
            if (!chatRef.current) throw new Error("Chat not initialized");
            
            const result = await chatRef.current.sendMessage({
                 message: [{ functionResponse: { name: request.toolName, id: request.id, response: { result: "User cancelled save. Ask for corrections." } } }]
            });
            await persistMessage(result.text, 'ai', activeSessionId);
        } catch(e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, ensureSession]);

    if (viewMode === 'landing') {
        return (
            <div className="flex flex-col h-full items-center justify-center p-8 bg-slate-50 animate-fade-in text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white z-0"></div>
                
                <div className="relative z-10 max-w-lg">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-8 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                        <span className="text-4xl">🚀</span>
                    </div>
                    
                    <h1 className="text-3xl font-bold text-slate-800 mb-4 tracking-tight">
                        안녕하세요, <span className="text-indigo-600">{userProfile?.name || '사용자'}</span>님!
                    </h1>
                    
                    <p className="text-slate-600 text-lg mb-10 leading-relaxed">
                        오늘은 어떤 이야기를 나눠볼까요?<br />
                        작은 경험도 모이면 훌륭한 커리어가 됩니다.
                    </p>

                    <button 
                        onClick={() => setViewMode('chat')}
                        className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 mx-auto"
                    >
                        <span>대화 시작하기</span>
                        <ArrowLeftIcon className="w-5 h-5 rotate-180" />
                    </button>
                    
                    <div className="mt-12 grid grid-cols-2 gap-4 text-left">
                        <div className="bg-white/60 p-4 rounded-2xl border border-indigo-50 backdrop-blur-sm">
                            <span className="text-2xl mb-2 block">📝</span>
                            <h3 className="font-bold text-slate-700">기록하기</h3>
                            <p className="text-xs text-slate-500">오늘의 활동과 배운 점을<br/>가볍게 남겨보세요.</p>
                        </div>
                        <div className="bg-white/60 p-4 rounded-2xl border border-indigo-50 backdrop-blur-sm">
                            <span className="text-2xl mb-2 block">💎</span>
                            <h3 className="font-bold text-slate-700">발견하기</h3>
                            <p className="text-xs text-slate-500">대화 속에서 나의 강점과<br/>핵심 역량을 찾아드려요.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <VoiceCallOverlay 
                isOpen={isVoiceCallOpen} 
                onClose={stopVoiceSession} 
                status={voiceCallStatus}
                transcript={voiceTranscript}
            />

            <div 
                ref={chatMessagesRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth pb-32"
            >
                {messages.map((msg) => (
                    msg.sender === 'ai' ? 
                        <AiMessage key={msg.id} msg={msg} /> : 
                        <UserMessage key={msg.id} text={msg.text} />
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse ml-14">
                        <LoadingSpinner isWhite={false} />
                        <span>생각하는 중...</span>
                    </div>
                )}
            </div>

            <QuickSuggestions />

            <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-20">
                <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
                    {/* File Attachment Button */}
                    <div className="relative">
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files) {
                                    setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                }
                            }}
                        />
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors relative"
                            title="파일 첨부"
                        >
                            <PaperclipIcon className="w-6 h-6" />
                            {attachedFiles.length > 0 && (
                                <span className="absolute top-1 right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white"></span>
                            )}
                        </button>
                    </div>

                    {/* Chat Input Area */}
                    <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all flex flex-col">
                         {/* Attachments Preview */}
                        {(attachedFiles.length > 0 || attachedUrl) && (
                            <div className="flex gap-2 p-2 border-b border-slate-200/50 overflow-x-auto">
                                {attachedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center gap-1 bg-white px-2 py-1 rounded-md text-xs border border-slate-200 text-slate-600 shadow-sm whitespace-nowrap">
                                        <span className="max-w-[100px] truncate">{file.name}</span>
                                        <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500"><XCircleIcon className="w-3 h-3"/></button>
                                    </div>
                                ))}
                                {attachedUrl && (
                                     <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md text-xs border border-slate-200 text-slate-600 shadow-sm whitespace-nowrap">
                                        <span className="max-w-[100px] truncate">LINK</span>
                                        <button onClick={() => setAttachedUrl('')} className="hover:text-red-500"><XCircleIcon className="w-3 h-3"/></button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="오늘 어떤 활동을 하셨나요?"
                            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 resize-none text-slate-800 placeholder:text-slate-400 leading-relaxed"
                            rows={1}
                        />
                    </div>

                    {/* Voice Mode Button (Live API) */}
                    <button
                        onClick={startVoiceSession}
                        className="p-3 bg-indigo-50 text-indigo-500 hover:bg-indigo-100 rounded-full transition-colors shadow-sm"
                        title="전화 모드 (Live)"
                    >
                        <PhoneIcon className="w-6 h-6" />
                    </button>

                     {/* Dictation Button */}
                    <button
                        onClick={handleToggleListen}
                         className={`p-3 rounded-full transition-all ${
                            isListeningForText 
                                ? 'bg-red-500 text-white animate-pulse shadow-lg ring-4 ring-red-200' 
                                : 'bg-slate-100 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'
                        }`}
                        title="음성 받아쓰기"
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                    </button>

                    {/* Send Button */}
                    <button
                        onClick={() => handleSendMessage()}
                        disabled={!inputValue.trim() && attachedFiles.length === 0 && !attachedUrl || isLoading}
                        className="p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                        {isLoading ? <LoadingSpinner /> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatTab;
