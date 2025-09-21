import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CashflowRecord, Settings } from '../types';

export const checkAndCreateRecurringTransactions = async (
  db: firebase.firestore.Firestore,
  userId: string,
  cashflowRecords: CashflowRecord[],
  settings: Settings,
  appId: string
): Promise<boolean> => {
  const settingsDocRef = db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`);
  
  const today = new Date();
  const lastCheck = settings.lastRecurringCheck ? new Date(settings.lastRecurringCheck) : new Date(today.getFullYear(), today.getMonth(), 0);

  // 如果本月已檢查過，則不執行
  if (lastCheck.getMonth() === today.getMonth() && lastCheck.getFullYear() === today.getFullYear()) {
    return false;
  }

  const recurringRecords = cashflowRecords.filter(r => r.isRecurring && r.recurrenceDay);
  if (recurringRecords.length === 0) {
    // 即使沒有定額項目，也更新檢查日期以避免重複檢查
    await settingsDocRef.set({ lastRecurringCheck: today.toISOString() }, { merge: true });
    return false;
  }

  let created = false;
  const cashflowCollectionRef = db.collection(`artifacts/${appId}/users/${userId}/cashflowRecords`);

  for (const record of recurringRecords) {
    const dayOfMonth = Number(record.recurrenceDay);
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) continue;

    // 為天數較少的月份調整執行日期
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const executionDay = Math.min(dayOfMonth, lastDayOfMonth);
    
    const newRecordDate = new Date(today.getFullYear(), today.getMonth(), executionDay).toISOString().slice(0, 10);
    
    // 簡單檢查以避免為同一定額項目在本月重複建立紀錄
    const alreadyExists = cashflowRecords.some(r => 
        r.date.startsWith(today.toISOString().slice(0, 7)) &&
        r.description?.includes(record.description) && // 檢查描述是否相關
        r.amount === record.amount &&
        r.category === record.category
    );

    if (!alreadyExists) {
      const { id, isRecurring, recurrenceDay, ...newRecordData } = record;
      const newRecord = { 
        ...newRecordData, 
        isRecurring: false, // 新紀錄不是定額項目模板
        date: newRecordDate,
        description: record.description ? `${record.description} (定額)` : '(定額)'
      };
      await cashflowCollectionRef.add(newRecord);
      created = true;
    }
  }

  // 更新最後檢查日期
  await settingsDocRef.set({ lastRecurringCheck: today.toISOString() }, { merge: true });
  
  return created;
};
