import { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AssetAccount, CashflowRecord, Budget, Goal, Settings } from '../types';

const useDataListeners = (db: firebase.firestore.Firestore | null, userId: string | null, appId: string) => {
  const [assetAccounts, setAssetAccounts] = useState<AssetAccount[]>([]);
  const [cashflowRecords, setCashflowRecords] = useState<CashflowRecord[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<Settings>({ customIncome: [], customExpense: [], manualRate: null, lastRecurringCheck: null });

  useEffect(() => {
    if (!db || !userId || !appId) {
      // Clear data on logout or if db/user is not available
      setAssetAccounts([]);
      setCashflowRecords([]);
      setBudgets([]);
      setGoals([]);
      setSettings({ customIncome: [], customExpense: [], manualRate: null, lastRecurringCheck: null });
      return;
    }

    const basePath = `artifacts/${appId}/users/${userId}`;

    const unsubAssetAccounts = db.collection(`${basePath}/assetAccounts`).onSnapshot(snapshot => {
      setAssetAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetAccount)));
    });

    const unsubCashflow = db.collection(`${basePath}/cashflowRecords`).orderBy('date', 'desc').onSnapshot(snapshot => {
      setCashflowRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashflowRecord)));
    });
    
    const unsubBudgets = db.collection(`${basePath}/budgets`).onSnapshot(snapshot => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
    });
    
    const unsubGoals = db.collection(`${basePath}/goals`).orderBy('targetDate', 'asc').onSnapshot(snapshot => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    });

    const unsubSettings = db.doc(`${basePath}/settings/userSettings`).onSnapshot(docSnap => {
      if (docSnap.exists) {
        setSettings(docSnap.data() as Settings);
      } else {
        setSettings({ customIncome: [], customExpense: [], manualRate: null, lastRecurringCheck: null });
      }
    });

    return () => {
      unsubAssetAccounts();
      unsubCashflow();
      unsubBudgets();
      unsubGoals();
      unsubSettings();
    };
  }, [db, userId, appId]);

  return { assetAccounts, cashflowRecords, budgets, goals, settings };
};

export default useDataListeners;
