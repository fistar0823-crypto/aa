import React, { useState, useEffect, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

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

// --- Firebase Configuration ---
// Using placeholder credentials to allow Firebase to initialize in an environment
// without access to process.env variables. This will allow the app UI to render,
// though Firestore will operate in offline mode and show connection errors in the console.
const firebaseConfig = {
  apiKey: "AIzaSyC_placeholder_api_key",
  authDomain: "placeholder-project.firebaseapp.com",
  projectId: "placeholder-project",
  storageBucket: "placeholder-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// --- Mock Data (for demonstration purposes) ---
// In a real application, you would have a proper authentication system.
const MOCK_USER_ID = 'test-user-123';
// This can be a unique identifier for this version of your application artifact.
const MOCK_APP_ID = 'finance-dashboard-v1';


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [notification, setNotification] = useState<NotificationType>({ message: '', type: 'info', show: false });
  const [db, setDb] = useState<firebase.firestore.Firestore | null>(null);
  const [usdToTwdRate, setUsdToTwdRate] = useState<number>(32.5); // Default/mock rate
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);


  // Notification handler
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type, show: true });
    setTimeout(() => {
      setNotification({ message: '', type: 'info', show: false });
    }, 3000);
  }, []);

  // Initialize Firebase on component mount
  useEffect(() => {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      const firestoreDb = firebase.firestore();

      // To prevent connection errors with placeholder credentials, we explicitly
      // disable the network connection, forcing Firestore to work in offline mode.
      firestoreDb.disableNetwork()
        .then(() => {
          console.log("Firestore network disabled. Running in offline mode.");
          setDb(firestoreDb);
        })
        .catch((error) => {
          console.error("Failed to disable Firestore network, may see connection errors:", error);
          // Still set the db to allow the app to function with cache.
          setDb(firestoreDb);
        });
        
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      showNotification('Firebase initialization failed. Please check your configuration.', 'error');
    }
  }, [showNotification]);

  // Mock fetching live exchange rate
  useEffect(() => {
    const timer = setTimeout(() => setUsdToTwdRate(32.8), 2000); // Simulate API call
    return () => clearTimeout(timer);
  }, []);

  const userId = MOCK_USER_ID;
  const appId = MOCK_APP_ID;

  // Custom hook to listen to Firestore data changes
  const { assetAccounts, cashflowRecords, budgets, goals, settings } = useDataListeners(db, userId, appId);

  // Effect to handle recurring transactions automatically
  useEffect(() => {
    if (db && userId && settings) {
      checkAndCreateRecurringTransactions(db, userId, cashflowRecords, settings, appId)
        .then(created => {
          if (created) {
            showNotification('定額收支項目已自動建立。', 'info');
          }
        })
        .catch(error => {
          console.error("Error checking recurring transactions:", error);
          showNotification('檢查定額項目時發生錯誤。', 'error');
        });
    }
  }, [db, userId, cashflowRecords, settings, appId, showNotification]);


  // Process raw asset data to include calculated TWD values
  const effectiveUsdToTwdRate = settings.manualRate || usdToTwdRate;
  const processedAssetAccounts = processAssetAccounts(assetAccounts, effectiveUsdToTwdRate);

  const renderPage = () => {
    if (!db) {
      return (
        <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
            <p className="text-xl text-gray-700 mt-6 font-semibold">正在連接您的財務數據庫...</p>
            <p className="text-sm text-gray-500 mt-2">請稍候，正在準備您的個人財務導航中心。</p>
        </div>
      );
    }
    
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard userId={userId} assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
      case 'data-manager':
        return <DataManager 
                  userId={userId} 
                  db={db}
                  assetAccounts={assetAccounts}
                  cashflowRecords={cashflowRecords}
                  budgets={budgets}
                  goals={goals}
                  settings={settings}
                  setNotification={(notification: NotificationType) => showNotification(notification.message, notification.type)}
                  appId={appId}
                  effectiveUsdToTwdRate={effectiveUsdToTwdRate}
                />;
      case 'asset-management':
        return <AssetManagement assetAccounts={processedAssetAccounts} />;
      case 'cashflow-management':
        return <CashflowManagement cashflowRecords={cashflowRecords} />;
      case 'budget-missions':
        return <BudgetAndMissions
                    db={db}
                    userId={userId}
                    appId={appId}
                    cashflowRecords={cashflowRecords}
                    budgets={budgets}
                    settings={settings}
                    setNotification={(notification: NotificationType) => showNotification(notification.message, notification.type)}
                />;
      case 'investment-tracking':
        return <InvestmentTracking assetAccounts={processedAssetAccounts} />;
      case 'financial-goals':
        return <FinancialGoals goals={goals} assetAccounts={assetAccounts} cashflowRecords={cashflowRecords} />;
      case 'report-analysis':
        return <ReportAndAnalysis assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
      default:
        return <Dashboard userId={userId} assetAccounts={processedAssetAccounts} cashflowRecords={cashflowRecords} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="bg-blue-100 border-b border-blue-200 text-blue-800 text-center py-2 px-4 text-sm font-semibold shadow-inner z-30">
        <div className="container mx-auto flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Offline Mode: The application is running locally and data is not synced with a server.</span>
        </div>
      </div>
      <main className="flex-grow container mx-auto p-6 md:p-8">
        {renderPage()}
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