
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Experience, ReportData, PanelType, User, UserProfile, JobFitAnalysis, AlarmSettings } from './types';
import Header from './components/Header';
import ChatTab from './components/ChatTab';
import PersonalArchive from './components/PersonalArchive';
import DetailModal from './components/DetailModal';
import Sidebar from './components/Sidebar';
import AlarmModal from './components/AlarmModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import LevelUpModal from './components/LevelUpModal';
import TrashModal from './components/TrashModal';
import ReportModal from './components/ReportModal';
import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  auth,
  onAuthStateChanged,
  signOut,
  getDocs,
  limit,
  startAfter,
  updateDoc,
  writeBatch,
  setDoc
} from './firebase';
import {
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { LoadingSpinner } from './components/icons';
import SharedReportView from './components/SharedReportView';
import AppNavigator from './components/AppNavigator';
import DataViewsPanel from './components/DataViewsPanel';
import AuthScreen from './components/AuthScreen';
import { POINT_RULES, FRIENDSHIP_LEVELS, LEVEL_ZERO } from './constants';

const PAGE_SIZE = 100;

// Helper for KST Date String YYYY-MM-DD
const getKSTDateString = () => {
    const now = new Date();
    // Use toLocaleString with specific timeZone to ensure KST regardless of system time
    const kstDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true); // Added to track profile load status

  // Panel State - Default to 'chat' (Center Panel)
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loadingExperiences, setLoadingExperiences] = useState(true);

  const [selectedExperience, setSelectedExperience] =
    useState<Experience | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [urlReportId, setUrlReportId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [jobFitData, setJobFitData] = useState<JobFitAnalysis | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Chat Session & Sidebar State
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // DataViewsPanel State
  const [activeDataView, setActiveDataView] =
    useState<'list' | 'story'>('list');
  const [highlightedStoryId, setHighlightedStoryId] =
    useState<string | null>(null);

  // Pagination state
  const [lastVisibleDoc, setLastVisibleDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Level Up Logic
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{level: number, name: string} | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  // Panel Order for Sliding Effect
  const panelIndices = useMemo(() => ({ 'data': 0, 'chat': 1, 'report': 2 }), []);
  const activeIndex = panelIndices[activePanel];

  // --- ONBOARDING LOGIC ---
  const isOnboarding = useMemo(() => {
    // Wait until critical data is loaded
    if (loadingExperiences || profileLoading || !user) return false;
    
    // Strict check: Only true if explicitly false (New User who hasn't finished).
    // We enforce the full 10-step checklist to be marked complete (isOnboardingFinished = true)
    // before unlocking other features, even if they add some items along the way.
    return userProfile?.isOnboardingFinished === false;
  }, [loadingExperiences, profileLoading, user, userProfile]);

  // URL에서 공유 리포트 ID 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('reportId');
    if (reportId) {
      setUrlReportId(reportId);
    }
  }, []);

  // Request Notification Permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
  }, []);

  // 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const newSessionId = `session_${Date.now()}`;
        setCurrentSessionId(newSessionId);

        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubProfile = (await import('firebase/firestore')).onSnapshot(userDocRef, (docSnap) => {
             if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                if (data.friendshipScore === undefined) {
                    setDoc(userDocRef, {
                        friendshipScore: 0,
                        streakDays: 0,
                        lastInteractionDate: '',
                        lastChatDate: ''
                    }, { merge: true });
                }
                setUserProfile(data);
             } else {
                console.log('No such user profile!');
                setUserProfile(null);
             }
             setProfileLoading(false); // Profile is loaded
        });
      } else {
        setUserProfile(null);
        setProfileLoading(false);
        setCurrentSessionId(null);
        prevLevelRef.current = null;
        setActivePanel('chat'); // Reset to chat only on logout
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Level Up Detection Effect
  useEffect(() => {
      if (!userProfile) return;

      let currentLevel = 0;
      let currentLevelName = LEVEL_ZERO.name;

      if (userProfile.isOnboardingFinished) {
          const score = userProfile.friendshipScore || 0;
          const levelObj = FRIENDSHIP_LEVELS.find(l => score >= l.min && score <= l.max) || FRIENDSHIP_LEVELS[FRIENDSHIP_LEVELS.length - 1];
          currentLevel = levelObj.level;
          currentLevelName = levelObj.name;
      } else {
          currentLevel = 0;
          currentLevelName = LEVEL_ZERO.name;
      }

      if (prevLevelRef.current === null) {
          prevLevelRef.current = currentLevel;
          return;
      }

      if (currentLevel > prevLevelRef.current) {
          setLevelUpData({ level: currentLevel, name: currentLevelName });
          setShowLevelUp(true);
          const timer = setTimeout(() => {
              setShowLevelUp(false);
          }, 5000);
          prevLevelRef.current = currentLevel;
          return () => clearTimeout(timer);
      } else if (currentLevel < prevLevelRef.current) {
          prevLevelRef.current = currentLevel;
      } else {
          prevLevelRef.current = currentLevel;
      }

  }, [userProfile?.friendshipScore, userProfile?.isOnboardingFinished]);


  // Alarm Check Logic
  useEffect(() => {
      if (!userProfile?.alarmSettings?.isEnabled) return;

      const checkAlarm = () => {
          const settings = userProfile.alarmSettings;
          if (!settings || !settings.isEnabled) return;

          const now = new Date();
          const currentDay = now.getDay();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          const [alarmHour, alarmMinute] = settings.time.split(':').map(Number);
          
          if (settings.days.includes(currentDay) && currentHour === alarmHour && currentMinute === alarmMinute) {
              const key = `alarm_${now.toDateString()}_${alarmHour}:${alarmMinute}`;
              if (!sessionStorage.getItem(key)) {
                   sessionStorage.setItem(key, 'triggered');
                   if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("경험 스택 AI 코치", {
                            body: settings.message,
                            icon: "/vite.svg"
                        });
                   } else {
                       console.log("Alarm Triggered:", settings.message);
                   }
              }
          }
      };

      const interval = setInterval(checkAlarm, 10000);
      return () => clearInterval(interval);

  }, [userProfile?.alarmSettings]);


  const handleEarnPoints = useCallback(async (actionType: keyof typeof POINT_RULES) => {
    if (!user || !userProfile) return;

    const today = getKSTDateString();
    const userDocRef = doc(db, 'users', user.uid);
    let pointsToAdd = POINT_RULES[actionType] || 0;
    let newStreak = userProfile.streakDays || 0;
    
    if (actionType === 'DAILY_CHAT') {
        const lastInteraction = userProfile.lastInteractionDate;
        
        if (userProfile.lastChatDate === today) {
            return; 
        }

        const yesterdayDate = new Date(today);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];
        
        if (!lastInteraction) {
            newStreak = 1;
        } else {
             if (lastInteraction === yesterday) {
                 newStreak += 1;
                 if (newStreak % 7 === 0) {
                    pointsToAdd += POINT_RULES.STREAK_7_DAYS;
                    alert(`🔥 7일 연속 대화 달성! 보너스 ${POINT_RULES.STREAK_7_DAYS}점을 얻었습니다!`);
                 }
             } else if (lastInteraction !== today) {
                 newStreak = 1;
             }
        }

        await setDoc(userDocRef, {
            friendshipScore: (userProfile.friendshipScore || 0) + pointsToAdd,
            streakDays: newStreak,
            lastInteractionDate: today,
            lastChatDate: today
        }, { merge: true });
    } else {
         await setDoc(userDocRef, {
            friendshipScore: (userProfile.friendshipScore || 0) + pointsToAdd,
        }, { merge: true });
    }

  }, [user, userProfile]);

  const handleSaveAlarmSettings = async (settings: AlarmSettings) => {
      if (!user) return;
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
          alarmSettings: settings
      }, { merge: true });
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, updates, { merge: true });
  };

  // 경험 목록 페치
  const fetchExperiences = useCallback(
    async (loadMore = false) => {
      if (!user) return;

      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoadingExperiences(true);
        setExperiences([]);
      }

      try {
        const userExperiencesCol = collection(
          db,
          'users',
          user.uid,
          'experiences',
        );

        const queryConstraints: QueryConstraint[] = [
          orderBy('sequence_number', 'desc'),
          limit(PAGE_SIZE),
        ];

        if (loadMore && lastVisibleDoc) {
          queryConstraints.push(startAfter(lastVisibleDoc));
        }

        const q = query(userExperiencesCol, ...queryConstraints);
        const documentSnapshots = await getDocs(q);

        const fetchedExperiences: Experience[] = documentSnapshots.docs.map(
          (d) => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              type: data.type || 'basic',
            } as Experience;
          }
        ).filter(exp => !exp.deletedAt);

        const lastVisible =
          documentSnapshots.docs[documentSnapshots.docs.length - 1] ?? null;
        setLastVisibleDoc(lastVisible);
        setHasMore(documentSnapshots.docs.length === PAGE_SIZE);

        setExperiences((prev) =>
          loadMore ? [...prev, ...fetchedExperiences] : fetchedExperiences,
        );
      } catch (error) {
        console.error('Error fetching experiences:', error);
      } finally {
        if (loadMore) {
          setLoadingMore(false);
        } else {
          setLoadingExperiences(false);
        }
      }
    },
    [user, lastVisibleDoc],
  );

  useEffect(() => {
    if (urlReportId) return;

    if (user) {
      setLastVisibleDoc(null);
      setHasMore(true);
      fetchExperiences();
    } else {
      setExperiences([]);
      setLoadingExperiences(false);
    }
  }, [user, urlReportId]);

  // Enforce persistent session for Onboarding to maintain history
  useEffect(() => {
    if (isOnboarding && user) {
      const onboardingSessionId = `onboarding-${user.uid}`;
      if (currentSessionId !== onboardingSessionId) {
          setCurrentSessionId(onboardingSessionId);
      }
    }
  }, [isOnboarding, user, currentSessionId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setExperiences([]);
      setActivePanel('chat');
      setCurrentSessionId(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (
      !window.confirm(
        '정말로 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없으며 모든 데이터가 영구적으로 삭제됩니다.',
      )
    )
      return;

    try {
      setAuthLoading(true);
      
      const chatSessionsCol = collection(db, 'users', user.uid, 'chatSessions');
      const sessionSnapshot = await getDocs(chatSessionsCol);
      
      const batch = writeBatch(db);
      
      for (const sessionDoc of sessionSnapshot.docs) {
          const messagesCol = collection(db, 'users', user.uid, 'chatSessions', sessionDoc.id, 'messages');
          const messagesSnap = await getDocs(messagesCol);
          messagesSnap.docs.forEach(m => batch.delete(m.ref));
          batch.delete(sessionDoc.ref);
      }
      
      await batch.commit();

      const userExperiencesCol = collection(db, 'users', user.uid, 'experiences');
      const snapshot = await getDocs(userExperiencesCol);
      snapshot.docs.forEach(d => deleteDoc(d.ref));

      await deleteDoc(doc(db, 'users', user.uid));
      await user.delete();

      setUser(null);
      setUserProfile(null);
      setExperiences([]);
      setActivePanel('chat');
      alert('회원 탈퇴가 완료되었습니다.');
      window.location.reload();

    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login' || (error.message && error.message.includes('recent-login'))) {
        alert('보안을 위해 재로그인이 필요합니다. 다시 로그인 후 탈퇴를 진행해주세요.');
        await signOut(auth);
      } else {
        alert('계정 삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAddExperience = useCallback(
    async (
      newExperienceData: Omit<Experience, 'id' | 'sequence_number' | 'createdAt'>,
    ): Promise<string | void> => {
      if (!user) return;

      const userExperiencesCol = collection(
        db,
        'users',
        user.uid,
        'experiences',
      );

      const maxQuery = query(
        userExperiencesCol,
        orderBy('sequence_number', 'desc'),
        limit(1),
      );
      const maxSnapshot = await getDocs(maxQuery);
      const maxSequence =
        maxSnapshot.docs.length > 0
          ? (maxSnapshot.docs[0].data() as Experience).sequence_number
          : 0;

      const sanitizedData = { ...newExperienceData };
      const arrayFields = ['tags', 'skills', 'jobs', 'nlpUnits'];
      
      Object.keys(sanitizedData).forEach(key => {
          const val = (sanitizedData as any)[key];
          if (val === undefined || val === null) {
              if (arrayFields.includes(key)) {
                  (sanitizedData as any)[key] = [];
              } else {
                  (sanitizedData as any)[key] = null;
              }
          }
      });

      const newExperience: Omit<Experience, 'id'> = {
        ...sanitizedData,
        sequence_number: maxSequence + 1,
        createdAt: new Date().toISOString(),
        deletedAt: null 
      };

      const docRef = await addDoc(userExperiencesCol, newExperience);
      setExperiences((prev) => [{ ...newExperience, id: docRef.id }, ...prev]);
      
      return docRef.id;
    },
    [user],
  );

  const handleUpdateExperience = useCallback(
    async (experienceId: string, updates: Partial<Experience>) => {
      if (!user) return;

      const sanitizedUpdates = { ...updates };
      Object.keys(sanitizedUpdates).forEach(key => {
          if ((sanitizedUpdates as any)[key] === undefined) {
              (sanitizedUpdates as any)[key] = null;
          }
      });

      // Find the experience being updated to check for relations
      const targetExp = experiences.find(e => e.id === experienceId);
      
      const batch = writeBatch(db);
      const targetRef = doc(db, 'users', user.uid, 'experiences', experienceId);
      batch.update(targetRef, sanitizedUpdates);

      let idsToSync: string[] = [];

      // Check if we need to sync related documents (same activity_name)
      // We sync if name, date, or type changes.
      if (targetExp && (sanitizedUpdates.activity_date !== undefined || sanitizedUpdates.activity_name !== undefined || sanitizedUpdates.activity_type !== undefined)) {
          const originalName = targetExp.activity_name;
          
          // Find related experiences (excluding self)
          const relatedExps = experiences.filter(e => 
              e.id !== experienceId && 
              e.activity_name === originalName
          );
          
          idsToSync = relatedExps.map(e => e.id);

          const syncPayload: any = {};
          if (sanitizedUpdates.activity_date !== undefined) syncPayload.activity_date = sanitizedUpdates.activity_date;
          if (sanitizedUpdates.activity_name !== undefined) syncPayload.activity_name = sanitizedUpdates.activity_name;
          if (sanitizedUpdates.activity_type !== undefined) syncPayload.activity_type = sanitizedUpdates.activity_type;

          if (Object.keys(syncPayload).length > 0) {
              relatedExps.forEach(rel => {
                  const relRef = doc(db, 'users', user.uid, 'experiences', rel.id);
                  batch.update(relRef, syncPayload);
              });
          }
      }

      await batch.commit();

      setExperiences((prev) =>
        prev.map((exp) => {
            if (exp.id === experienceId) {
                return { ...exp, ...sanitizedUpdates };
            }
            if (idsToSync.includes(exp.id)) {
                 const syncPayload: any = {};
                 if (sanitizedUpdates.activity_date !== undefined) syncPayload.activity_date = sanitizedUpdates.activity_date;
                 if (sanitizedUpdates.activity_name !== undefined) syncPayload.activity_name = sanitizedUpdates.activity_name;
                 if (sanitizedUpdates.activity_type !== undefined) syncPayload.activity_type = sanitizedUpdates.activity_type;
                 return { ...exp, ...syncPayload };
            }
            return exp;
        }),
      );

      if (selectedExperience) {
          if (selectedExperience.id === experienceId) {
            setSelectedExperience((prev) => prev ? { ...prev, ...sanitizedUpdates } : null);
          } else if (idsToSync.includes(selectedExperience.id)) {
             const syncPayload: any = {};
             if (sanitizedUpdates.activity_date !== undefined) syncPayload.activity_date = sanitizedUpdates.activity_date;
             if (sanitizedUpdates.activity_name !== undefined) syncPayload.activity_name = sanitizedUpdates.activity_name;
             if (sanitizedUpdates.activity_type !== undefined) syncPayload.activity_type = sanitizedUpdates.activity_type;
             setSelectedExperience((prev) => prev ? { ...prev, ...syncPayload } : null);
          }
      }
    },
    [user, experiences, selectedExperience],
  );

  const handleDeleteExperience = useCallback(
    async (id: string) => {
      if (!user) return;

      const expToDelete = experiences.find((e) => e.id === id);
      if (!expToDelete) return;

      let idsToDelete = [id];

      if (expToDelete.type === 'basic') {
        const relatedStories = experiences.filter(
          (e) =>
            e.type === 'story' &&
            e.activity_name === expToDelete.activity_name 
            // Removed strict date check to better handle related items by name
        );
        idsToDelete = [...idsToDelete, ...relatedStories.map((s) => s.id)];
      }

      const deletePromises = idsToDelete.map((expId) =>
        updateDoc(doc(db, 'users', user.uid, 'experiences', expId), {
            deletedAt: new Date().toISOString()
        })
      );
      await Promise.all(deletePromises);

      setExperiences((prev) =>
        prev.filter((exp) => !idsToDelete.includes(exp.id)),
      );
      setIsModalOpen(false);
      setSelectedExperience(null);
      alert("휴지통으로 이동되었습니다. (7일 후 영구 삭제)");
    },
    [user, experiences],
  );

  const handleRestoreExperience = useCallback((id: string) => {
      fetchExperiences(); 
  }, [fetchExperiences]);

  const handleRestoreSession = useCallback((id: string) => {
  }, []);

  const handleShowDetail = useCallback(
    (id: string) => {
      const experience = experiences.find((exp) => exp.id === id);
      if (experience) {
        setSelectedExperience(experience);
        setIsModalOpen(true);
      }
    },
    [experiences],
  );

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedExperience(null);
  }, []);

  const handleNavigateToStory = useCallback(
    (storyId: string) => {
      handleCloseModal();
      setActivePanel('data');
      setActiveDataView('story');
      setHighlightedStoryId(storyId);
    },
    [handleCloseModal],
  );

  const handleLoadMore = useCallback(() => {
    fetchExperiences(true);
  }, [fetchExperiences]);

  const createNewSession = () => {
    setCurrentSessionId(`session_${Date.now()}`);
    setActivePanel('chat');
  };

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }

      try {
        const sessionDocRef = doc(db, 'users', user.uid, 'chatSessions', sessionId);
        await updateDoc(sessionDocRef, {
            deletedAt: new Date().toISOString()
        });

        if (currentSessionId === sessionId) {
            createNewSession();
        }
        
      } catch (error) {
        console.error('Error deleting session:', error);
        alert("대화 삭제 중 오류가 발생했습니다.");
        throw error;
      }
    },
    [user, currentSessionId],
  );

  const handleClearAllSessions = useCallback(async () => {
     if (!user) return;
     if (!window.confirm("모든 대화 기록을 휴지통으로 이동하시겠습니까?")) return;

     try {
         const sessionsRef = collection(db, 'users', user.uid, 'chatSessions');
         const snapshot = await getDocs(sessionsRef);
         const batch = writeBatch(db);
         const now = new Date().toISOString();

         snapshot.docs.forEach((doc) => {
             const data = doc.data();
             if (!data.deletedAt) {
                 batch.update(doc.ref, { deletedAt: now });
             }
         });

         await batch.commit();
         createNewSession(); 
         alert('모든 대화 기록이 휴지통으로 이동되었습니다.');

     } catch (error) {
         console.error('Error clearing all sessions:', error);
         alert('대화 기록 전체 삭제 중 오류가 발생했습니다.');
     }
  }, [user]);

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    if (!user) return;

    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'chatSessions', sessionId),
        {
          title: newTitle,
        },
      );
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  const handleJobFitAnalysis = useCallback((data: JobFitAnalysis) => {
    setJobFitData(data);
    setIsReportModalOpen(true);
  }, []);

  if (urlReportId) {
    return <SharedReportView reportId={urlReportId} />;
  }

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 fixed inset-0">
        <LoadingSpinner isWhite={false} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    // Outer Wrapper for centering
    <div className="fixed inset-0 h-[100dvh] w-full flex items-center justify-center bg-gray-200 sm:p-4 font-sans select-none overflow-hidden touch-action-pan-x overscroll-none">
        
        {/* Main App Container - Responsive Width */}
        <div className="relative w-full h-full sm:h-[95vh] sm:w-full sm:max-w-7xl bg-slate-50 sm:rounded-2xl sm:shadow-2xl overflow-hidden flex flex-col border border-slate-200 ring-1 ring-slate-900/5">
          
          <Header
            user={user}
            userProfile={userProfile}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            isOnboarding={isOnboarding}
            onOpenAlarmSettings={() => setIsAlarmModalOpen(true)}
            onOpenProfileSettings={() => setIsProfileSettingsOpen(true)}
            onOpenTrash={() => setIsTrashModalOpen(true)} 
            onShowReportModal={() => setIsReportModalOpen(true)}
          />

          {/* Main Layout - Sliding Panels */}
          <main
            className="flex-1 w-full overflow-hidden relative bg-slate-50"
            onClick={() => isDropdownOpen && setIsDropdownOpen(false)}
          >
            {loadingExperiences || profileLoading ? (
              <div className="flex flex-col items-center justify-center h-full w-full text-gray-500">
                <LoadingSpinner isWhite={false} />
                <p className="mt-2 text-sm font-medium">로딩 중...</p>
              </div>
            ) : (
                <>
                  {/* Panel 0: Data */}
                  <div 
                      className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out bg-white z-10"
                      style={{ transform: `translateX(${(0 - activeIndex) * 100}%)` }}
                  >
                     <DataViewsPanel
                        activeDataView={activeDataView}
                        setActiveDataView={setActiveDataView}
                        experiences={experiences}
                        onShowDetail={handleShowDetail}
                        onUpdate={handleUpdateExperience}
                        onDelete={handleDeleteExperience}
                        onLoadMore={handleLoadMore}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        highlightedStoryId={highlightedStoryId}
                        clearHighlightedStory={() => setHighlightedStoryId(null)}
                      />
                  </div>

                  {/* Panel 1: Chat (Center) */}
                  <div 
                      className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out bg-slate-50 z-10"
                      style={{ transform: `translateX(${(1 - activeIndex) * 100}%)` }}
                  >
                    <ChatTab
                      onAddExperience={handleAddExperience}
                      onUpdateExperience={handleUpdateExperience}
                      experiences={experiences}
                      userProfile={userProfile}
                      sessionId={currentSessionId}
                      user={user}
                      onSessionChange={setCurrentSessionId}
                      isOnboarding={isOnboarding}
                      onJobFitAnalysis={handleJobFitAnalysis} 
                      onNavigateToData={() => setActivePanel('data')} 
                      onNavigateToReport={() => setActivePanel('report')} 
                      onEarnPoints={handleEarnPoints}
                    />
                  </div>

                  {/* Panel 2: Individual Archive (Right Sidebar) */}
                  <div 
                      className="absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out bg-white z-10"
                      style={{ transform: `translateX(${(2 - activeIndex) * 100}%)` }}
                  >
                        <PersonalArchive user={user} />
                  </div>
                </>
            )}
          </main>

          {/* Bottom Navigation - Visible on ALL screens now for sliding nav */}
          <div className="w-full">
            <AppNavigator
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                isOnboarding={isOnboarding}
            />
          </div>

          {/* Modals are rendered absolutely within the frame */}
          {isModalOpen && selectedExperience && (
            <DetailModal
              experiences={experiences}
              experience={selectedExperience}
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              onNavigateToStory={handleNavigateToStory}
              onDelete={handleDeleteExperience}
              onUpdate={handleUpdateExperience}
            />
          )}

          {isAlarmModalOpen && (
              <AlarmModal 
                isOpen={isAlarmModalOpen}
                onClose={() => setIsAlarmModalOpen(false)}
                currentSettings={userProfile?.alarmSettings}
                onSave={handleSaveAlarmSettings}
              />
          )}

          {isProfileSettingsOpen && (
            <ProfileSettingsModal 
                isOpen={isProfileSettingsOpen}
                onClose={() => setIsProfileSettingsOpen(false)}
                userProfile={userProfile}
                onSave={handleUpdateProfile}
            />
          )}
          
          {isTrashModalOpen && (
            <TrashModal 
                isOpen={isTrashModalOpen}
                onClose={() => setIsTrashModalOpen(false)}
                user={user}
                onRestoreExperience={handleRestoreExperience}
                onRestoreSession={handleRestoreSession}
            />
          )}

          {isReportModalOpen && (
              <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                experiences={experiences}
                user={user}
                report={report}
                setReport={setReport}
                jobFitData={jobFitData}
              />
          )}

          {showLevelUp && levelUpData && (
              <LevelUpModal 
                level={levelUpData.level}
                levelName={levelUpData.name}
                onClose={() => setShowLevelUp(false)}
              />
          )}

          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onSelectSession={(id) => {
              setCurrentSessionId(id);
              setActivePanel('chat');
            }}
            onNewChat={createNewSession}
            onDeleteSession={handleDeleteSession}
            onClearAllSessions={handleClearAllSessions} 
            onRenameSession={handleRenameSession}
            user={user}
            currentSessionId={currentSessionId}
          />
        </div>
    </div>
  );
};

export default App;
