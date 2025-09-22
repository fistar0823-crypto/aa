import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

// Component imports
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Notification from './components/layout/Notification';
import Dashboard from './components/dashboard/Dashboard';
import DataManager from './components/dataManager/DataManager';
import AssetManagement from './components/assets/AssetManagement';
import CashflowManagement from './components/cashflow/CashflowManagement';
import BudgetAndMissions from './components/budgets/BudgetAndMissions';
import InvestmentTracking from './components/investments/InvestmentTracking';
import FinancialGoals from './components/goals/FinancialGoals';
import ReportAndAnalysis from './components/reports/ReportAndAnalysis';
import AIAssistant from './components/assistant/AIAssistant';

// Type imports
import { Page, NotificationType } from './types';

// Hook and util imports
import useDataListeners from './hooks/useDataListeners';
import { processAssetAccounts } from './utils/dataProcessing';
import { checkAndCreateRecurringTransactions } from './services/recurringTransactions';

// --- Firebase Configuration (使用你的真實專案設定) ---
const firebaseConfig = {
  apiKey: "AIzaSyBzIuGIG4jmUe146rexK51UNvA2dn3xnT8",
  authDomain: "fir-f51b8.firebaseapp.com",
  projectId: "fir-f51b8",
  storageBucket: "fir-f51b8.appspot.com",
  messagingSenderId: "904534740293",
  appId: "1:904534740293:web:c571f1f69b004c0b15022c",
  measurementId: "G-5WGVD478EE"
};

// 用來標記本次 App 版本（維持你原本的設計）
const APP_ID = 'finance-dashboard-v1';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [notification, setNotification] = useState<NotificationType>({ message: '', type: 'info', show: false });

  // Firestore（沿用 compat 型別以相容你原本的 hooks/服務）
  const [db, setDb] = useState<firebase.firestore.Firestore | null>(null);

  // 使用者狀態（因為你的 Firestore 規則需要登入才可讀寫）
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [usdToTwdRate, setUsdToTwdRate] = useState<number>(32.5);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Notification handler
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification({ message: '', type: 'info', show: false });
    }, 3000);
  }, []);

  // 初始化 Firebase（不再 disableNetwork，改為真正連線線上 Firestore）
  useEffect(() => {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      const firestoreDb = firebase.firestore();
      setDb(firestoreDb);

      // 監聽登入狀態（compat 寫法，保持與現有型別相容）
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          setUserId(user.uid);
          setUserEmail(user.email ?? null);
        } else {
          setUserId(null);
          setUserEmail(null);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      showNotification('Firebase 初始化失敗，請檢查設定。', 'error');
    }
  }, [showNotification]);

  // Google 登入 / 登出
  const handleLogin = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      showNotification('登入成功！', 'success');
    } catch (e) {
      console.error('登入失敗：', e);
      showNotification('登入失敗，請再試一次。', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await firebase.auth().signOut();
      showNotification('已登出。', 'info');
    } catch (e) {
      console.error('登出失敗：', e);
      showNotification('登出失敗，請再試一次。', 'error');
    }
  };

  // 模擬匯率更新（保留你的原行為）
  useEffect(() => {
    const timer = setTimeout(() => setUsdToTwdRate(32.8), 2000);
    return () => clearTimeout(timer);
  }, []);

  // 監聽資料（維持你原本的 hook 與資料流設計）
  const { assetAccounts, cashflowRecords, budgets, goals, settings } =
    useDataListeners(db, userId ?? '', APP_ID);

  // 自動建立定額收支（沿用你的原本服務）
  useEffect(() => {
    if (db && userId && settings) {
      checkAndCreateRecurringTransactions(db, userId, cashflowRecords, settings, APP_ID)
        .then(created => {
          if (created) showNotification('定額收支項目已自動建立。', 'info');
        })
        .catch(error => {
          console.error("Error checking recurring transactions:", error);
          showNotification('檢查定額項目時發生錯誤。', 'error');
        });
    }
  }, [db, userId, cashflowRecords, settings, showNotification]);

  // 資料處理（保留你原本的流程）
  const effectiveUsdToTwdRate = settings?.manualRate || usdToTwdRate;
  const processedAssetAccounts = processAssetAccounts(assetAccounts, effectiveUsdToTwdRate);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard userId={userId ?? ''} assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
      case 'data-manager':
        return (
          <DataManager
            userId={userId ?? ''}
            db={db}
            assetAccounts={assetAccounts}
            cashflowRecords={cashflowRecords}
            budgets={budgets}
            goals={goals}
            settings={settings}
            setNotification={(n: NotificationType) => showNotification(n.message, n.type)}
            appId={APP_ID}
            effectiveUsdToTwdRate={effectiveUsdToTwdRate}
          />
        );
      case 'asset-management':
        return <AssetManagement assetAccounts={processedAssetAccounts} />;
      case 'cashflow-management':
        return <CashflowManagement cashflowRecords={cashflowRecords} />;
      case 'budget-missions':
        return (
          <BudgetAndMissions
            db={db}
            userId={userId ?? ''}
            appId={APP_ID}
            cashflowRecords={cashflowRecords}
            budgets={budgets}
            settings={settings}
            setNotification={(n: NotificationType) => showNotification(n.message, n.type)}
          />
        );
      case 'investment-tracking':
        return <InvestmentTracking assetAccounts={processedAssetAccounts} />;
      case 'financial-goals':
        return <FinancialGoals goals={goals} assetAccounts={assetAccounts} cashflowRecords={cashflowRecords} />;
      case 'report-analysis':
        return <ReportAndAnalysis assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
      default:
        return <Dashboard userId={userId ?? ''} assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {/* 取代你原本的 Offline bar：改為登入/同步狀態提示 */}
      <div className={`border-b text-center py-2 px-4 text-sm font-semibold shadow-inner z-30
                       ${userId ? 'bg-green-100 border-green-200 text-green-800'
                                : 'bg-yellow-100 border-yellow-200 text-yellow-800'}`}>
        <div className="container mx-auto flex items-center justify-center gap-3">
          {!userId ? (
            <>
              <span>未登入：目前僅本機顯示。請登入以啟用雲端同步（符合你的 Firestore 規則）。</span>
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                使用 Google 登入
              </button>
            </>
          ) : (
            <>
              <span>已登入 {userEmail ?? ''}，雲端同步已啟用。</span>
              <button
                onClick={handleLogout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
              >
                登出
              </button>
            </>
          )}
        </div>
      </div>

      <main className="flex-grow container mx-auto p-6 md:p-8">
        {db ? (
          renderPage()
        ) : (
          <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
            <p className="text-xl text-gray-700 mt-6 font-semibold">正在連接您的財務數據庫...</p>
            <p className="text-sm text-gray-500 mt-2">請稍候，正在準備您的個人財務導航中心。</p>
          </div>
        )}
      </main>

      <Notification notification={notification} />
      <Footer />

      <AIAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        assetAccounts={processedAssetAccounts}
        cashflowRecords={cashflowRecords}
        budgets={budgets}
        goals={goals}
      />

      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transform hover:scale-110 transition-transform duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Open AI Assistant"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default App;
