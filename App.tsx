import React, { useState, useEffect, useCallback } from 'react';
import { db, auth, signInWithGoogle } from './firebase'; // 從 firebase.ts 匯入
import {
  collection,
  addDoc,
  getDocs,
  DocumentData,
} from 'firebase/firestore';

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

const MOCK_APP_ID = 'finance-dashboard-v1';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [notification, setNotification] = useState<NotificationType>({
    message: '',
    type: 'info',
    show: false,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [usdToTwdRate, setUsdToTwdRate] = useState<number>(32.5);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Notification handler
  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      setNotification({ message, type, show: true });
      setTimeout(() => {
        setNotification({ message: '', type: 'info', show: false });
      }, 3000);
    },
    []
  );

  // Google 登入
  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      setUserId(result.user.uid);
      showNotification('登入成功！', 'success');
    } catch (error) {
      console.error('登入失敗:', error);
      showNotification('登入失敗，請再試一次。', 'error');
    }
  };

  // 模擬匯率更新
  useEffect(() => {
    const timer = setTimeout(() => setUsdToTwdRate(32.8), 2000);
    return () => clearTimeout(timer);
  }, []);

  // 使用 hook 抓 Firestore 資料
  const { assetAccounts, cashflowRecords, budgets, goals, settings } =
    useDataListeners(db, userId || '', MOCK_APP_ID);

  // 自動建立定額收支
  useEffect(() => {
    if (db && userId && settings) {
      checkAndCreateRecurringTransactions(
        db,
        userId,
        cashflowRecords,
        settings,
        MOCK_APP_ID
      )
        .then((created) => {
          if (created) {
            showNotification('定額收支項目已自動建立。', 'info');
          }
        })
        .catch((error) => {
          console.error('Error checking recurring transactions:', error);
          showNotification('檢查定額項目時發生錯誤。', 'error');
        });
    }
  }, [db, userId, cashflowRecords, settings, showNotification]);

  // 實際寫入 Firestore 測試
  const addTestData = async () => {
    if (!userId) {
      showNotification('請先登入才能新增資料', 'error');
      return;
    }
    await addDoc(collection(db, 'testData'), {
      userId,
      text: '這是測試資料',
      createdAt: new Date(),
    });
    showNotification('成功新增一筆測試資料', 'success');
  };

  // 實際讀取 Firestore 測試
  const loadTestData = async () => {
    const querySnapshot = await getDocs(collection(db, 'testData'));
    querySnapshot.forEach((doc) => {
      console.log('讀取到資料:', doc.id, doc.data());
    });
    showNotification('已讀取 Firestore 資料，請看 console.log', 'info');
  };

  const effectiveUsdToTwdRate = settings.manualRate || usdToTwdRate;
  const processedAssetAccounts = processAssetAccounts(
    assetAccounts,
    effectiveUsdToTwdRate
  );

  const renderPage = () => {
    if (!userId) {
      return (
        <div className="flex flex-col items-center justify-center h-screen">
          <h1 className="text-xl mb-4">請先登入 Firebase 帳號</h1>
          <button
            onClick={handleLogin}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            使用 Google 登入
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            userId={userId}
            assetAccounts={processedAssetAccounts}
            cashflowRecords={cashflowRecords}
          />
        );
      case 'data-manager':
        return (
          <DataManager
            userId={userId}
            db={db}
            assetAccounts={assetAccounts}
            cashflowRecords={cashflowRecords}
            budgets={budgets}
            goals={goals}
            settings={settings}
            setNotification={(notification: NotificationType) =>
              showNotification(notification.message, notification.type)
            }
            appId={MOCK_APP_ID}
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
            userId={userId}
            appId={MOCK_APP_ID}
            cashflowRecords={cashflowRecords}
            budgets={budgets}
            settings={settings}
            setNotification={(notification: NotificationType) =>
              showNotification(notification.message, notification.type)
            }
          />
        );
      case 'investment-tracking':
        return <InvestmentTracking assetAccounts={processedAssetAccounts} />;
      case 'financial-goals':
        return (
          <FinancialGoals
            goals={goals}
            assetAccounts={assetAccounts}
            cashflowRecords={cashflowRecords}
          />
        );
      case 'report-analysis':
        return (
          <ReportAndAnalysis
            assetAccounts={processedAssetAccounts}
            cashflowRecords={cashflowRecords}
          />
        );
      default:
        return (
          <Dashboard
            userId={userId}
            assetAccounts={processedAssetAccounts}
            cashflowRecords={cashflowRecords}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-grow container mx-auto p-6 md:p-8">
        {renderPage()}

        {userId && (
          <div className="mt-6 space-x-4">
            <button
              onClick={addTestData}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              新增測試資料
            </button>
            <button
              onClick={loadTestData}
              className="bg-indigo-600 text-white px-4 py-2 rounded"
            >
              讀取測試資料
            </button>
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
    </div>
  );
};

export default App;
