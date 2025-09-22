// src/dbPaths.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// 使用者根文件：users/{uid}
export const userDoc = (db: firebase.firestore.Firestore, uid: string) =>
  db.collection('users').doc(uid);

// 使用者子集合：users/{uid}/{col}
export const userCol = (db: firebase.firestore.Firestore, uid: string, col: string) =>
  userDoc(db, uid).collection(col);

// 你專案常用的集合（統一在這裡管理）
export const assetAccountsCol   = (db: firebase.firestore.Firestore, uid: string) => userCol(db, uid, 'assetAccounts');
export const cashflowRecordsCol = (db: firebase.firestore.Firestore, uid: string) => userCol(db, uid, 'cashflowRecords');
export const budgetsCol         = (db: firebase.firestore.Firestore, uid: string) => userCol(db, uid, 'budgets');
export const goalsCol           = (db: firebase.firestore.Firestore, uid: string) => userCol(db, uid, 'goals');

// 設定如果是一份固定 doc（可依你的實作改名）
export const settingsDoc = (db: firebase.firestore.Firestore, uid: string) =>
  userDoc(db, uid).collection('settings').doc('default');
