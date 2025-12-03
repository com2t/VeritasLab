
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob, Content, Chat, FunctionDeclaration, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { ChatMessage, Experience, UserProfile, User, JobFitAnalysis, CalendarEvent } from '../types';
import { LoadingSpinner, PaperclipIcon, XCircleIcon, PhoneIcon, PaperAirplaneIcon, PhoneHangUpIcon, MicrophoneIcon, FolderIcon, ArrowLeftIcon, CalendarIcon, CheckIcon, LinkIcon, PlusIcon, PauseIcon, PlayIcon } from './icons';
import { db, collection, addDoc, query, orderBy, doc, onSnapshot, setDoc, where, getDocs, getDoc, updateDoc, deleteDoc } from '../firebase';
import { 
    requestToSaveExperience, 
    saveFinalizedStory, 
    saveExperienceAnalysis, 
    saveExperienceShell, 
    saveBulkExperiences, 
    showExperienceTable, 
    completeOnboardingCollection, 
    showJobFitDashboard, 
    offerConversationOptions, 
    updateUserJobInterest,
    retrieveDetailedExperience,
    manageCalendarEvents,
    createOnboardingSystemInstruction,
    createEmpathySystemInstruction,
    createDeepDiveSystemInstruction,
    createJobFitSystemInstruction,
    createDataManagerSystemInstruction,
    createQuickAddSystemInstruction,
    AgentType
} from '../utils/chatPrompts';
import { POINT_RULES, ALLOWED_CATEGORIES } from '../constants';

// --- Interfaces ---
interface LiveSession {
    sendRealtimeInput(input: { media: GenAIBlob }): void;
    sendToolResponse(response: { functionResponses: { id: string; name: string; response: { result: string; }; }; }): void;
    close(): void;
}

interface ChatTabProps {
    onAddExperience: (newExperienceData: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'>) => Promise<string | void>; 
    onUpdateExperience: (storyId: string, updates: Partial<Experience>) => void;
    experiences: Experience[];
    userProfile: UserProfile | null;
    sessionId: string | null;
    user: User;
    onSessionChange: (sessionId: string | null) => void;
    isOnboarding: boolean;
    onJobFitAnalysis?: (data: JobFitAnalysis) => void;
    onNavigateToData?: () => void;
    onNavigateToReport?: () => void;
    onEarnPoints: (actionType: keyof typeof POINT_RULES) => Promise<void>;
}
type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
type ViewMode = 'landing' | 'chat' | 'call';

interface ConfirmationRequest {
    id: string;
    summary: string;
    toolName: string;
    rawData: any; 
    otherResponses?: any[]; // Store responses from parallel tools
}

interface StoryLinkingRequest {
    confirmationRequest: ConfirmationRequest;
    newActivityName: string;
}

// Updated Quick Suggestions to map to the Agents
const QUICK_SUGGESTIONS = [
    "추가할 경험이 있어! ➕",          // Maps to Agent 6 (Quick Add)
    "오늘 하루 어땠냐면... (수다떨기) 🗣️", // Maps to Agent 2
    "옛날 얘기 좀 해볼까? (스토리 정리) ✍️",      // Maps to Agent 3
    "내 직무 적합도 봐줘! 📊",           // Maps to Agent 4
    "저장된 거 보여줘 📂"            // Maps to Agent 5
];

// --- Supported MIME Types for Inline Data ---
const SUPPORTED_INLINE_MIME_TYPES = [
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
    'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp'
];

// --- Helper Functions for File Processing ---
const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file'));
            }
        };
        reader.readAsDataURL(file);
    });
};

// Helper to remove ** and * from text for display
const cleanDisplayText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*/g, '').replace(/\*/g, '');
};

// Default empty experience fields
const emptyExperienceFields = {
    story_summary: '',
    result_achievement: '',
    key_insight: '',
    detailed_content: '',
    who: '',
    what: '',
    when: '',
    where: '',
    why: '',
    how: '',
    story_title: '',
    core_competency: '',
    job_alignment: '',
    situation: '',
    task: '',
    action: '',
    result_quantitative: '',
    result_qualitative: '',
    learning: '',
    tags: [],
    skills: [],
    jobs: [],
    nlpUnits: []
};

// --- AUDIO HELPERS FOR LIVE API ---
const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
};

const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// --- Live Voice Mode Component ---
const LiveVoiceMode: React.FC<{
    onClose: () => void;
    userProfile: UserProfile | null;
}> = ({ onClose, userProfile }) => {
    const [status, setStatus] = useState<VoiceState>('connecting');
    const [volume, setVolume] = useState(0); // For visualization
    
    // Refs for cleanup
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const liveSessionRef = useRef<LiveSession | null>(null);
    
    // Audio Output Queue
    const nextStartTimeRef = useRef<number>(0);
    const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);

    useEffect(() => {
        let isMounted = true;

        const initLiveSession = async () => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                
                // Initialize Audio Context
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContextClass({ sampleRate: 16000 }); // Input sample rate
                audioContextRef.current = audioCtx;

                // Get Microphone Stream
                const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                }});
                streamRef.current = stream;

                // Create Connect Promise
                const sessionPromise = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
                        },
                        systemInstruction: {
                            parts: [{ text: `You are a friendly, enthusiastic career coach friend for ${userProfile?.nickname || 'friend'}. Keep your responses concise, warm, and natural (banmal). Use short sentences suitable for voice conversation. Do NOT read out lists or long data.` }]
                        }
                    },
                    callbacks: {
                        onopen: async () => {
                            if (!isMounted) return;
                            console.log("Live Session Connected");
                            setStatus('listening');
                            
                            // Setup Input Processing
                            const source = audioCtx.createMediaStreamSource(stream);
                            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                            
                            source.connect(processor);
                            processor.connect(audioCtx.destination);
                            
                            sourceRef.current = source;
                            processorRef.current = processor;

                            processor.onaudioprocess = (e) => {
                                const inputData = e.inputBuffer.getChannelData(0);
                                
                                // Visualization Volume
                                let sum = 0;
                                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                                const rms = Math.sqrt(sum / inputData.length);
                                setVolume(Math.min(1, rms * 5)); // Amplify for visual

                                // Convert to 16-bit PCM for Gemini
                                const pcmData = floatTo16BitPCM(inputData);
                                const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
                                
                                sessionPromise.then(session => {
                                    session.sendRealtimeInput({
                                        media: {
                                            mimeType: 'audio/pcm;rate=16000',
                                            data: base64Data
                                        }
                                    });
                                });
                            };
                        },
                        onmessage: async (msg: LiveServerMessage) => {
                            if (!isMounted) return;
                            
                            // Handle Audio Output
                            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                            if (audioData) {
                                setStatus('speaking');
                                const audioBytes = base64ToUint8Array(audioData);
                                // Decode raw PCM (24000Hz default from Gemini Live)
                                const audioBuffer = await decodeAudioData(audioBytes, audioCtx);
                                playAudio(audioBuffer, audioCtx);
                            }

                            if (msg.serverContent?.turnComplete) {
                                setStatus('listening');
                            }
                        },
                        onclose: () => {
                            console.log("Live Session Closed");
                            if (isMounted) onClose();
                        },
                        onerror: (err) => {
                            console.error("Live Session Error", err);
                            setStatus('error');
                        }
                    }
                });

                liveSessionRef.current = await sessionPromise;

            } catch (error) {
                console.error("Failed to initialize Live Session", error);
                setStatus('error');
            }
        };

        initLiveSession();

        return () => {
            isMounted = false;
            cleanup();
        };
    }, [onClose, userProfile]);

    const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
        // Raw PCM to AudioBuffer
        // Gemini returns 24000Hz, 1 channel, 16-bit PCM
        const sampleRate = 24000;
        const numChannels = 1;
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length;
        
        const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        return audioBuffer;
    };

    const playAudio = (buffer: AudioBuffer, ctx: AudioContext) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        const currentTime = ctx.currentTime;
        // Schedule next chunk
        const startTime = Math.max(currentTime, nextStartTimeRef.current);
        source.start(startTime);
        nextStartTimeRef.current = startTime + buffer.duration;
        
        audioQueueRef.current.push(source);
        source.onended = () => {
            audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
            if (audioQueueRef.current.length === 0) {
                setStatus(prev => prev === 'speaking' ? 'listening' : prev);
            }
        };
    };

    const cleanup = () => {
        if (liveSessionRef.current) {
            try { liveSessionRef.current.close(); } catch(e) {}
            liveSessionRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (processorRef.current) {
            try { processorRef.current.disconnect(); } catch(e) {}
            processorRef.current = null;
        }
        if (sourceRef.current) {
            try { sourceRef.current.disconnect(); } catch(e) {}
            sourceRef.current = null;
        }
        // SAFELY close AudioContext
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(e => console.warn("Failed to close AudioContext", e));
        }
        
        audioQueueRef.current.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        audioQueueRef.current = [];
    };

    const handleClose = () => {
        cleanup();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-900 via-slate-900 to-black flex flex-col items-center justify-center text-white animate-fade-in">
            <button 
                onClick={handleClose} 
                className="absolute top-6 right-6 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
                <XCircleIcon className="w-8 h-8" />
            </button>

            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md p-8 text-center">
                <div className="relative mb-12">
                    {/* Visualizer Circles */}
                    <div className={`absolute inset-0 bg-indigo-500/30 rounded-full blur-2xl transition-all duration-100 ease-out`} 
                         style={{ transform: `scale(${1 + volume * 2})` }}></div>
                    <div className={`absolute inset-0 bg-indigo-400/20 rounded-full blur-xl transition-all duration-100 ease-out`} 
                         style={{ transform: `scale(${1 + volume * 1.5})` }}></div>
                    
                    <div className="relative z-10 w-32 h-32 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)]">
                        <MicrophoneIcon className="w-12 h-12 text-white/90" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-4">
                    {status === 'connecting' && "연결 중..."}
                    {status === 'listening' && "듣고 있어요..."}
                    {status === 'speaking' && "대답하는 중..."}
                    {status === 'error' && "오류가 발생했습니다"}
                </h2>
                
                <p className="text-slate-300 text-sm mb-12 max-w-xs leading-relaxed">
                    AI 코치와 실시간으로 대화하며<br/>경험을 더 자연스럽게 정리해보세요.
                </p>

                <div className="flex items-center gap-6">
                    <button 
                        onClick={handleClose}
                        className="w-16 h-16 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
                    >
                        <PhoneHangUpIcon className="w-8 h-8 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- ChatTab Component ---
const ChatTab: React.FC<ChatTabProps> = ({ 
    onAddExperience, 
    onUpdateExperience,
    experiences, 
    userProfile, 
    sessionId, 
    user, 
    onSessionChange,
    isOnboarding,
    onJobFitAnalysis,
    onNavigateToData,
    onNavigateToReport,
    onEarnPoints
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
    const [storyLinkingRequest, setStoryLinkingRequest] = useState<StoryLinkingRequest | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('chat');
    const [showOptions, setShowOptions] = useState<{message: string, options: string[]} | null>(null);
    
    // New State for Tool Processing (Debouncing)
    const [isToolProcessing, setIsToolProcessing] = useState(false);
    
    // Voice Mode State
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    
    // Calendar Context State
    const [calendarContext, setCalendarContext] = useState<string>("");

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const chatRef = useRef<Chat | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const [pendingAttachment, setPendingAttachment] = useState<{
        file: File;
        base64: string;
        mimeType: string;
    } | null>(null);

    // Fetch Calendar Context on Mount/Update
    useEffect(() => {
        const fetchCalendarContext = async () => {
            if (!user) return;
            const today = new Date();
            const startStr = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toISOString().split('T')[0]; // Yesterday
            const endStr = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().split('T')[0]; // +7 Days

            try {
                const eventsRef = collection(db, 'users', user.uid, 'calendarEvents');
                const q = query(eventsRef, where('date', '>=', startStr), where('date', '<=', endStr));
                const snapshot = await getDocs(q);
                
                const events = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CalendarEvent));
                
                if (events.length > 0) {
                    const ctxString = events.map(e => {
                        const isPast = new Date(e.date) < new Date(new Date().setHours(0,0,0,0));
                        const isToday = e.date === new Date().toISOString().split('T')[0];
                        const status = isToday ? "[TODAY]" : isPast ? "[PAST]" : "[UPCOMING]";
                        return `- [ID: ${e.id}] ${status} ${e.date} (${e.category}): ${e.title} [Type: ${e.type}]`;
                    }).join('\n');
                    setCalendarContext(`[User's Recent/Upcoming Schedule]\n${ctxString}`);
                } else {
                    setCalendarContext("");
                }
            } catch (e) {
                console.error("Failed to fetch calendar context", e);
            }
        };
        fetchCalendarContext();
    }, [user, messages.length]);

    // Firestore Integration: Load Messages
    useEffect(() => {
        if (!sessionId || !user) return;

        const messagesRef = collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ChatMessage));
            setMessages(loadedMessages);
        });

        // Update last opened time
        const sessionRef = doc(db, 'users', user.uid, 'chatSessions', sessionId);
        updateDoc(sessionRef, { updatedAt: new Date().toISOString() }).catch(() => {});

        return () => unsubscribe();
    }, [sessionId, user]);

    // Initial Greeting Effect
    useEffect(() => {
        const sendInitialGreeting = async () => {
            if (!user || !sessionId) return;

            try {
                const messagesRef = collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages');
                const snapshot = await getDocs(messagesRef);
                
                if (snapshot.empty) {
                    let initialText = "";
                    if (isOnboarding) {
                        initialText = "반가워! 👋 나는 너의 경험 정리를 도와줄 AI 코치야.\n\n먼저 너에 대해 조금 더 알고 싶어. 동아리나 프로젝트 같은 활동 경험이 있으면 하나씩 물어볼게. \n\n첫 번째로, **동아리**나 **학회** 활동 경험이 있어? 있다면 **활동명**과 **시기(언제)**를 알려줘!";
                    } else {
                        const name = userProfile?.nickname || userProfile?.name || '친구';
                        initialText = `안녕 ${name}! 👋\n오늘 하루는 어땠어? 특별한 일이 있었거나 기록하고 싶은 경험이 있다면 언제든 말해줘!`;
                    }

                    await addDoc(messagesRef, {
                        text: initialText,
                        sender: 'ai',
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error("Error sending initial greeting:", error);
            }
        };

        sendInitialGreeting();
    }, [sessionId, user, isOnboarding]);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const initializeChat = () => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                
        let systemInstruction = "";
        let tools: FunctionDeclaration[] = [];

        if (isOnboarding) {
            systemInstruction = createOnboardingSystemInstruction(userProfile, []);
            tools = [saveExperienceShell, completeOnboardingCollection];
        } else {
            const contextExps = experiences.map(e => 
                `- [ID: ${e.id}] ${e.activity_name} (${e.activity_date}) / Type: ${e.activity_type} / (Status: ${e.type === 'story' ? 'Has Story' : 'Basic'})`
            );
            systemInstruction = createDeepDiveSystemInstruction(userProfile, contextExps, calendarContext);
            tools = [
                requestToSaveExperience, 
                saveFinalizedStory, 
                saveExperienceShell, 
                showExperienceTable, 
                showJobFitDashboard, 
                retrieveDetailedExperience, 
                manageCalendarEvents, 
                offerConversationOptions
            ];
        }

        // Configure Safety Settings to be permissive for personal conversations
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // Robust history creation: Filter out messages without text to avoid API errors
        const history = messages
            .filter(m => m.text && m.text.trim() !== '')
            .map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));

        chatRef.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: {
                systemInstruction,
                tools: tools.map(tool => ({ functionDeclarations: [tool] })),
                temperature: 0.4,
                safetySettings: safetySettings
            }
        });
    }

    const handleConfirmTool = async () => {
        if (!confirmationRequest || isToolProcessing) return; 
        
        setIsToolProcessing(true);

        try {
            let finalData = confirmationRequest.rawData;
            let toolName = confirmationRequest.toolName;
            
            let resultMessage = "완료되었습니다.";
            let resultData: any = { result: "success" };

            // Execute the Tool Logic
            if (toolName === 'requestToSaveExperience') {
                await onAddExperience({
                    ...emptyExperienceFields,
                    ...finalData,
                    type: 'basic',
                    story_summary: finalData.summary,
                    detailed_content: `[STAR Details]\nS: ${finalData.situation}\nT: ${finalData.task}\nA: ${finalData.actions.join(', ')}\nR: ${finalData.result}\nL: ${finalData.learning}`
                });
                resultMessage = `✅ '${finalData.activity_name}' 활동이 저장되었습니다.`;
                onEarnPoints('CREATE_EXP');
            
            } else if (toolName === 'saveFinalizedStory') {
                await onAddExperience({
                    ...emptyExperienceFields,
                    ...finalData,
                    type: 'story', 
                    core_competency: finalData.core_competency,
                    job_alignment: finalData.job_alignment
                });
                resultMessage = `✨ '${finalData.story_title}' 스토리가 저장되었습니다!`;
                onEarnPoints('CREATE_STORY');

            } else if (toolName === 'saveExperienceShell') {
                await onAddExperience({
                    ...emptyExperienceFields,
                    activity_name: finalData.activity_name,
                    activity_type: finalData.activity_type,
                    activity_date: finalData.activity_date,
                    type: 'basic',
                    detailed_content: '' 
                });
                resultMessage = `📂 '${finalData.activity_name}' 기본 정보가 저장되었습니다.`;
                onEarnPoints('CREATE_EXP');

            } else if (toolName === 'manageCalendarEvents') {
                const op = finalData.operation;
                const evts = Array.isArray(finalData.events) ? finalData.events : [finalData.events];
                
                for (const evt of evts) {
                    if (op === 'ADD') {
                        await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), {
                            ...evt,
                            createdAt: new Date().toISOString()
                        });
                    } else if (op === 'UPDATE' && evt.id) {
                        const ref = doc(db, 'users', user.uid, 'calendarEvents', evt.id);
                        const { id, ...updateData } = evt; 
                        await updateDoc(ref, updateData);
                    } else if (op === 'DELETE' && evt.id) {
                        await deleteDoc(doc(db, 'users', user.uid, 'calendarEvents', evt.id));
                    }
                }
                resultMessage = op === 'ADD' ? "일정을 등록했습니다." : op === 'UPDATE' ? "일정을 업데이트했습니다." : "일정을 삭제했습니다.";
            }

            // --- Send Tool Response back to Model ---
            let isFreshSession = false;
            
            if (!chatRef.current) {
                initializeChat();
                isFreshSession = true;
            }

            if (chatRef.current) {
                try {
                    if (isFreshSession) {
                        await chatRef.current.sendMessage({ 
                            message: `[System] The tool '${toolName}' was successfully executed by the user's confirmation. Result: ${JSON.stringify(resultData)}` 
                        });
                         setMessages(prev => [
                            ...prev,
                            { id: `sys-${Date.now()}`, text: resultMessage, sender: 'ai', component: <CheckIcon className="w-5 h-5 text-green-500" /> }
                        ]);
                    } else {
                        const toolResponseParts: any[] = [
                            {
                                functionResponse: {
                                    name: toolName,
                                    response: resultData
                                }
                            }
                        ];
                        
                        if (confirmationRequest.otherResponses) {
                            confirmationRequest.otherResponses.forEach(r => {
                                toolResponseParts.push({
                                    functionResponse: {
                                        name: r.name,
                                        response: r.response
                                    }
                                });
                            });
                        }

                        const nextResponse = await chatRef.current.sendMessage({ message: toolResponseParts });
                        const nextText = nextResponse.text;
                        
                        setMessages(prev => [
                            ...prev,
                            { id: `sys-${Date.now()}`, text: resultMessage, sender: 'ai', component: <CheckIcon className="w-5 h-5 text-green-500" /> }, 
                            { id: `ai-${Date.now()+1}`, text: nextText, sender: 'ai' }
                        ]);
                        
                        if (sessionId && nextText) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: nextText,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }
                        
                        const calls = nextResponse.functionCalls;
                        if (calls && calls.length > 0) {
                            const optCall = calls.find(c => c.name === 'offerConversationOptions');
                            if (optCall) {
                                setShowOptions(optCall.args as any);
                            }
                        }
                    }
                } catch (chatError) {
                    console.warn("AI context update failed, forcing reset:", chatError);
                    chatRef.current = null; // Reset session on error to self-heal
                     setMessages(prev => [
                        ...prev,
                        { id: `sys-${Date.now()}`, text: resultMessage, sender: 'ai', component: <CheckIcon className="w-5 h-5 text-green-500" /> }
                    ]);
                }
            }

        } catch (error) {
            console.error("Tool execution failed:", error);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, text: "작업 처리 중 오류가 발생했습니다.", sender: 'ai' }]);
            chatRef.current = null; // Reset session
        } finally {
            setIsToolProcessing(false); 
            setConfirmationRequest(null);
            setStoryLinkingRequest(null);
        }
    };

    const handleSendMessage = async (text: string, attachment?: { file: File, base64: string, mimeType: string }) => {
        if ((!text.trim() && !attachment) || !user) return;

        // Robust Session Reset on Tool Interruption
        if (confirmationRequest) {
            setConfirmationRequest(null);
            chatRef.current = null; 
        }

        const newUserMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            text: text,
            sender: 'user',
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInput('');
        setPendingAttachment(null);
        setLoading(true);
        setShowOptions(null);

        if (sessionId) {
            try {
                await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                    text: text,
                    sender: 'user',
                    createdAt: new Date().toISOString()
                });
            } catch (e) {
                console.error("Failed to save user message", e);
            }
        }

        try {
            if (!chatRef.current) {
                initializeChat();
            }

            const parts: (string | { inlineData: { mimeType: string; data: string } } | { text: string })[] = [{ text }];
            
            if (attachment) {
                parts.push({
                    inlineData: {
                        mimeType: attachment.mimeType,
                        data: attachment.base64
                    }
                });
            }

            const result = await chatRef.current!.sendMessage({ message: parts });
            const response = result;
            const textResponse = response.text;
            
            const functionCalls = response.functionCalls;
            
            if (functionCalls && functionCalls.length > 0) {
                const toolCall = functionCalls[0];
                const toolName = toolCall.name;
                const args = toolCall.args;

                if (toolName === 'retrieveDetailedExperience') {
                    const query = (args as any).query.toLowerCase();
                    const found = experiences.filter(e => 
                        e.activity_name?.toLowerCase().includes(query) || 
                        e.detailed_content?.toLowerCase().includes(query)
                    ).slice(0, 3);
                    
                    const searchResult = { 
                        found_count: found.length,
                        results: found.map(e => ({ id: e.id, name: e.activity_name, content: e.detailed_content?.substring(0, 100) }))
                    };

                    const nextResp = await chatRef.current!.sendMessage({
                        message: [{
                            functionResponse: {
                                name: toolName,
                                response: searchResult
                            }
                        }]
                    });
                    
                    const nextText = nextResp.text;
                    setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: nextText, sender: 'ai' }]);
                    
                    if (sessionId && nextText) {
                        await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                            text: nextText,
                            sender: 'ai',
                            createdAt: new Date().toISOString()
                        });
                    }
                
                } else if (toolName === 'offerConversationOptions') {
                    setShowOptions(args as any);
                    if (textResponse) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: textResponse, sender: 'ai' }]);
                        if (sessionId) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: textResponse,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                
                } else if (toolName === 'saveExperienceShell' || toolName === 'completeOnboardingCollection') {
                    
                    if (toolName === 'saveExperienceShell') {
                        const finalData = args as any;
                        await onAddExperience({
                            ...emptyExperienceFields,
                            activity_name: finalData.activity_name,
                            activity_type: finalData.activity_type,
                            activity_date: finalData.activity_date,
                            type: 'basic',
                            detailed_content: ''
                        });
                        
                        let nextText = "";
                        try {
                            const nextResp = await chatRef.current!.sendMessage({
                                message: [{
                                    functionResponse: {
                                        name: toolName,
                                        response: { 
                                            result: "success", 
                                            saved_item: finalData.activity_name,
                                            system_note: "Saved successfully. NOW ASK FOR THE NEXT CATEGORY immediately." 
                                        }
                                    }
                                }]
                            });
                            nextText = nextResp.text || ""; // Ensure it's string
                        } catch (toolError) {
                            console.error("Failed to get AI response after save:", toolError);
                            // Fallback triggers below if nextText is empty
                            chatRef.current = null; 
                        }
                        
                        // FALLBACK IF AI RETURNS EMPTY TEXT OR ERROR
                        if (!nextText || nextText.trim() === '') {
                            // Use ALLOWED_CATEGORIES to determine next step dynamically
                            const currentCat = finalData.activity_type;
                            const idx = ALLOWED_CATEGORIES.indexOf(currentCat);
                            const nextCat = idx >= 0 && idx < ALLOWED_CATEGORIES.length - 1 
                                ? ALLOWED_CATEGORIES[idx + 1] 
                                : '기타';
                            
                            // Specific message if we just finished 'Other' (last item)
                            if (idx === ALLOWED_CATEGORIES.length - 1 || currentCat === '기타') {
                                nextText = "모든 항목을 확인했어! 수고했어. 이제 완료 처리를 할게.";
                            } else {
                                nextText = `오케이 저장했어! 📂\n다음으로 **${nextCat}** 경험은 있어?`;
                            }
                        }
                        
                        setMessages(prev => [
                            ...prev, 
                            { id: `sys-${Date.now()}`, text: `✅ 저장됨: ${finalData.activity_name} (${finalData.activity_date || '날짜 미상'})`, sender: 'ai', component: <CheckIcon className="w-4 h-4 text-green-500" /> },
                            { id: `ai-${Date.now()+1}`, text: nextText, sender: 'ai' }
                        ]);

                        if (sessionId) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: nextText,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }

                    } else if (toolName === 'completeOnboardingCollection') {
                        const userDocRef = doc(db, 'users', user.uid);
                        await setDoc(userDocRef, { isOnboardingFinished: true }, { merge: true });
                        
                        let nextText = "";
                        try {
                            const nextResp = await chatRef.current!.sendMessage({
                                message: [{
                                    functionResponse: {
                                        name: toolName,
                                        response: { result: "success" }
                                    }
                                }]
                            });
                            nextText = nextResp.text || "";
                        } catch (e) {
                            nextText = "모든 기초 데이터 수집이 완료되었습니다! 고생 많으셨어요. 🎉 이제 본격적으로 경험을 정리해보거나 대화를 나눠봐요.";
                        }

                        if (!nextText) nextText = "모든 기초 데이터 수집이 완료되었습니다! 고생 많으셨어요. 🎉";

                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: nextText, sender: 'ai' }]);
                        
                        if (sessionId && nextText) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: nextText,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }

                } else if (toolName === 'manageCalendarEvents') {
                    const op = (args as any).operation;
                    const evts = Array.isArray((args as any).events) ? (args as any).events : [(args as any).events];
                    const firstEvent = evts[0];
                    let summary = "일정 관리 작업을 수행합니다.";
                    if (op === 'ADD' && firstEvent) {
                        summary = `📅 캘린더 등록: ${firstEvent.date} ${firstEvent.title}`;
                    } else if (op === 'UPDATE') {
                        summary = `📅 캘린더 수정: ${firstEvent?.title || '일정'}`;
                    } else if (op === 'DELETE') {
                        summary = `🗑️ 캘린더 삭제: ${firstEvent?.title || '일정'}`;
                    }

                    setConfirmationRequest({
                        id: `confirm-${Date.now()}`,
                        summary: summary,
                        toolName: toolName,
                        rawData: args,
                        otherResponses: functionCalls.slice(1).map(fc => ({ name: fc.name, response: { result: "skipped" } }))
                    });
                    if (textResponse) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: textResponse, sender: 'ai' }]);
                        if (sessionId) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: textResponse,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }

                } else {
                    setConfirmationRequest({
                        id: `confirm-${Date.now()}`,
                        summary: "AI가 작업을 수행하려고 합니다.",
                        toolName: toolName,
                        rawData: args,
                        otherResponses: functionCalls.slice(1).map(fc => ({ name: fc.name, response: { result: "skipped" } }))
                    });
                    if (textResponse) {
                        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: textResponse, sender: 'ai' }]);
                        if (sessionId) {
                            await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                                text: textResponse,
                                sender: 'ai',
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            } else {
                setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: textResponse, sender: 'ai' }]);
                if (sessionId && textResponse) {
                    await addDoc(collection(db, 'users', user.uid, 'chatSessions', sessionId, 'messages'), {
                        text: textResponse,
                        sender: 'ai',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            if (isOnboarding) return;
            const today = new Date().toISOString().split('T')[0];
            if (userProfile?.lastChatDate !== today) {
                onEarnPoints('DAILY_CHAT');
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, text: "죄송해요, 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", sender: 'ai' }]);
            chatRef.current = null; // Force reset session to recover from error state
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const base64 = await readFileAsBase64(file);
                setPendingAttachment({
                    file,
                    base64,
                    mimeType: file.type
                });
            } catch (error) {
                console.error("File reading failed", error);
                alert("파일을 읽는 중 오류가 발생했습니다.");
            }
        }
    };

    const handleOptionClick = (option: string) => {
        handleSendMessage(option);
    };

    // --- Render ---
    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Live Voice Mode Overlay */}
            {isVoiceMode && (
                <LiveVoiceMode 
                    onClose={() => setIsVoiceMode(false)}
                    userProfile={userProfile}
                />
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32 scroll-smooth">
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 mt-20">
                        <p>대화를 시작해보세요!</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm
                            ${msg.sender === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}
                        `}>
                            <div className="whitespace-pre-wrap">{cleanDisplayText(msg.text)}</div>
                            {msg.component && <div className="mt-2">{msg.component}</div>}
                        </div>
                    </div>
                ))}
                
                {/* Options (Chips) */}
                {showOptions && !loading && (
                    <div className="flex flex-wrap gap-2 justify-start ml-2 animate-fade-in-up">
                        {showOptions.options.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => handleOptionClick(opt)}
                                className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-full text-sm font-medium hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                            <LoadingSpinner isWhite={false} />
                        </div>
                    </div>
                )}
                
                {/* Confirmation Card (Tool Call) */}
                {confirmationRequest && (
                    <div className="flex justify-start w-full animate-slide-in-up">
                        <div className="bg-white rounded-xl border-l-4 border-indigo-500 shadow-md p-4 w-full max-w-sm ml-2">
                            <h4 className="font-bold text-slate-800 mb-1">
                                {confirmationRequest.toolName === 'saveFinalizedStory' ? '스토리 저장' : 
                                 confirmationRequest.toolName === 'saveExperienceShell' ? '경험 기본 정보 저장' : 
                                 confirmationRequest.toolName === 'manageCalendarEvents' ? '캘린더 작업' : '확인 필요'}
                            </h4>
                            <p className="text-sm text-slate-600 mb-3">{confirmationRequest.summary}</p>
                            <div className="flex gap-2 justify-end">
                                <button 
                                    onClick={() => setConfirmationRequest(null)}
                                    disabled={isToolProcessing}
                                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded disabled:opacity-50"
                                >
                                    취소
                                </button>
                                <button 
                                    onClick={handleConfirmTool}
                                    disabled={isToolProcessing}
                                    className={`px-4 py-1.5 text-xs font-bold text-white rounded shadow-sm flex items-center gap-2 ${
                                        isToolProcessing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {isToolProcessing ? <><LoadingSpinner isWhite={true} /> 처리 중...</> : '실행 (Yes)'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0 z-20">
                {messages.length < 2 && (
                    <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
                        {QUICK_SUGGESTIONS.map((s, i) => (
                            <button 
                                key={i} 
                                onClick={() => handleSendMessage(s)}
                                className="whitespace-nowrap px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {pendingAttachment && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-indigo-50 rounded-lg max-w-fit">
                        <span className="text-xs text-indigo-700 font-bold truncate max-w-[200px]">
                            {pendingAttachment.file.name}
                        </span>
                        <button onClick={() => setPendingAttachment(null)} className="text-indigo-400 hover:text-indigo-600">
                            <XCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex items-end gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                        <PaperclipIcon className="w-5 h-5" />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect}
                        accept={SUPPORTED_INLINE_MIME_TYPES.join(',')}
                    />
                    
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(input, pendingAttachment || undefined);
                            }
                        }}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400 resize-none py-2.5 max-h-32 text-sm"
                        rows={1}
                    />
                    
                    <button
                        onClick={() => setIsVoiceMode(true)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="음성 대화 (Live)"
                    >
                        <MicrophoneIcon className="w-5 h-5" />
                    </button>

                    <button 
                        onClick={() => handleSendMessage(input, pendingAttachment || undefined)}
                        disabled={!input.trim() && !pendingAttachment}
                        className="p-2 bg-indigo-500 text-white rounded-xl shadow-sm hover:bg-indigo-600 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatTab;
