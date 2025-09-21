import React, { useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AssetAccount, CashflowRecord, Budget, Goal, Settings, NotificationType } from '../../types';
import PageHeader from '../shared/PageHeader';
import CashflowEditor from './CashflowEditor';
import AssetEditor from './AssetEditor';
import BudgetEditor from './BudgetEditor';
import GoalEditor from './GoalEditor';
import SettingsEditor from './SettingsEditor';

interface DataManagerProps {
  userId: string;
  db: firebase.firestore.Firestore;
  assetAccounts: AssetAccount[];
  cashflowRecords: CashflowRecord[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
  setNotification: (notification: NotificationType) => void;
  appId: string;
  effectiveUsdToTwdRate: number;
}

type ActiveTab = 'cashflow' | 'assets' | 'budgets' | 'goals' | 'settings';

const tabIcons: { [key in ActiveTab]: React.FC<React.SVGProps<SVGSVGElement>> } = {
    cashflow: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    ),
    assets: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    budgets: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M12 8h.01M15 8h.01M15 14h.01M18 17h.01M18 14h.01M18 11h.01M18 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    goals: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
    ),
    settings: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
};


const DataManager: React.FC<DataManagerProps> = (props) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('cashflow');

    const renderContent = () => {
        switch (activeTab) {
            case 'assets':
                return <AssetEditor {...props} />;
            case 'cashflow':
                return <CashflowEditor {...props} />;
            case 'budgets':
                return <BudgetEditor {...props} />;
            case 'goals':
                return <GoalEditor {...props} />;
            case 'settings':
                return <SettingsEditor {...props} />;
            default:
                return null;
        }
    };

    const tabs: { id: ActiveTab; label: string }[] = [
        { id: 'cashflow', label: '收支管理' },
        { id: 'assets', label: '資產管理' },
        { id: 'budgets', label: '預算管理' },
        { id: 'goals', label: '目標管理' },
        { id: 'settings', label: '系統設定' },
    ];

    return (
        <div>
            <PageHeader title="資料管理中心" />
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => {
                        const Icon = tabIcons[tab.id];
                        return (
                           <button 
                                key={tab.id} 
                                onClick={() => setActiveTab(tab.id)} 
                                className={`${activeTab === tab.id 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors duration-200`}
                            >
                               <Icon className="h-5 w-5 mr-2" />
                               {tab.label}
                           </button>
                        )
                    })}
                </nav>
            </div>
            <div className="mt-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default DataManager;
