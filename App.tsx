
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Experience, ReportData, PanelType, User, UserProfile, JobFitAnalysis } from './types';
import Header from './components/Header';
import ChatTab from './components/ChatTab';
import PersonalReportTab from './components/PersonalReportTab';
import DetailModal from './components/DetailModal';
import Sidebar from './components/Sidebar';
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
  getDoc,
  getDocs,
  limit,
  startAfter,
  updateDoc,
  writeBatch
} from './firebase';
import {
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { LoadingSpinner, ArrowLeftIcon, ArrowRightOnRectangleIcon } from './components/icons';
import SharedReportView from './components/SharedReportView';
import AppNavigator from './components/AppNavigator';
import DataViewsPanel from './components/DataViewsPanel';
import AuthScreen from './components/AuthScreen';

const PAGE_SIZE = 15;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Panel State: Default to 'chat' (Center)
  const [activePanel, setActivePanel] = useState<PanelType>('chat');
  
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loadingExperiences, setLoadingExperiences] = useState(true);

  const [selectedExperience, setSelectedExperience] =
    useState<Experience | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [urlReportId, setUrlReportId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  // New State for STEP 5 Job Fit Analysis
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

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024; 

  // --- ONBOARDING LOGIC ---
  const isOnboarding = useMemo(() => {
    if (loadingExperiences || !user) return false;
    if (userProfile?.isOnboardingFinished === true) return false;
    if (userProfile?.isOnboardingFinished === false) return true;
    return experiences.length === 0;
  }, [loadingExperiences, user, userProfile, experiences.length]);

  // URL에서 공유 리포트 ID 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('reportId');
    if (reportId) {
      setUrlReportId(reportId);
    }
  }, []);

  // 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Automatically start a new session ID when user logs in.
        // This ensures the chat tab treats it as a new conversation immediately.
        const newSessionId = `session_${Date.now()}`;
        setCurrentSessionId(newSessionId);

        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubProfile = (await import('firebase/firestore')).onSnapshot(userDocRef, (docSnap) => {
             if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
             } else {
                console.log('No such user profile!');
                setUserProfile(null);
             }
        });
      } else {
        setUserProfile(null);
        setCurrentSessionId(null);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
          (d) =>
            ({
              ...(d.data() as Experience),
              id: d.id,
            }) as Experience,
        );

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

  // 유저/리포트ID 변경 시 경험 로드
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, urlReportId]);

  // 온보딩 시 세션 ID 설정 (패널 강제 이동 로직 제거)
  useEffect(() => {
    if (isOnboarding && user) {
      // 패널 강제 이동(setActivePanel)은 사용자 경험을 위해 제거
      // 세션 ID만 초기화되지 않았다면 설정
      if (!currentSessionId) {
          setCurrentSessionId(`onboarding-${user.uid}`);
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
      if (error.code === 'auth/requires-recent-login') {
        alert('보안을 위해 재로그인이 필요합니다. 다시 로그인 후 탈퇴를 진행해주세요.');
        await signOut(auth);
      } else {
        alert('계정 삭제 중 오류가 발생했습니다: ' + error.message);
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

      const newExperience: Omit<Experience, 'id'> = {
        ...newExperienceData,
        sequence_number: maxSequence + 1,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(userExperiencesCol, newExperience);
      setExperiences((prev) => [{ ...newExperience, id: docRef.id }, ...prev]);
      
      return docRef.id;
    },
    [user],
  );

  const handleUpdateExperience = useCallback(
    async (storyId: string, updates: Partial<Experience>) => {
      if (!user) return;

      const docRef = doc(db, 'users', user.uid, 'experiences', storyId);
      await updateDoc(docRef, updates);

      setExperiences((prev) =>
        prev.map((exp) => (exp.id === storyId ? { ...exp, ...updates } : exp)),
      );

      if (selectedExperience && selectedExperience.id === storyId) {
        setSelectedExperience((prev) =>
          prev ? { ...prev, ...updates } : null,
        );
      }
    },
    [user, selectedExperience],
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
            e.activity_name === expToDelete.activity_name &&
            e.activity_date === expToDelete.activity_date,
        );
        idsToDelete = [...idsToDelete, ...relatedStories.map((s) => s.id)];
      }

      const deletePromises = idsToDelete.map((expId) =>
        deleteDoc(doc(db, 'users', user.uid, 'experiences', expId)),
      );
      await Promise.all(deletePromises);

      setExperiences((prev) =>
        prev.filter((exp) => !idsToDelete.includes(exp.id)),
      );
      setIsModalOpen(false);
      setSelectedExperience(null);
    },
    [user, experiences],
  );

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
      // Navigate to Data panel and select story view
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
    // Force a new unique session ID
    setCurrentSessionId(`session_${Date.now()}`);
    setActivePanel('chat');
  };

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!user) {
        console.error('Cannot delete session: No authenticated user.');
        throw new Error('로그인이 필요합니다.');
      }

      try {
        // Use a Batch write for atomicity and efficiency
        const batch = writeBatch(db);
        
        const messagesRef = collection(
          db,
          'users',
          user.uid,
          'chatSessions',
          sessionId,
          'messages'
        );

        const messagesSnapshot = await getDocs(messagesRef);
        messagesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const sessionDocRef = doc(db, 'users', user.uid, 'chatSessions', sessionId);
        batch.delete(sessionDocRef);

        await batch.commit();

        if (currentSessionId === sessionId) {
            // If current session is deleted, create a new one immediately
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
     if (!window.confirm("모든 대화 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

     try {
         const sessionsRef = collection(db, 'users', user.uid, 'chatSessions');
         const snapshot = await getDocs(sessionsRef);
         const batch = writeBatch(db);

         for (const sessionDoc of snapshot.docs) {
             const messagesRef = collection(db, 'users', user.uid, 'chatSessions', sessionDoc.id, 'messages');
             const messagesSnap = await getDocs(messagesRef);
             messagesSnap.forEach(m => batch.delete(m.ref));
             batch.delete(sessionDoc.ref);
         }

         await batch.commit();
         createNewSession(); // Start fresh
         alert('모든 대화 기록이 삭제되었습니다.');

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

  // Callback to update Job Fit Data from Chat
  const handleJobFitAnalysis = useCallback((data: JobFitAnalysis) => {
    setJobFitData(data);
    // Optional: Automatically switch to Report tab to show the dashboard
    // setActivePanel('report'); 
  }, []);

  const panelTranslations: { [key in PanelType]: string } = {
    data: '0%',
    chat: '-100%',
    report: '-200%',
  };
  
  // Navigation Helpers
  const goLeft = () => {
      if (activePanel === 'chat') setActivePanel('data');
      else if (activePanel === 'report') setActivePanel('chat');
  };

  const goRight = () => {
      if (activePanel === 'data') setActivePanel('chat');
      else if (activePanel === 'chat') setActivePanel('report');
  };

  // 공유 리포트 모드
  if (urlReportId) {
    return <SharedReportView reportId={urlReportId} />;
  }

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner isWhite={false} />
      </div>
    );
  }

  // 비로그인 상태
  if (!user) {
    return <AuthScreen />;
  }

  // 일반 앱 UI
  return (
    <div className="app-container flex flex-col h-screen w-screen sm:h-full sm:w-full max-w-5xl bg-slate-50 shadow-2xl rounded-none sm:rounded-2xl overflow-hidden font-sans relative">
      <Header
        user={user}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        onToggleSidebar={() => setIsSidebarOpen(true)}
        isOnboarding={isOnboarding}
        // Pass activePanel to highlight current section in Header (optional)
      />

      <main
        className="flex-1 overflow-hidden relative"
        onClick={() => isDropdownOpen && setIsDropdownOpen(false)}
      >
        {loadingExperiences ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <LoadingSpinner isWhite={false} />
            <p>경험 데이터 로딩 중...</p>
          </div>
        ) : (
            // Unified Carousel Layout for All Screens
            <>
                <div
                  className={`flex h-full transition-all duration-500 ease-in-out w-[300%] absolute top-0`}
                  style={{ left: panelTranslations[activePanel] }}
                >
                  {/* Left Panel: Data List */}
                  <div className="w-1/3 h-full overflow-hidden relative">
                     <DataViewsPanel
                        activeDataView={activeDataView}
                        setActiveDataView={setActiveDataView}
                        experiences={experiences}
                        onShowDetail={handleShowDetail}
                        onDelete={handleDeleteExperience}
                        onLoadMore={handleLoadMore}
                        hasMore={hasMore}
                        loadingMore={loadingMore}
                        highlightedStoryId={highlightedStoryId}
                        clearHighlightedStory={() => setHighlightedStoryId(null)}
                      />
                      {/* Overlay Arrow for Desktop Navigation */}
                      {isDesktop && activePanel === 'data' && (
                          <button 
                            onClick={goRight}
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 p-3 rounded-full shadow-lg hover:bg-white text-indigo-600 transition-all"
                            title="채팅으로 이동"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                          </button>
                      )}
                  </div>

                  {/* Center Panel: Chat */}
                  <div className="w-1/3 h-full overflow-hidden relative">
                    <ChatTab
                      onAddExperience={handleAddExperience}
                      onUpdateExperience={handleUpdateExperience}
                      experiences={experiences}
                      userProfile={userProfile}
                      sessionId={currentSessionId}
                      user={user}
                      onSessionChange={setCurrentSessionId}
                      isOnboarding={isOnboarding}
                      onJobFitAnalysis={handleJobFitAnalysis} // Pass callback
                      onNavigateToData={() => setActivePanel('data')} // Pass nav handler
                      onNavigateToReport={() => setActivePanel('report')} // Pass nav handler
                    />
                    {/* Desktop Navigation Arrows */}
                    {isDesktop && activePanel === 'chat' && (
                        <>
                            <button 
                                onClick={goLeft}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 p-3 rounded-full shadow-lg hover:bg-white text-indigo-600 transition-all"
                                title="경험 목록 보기 (왼쪽)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <button 
                                onClick={goRight}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 p-3 rounded-full shadow-lg hover:bg-white text-indigo-600 transition-all"
                                title="분석 리포트 보기 (오른쪽)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </>
                    )}
                  </div>

                  {/* Right Panel: Report & Dashboard */}
                  <div className="w-1/3 h-full overflow-hidden relative">
                    <PersonalReportTab
                      user={user}
                      experiences={experiences}
                      report={report}
                      setReport={setReport}
                      jobFitData={jobFitData} // Pass JobFit data
                    />
                     {/* Overlay Arrow for Desktop Navigation */}
                     {isDesktop && activePanel === 'report' && (
                          <button 
                            onClick={goLeft}
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/80 p-3 rounded-full shadow-lg hover:bg-white text-indigo-600 transition-all"
                            title="채팅으로 이동"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                              </svg>
                          </button>
                      )}
                  </div>
                </div>
            </>
        )}
      </main>

      <AppNavigator
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        isOnboarding={isOnboarding}
      />

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

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectSession={(id) => {
          setCurrentSessionId(id);
          setActivePanel('chat');
        }}
        onNewChat={createNewSession}
        onDeleteSession={handleDeleteSession}
        onClearAllSessions={handleClearAllSessions} // Pass clear all function
        onRenameSession={handleRenameSession}
        user={user}
        currentSessionId={currentSessionId}
      />
    </div>
  );
};

export default App;
