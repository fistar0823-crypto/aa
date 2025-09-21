import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Settings, NotificationType, AssetAccount, CashflowRecord, Budget, Goal } from '../../types';

interface SettingsEditorProps {
    userId: string;
    db: firebase.firestore.Firestore;
    settings: Settings;
    setNotification: (notification: NotificationType) => void;
    appId: string;
    assetAccounts: AssetAccount[];
    cashflowRecords: CashflowRecord[];
    budgets: Budget[];
    goals: Goal[];
}

const SettingsEditor: React.FC<SettingsEditorProps> = (props) => {
    const { userId, db, settings, setNotification, appId, assetAccounts, cashflowRecords, budgets, goals } = props;
    
    const [newIncomeCat, setNewIncomeCat] = useState('');
    const [newExpenseCat, setNewExpenseCat] = useState('');
    const [manualRate, setManualRate] = useState<string | number>(settings.manualRate || '');
    
    const [githubToken, setGithubToken] = useState('');
    const [githubRepo, setGithubRepo] = useState('');
    const [githubPath, setGithubPath] = useState('financial_data.json');
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('同步中...');
    
    useEffect(() => {
        setManualRate(settings.manualRate || '');
        setGithubToken(localStorage.getItem('githubToken') || '');
        setGithubRepo(localStorage.getItem('githubRepo') || '');
        setGithubPath(localStorage.getItem('githubPath') || 'financial_data.json');
        setLastSync(localStorage.getItem('lastSync'));
    }, [settings.manualRate]);

    const handleSaveGitHubSettings = () => {
        localStorage.setItem('githubToken', githubToken);
        localStorage.setItem('githubRepo', githubRepo);
        localStorage.setItem('githubPath', githubPath);
        setNotification({ message: 'GitHub settings saved locally in your browser.', type: 'info', show: true });
    };

    const getFullData = () => ({
        assetAccounts,
        cashflowRecords,
        budgets,
        goals,
        settings,
        backupTimestamp: new Date().toISOString(),
    });

    const handleDownloadBackup = () => {
        setIsSyncing(true);
        setSyncMessage('正在產生備份檔案...');
        
        setTimeout(() => {
            try {
                const backupData = getFullData();
                const content = JSON.stringify(backupData, null, 2);
                const blob = new Blob([content], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = 'financial_data_backup.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setNotification({ message: '備份檔案已成功下載！', type: 'success', show: true });
            } catch (error) {
                console.error("Backup file generation error:", error);
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                setNotification({ message: `產生備份檔案失敗: ${errorMessage}`, type: 'error', show: true });
            } finally {
                setIsSyncing(false);
            }
        }, 50); // Delay allows UI to update with loading message
    };

    const handleSaveToGitHub = async () => {
        if (!githubToken || !githubRepo || !githubPath) {
            setNotification({ message: '請填寫完整的 GitHub 同步設定。', type: 'error', show: true });
            return;
        }
        setIsSyncing(true);
        setSyncMessage('正在同步至 GitHub...');

        const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${githubPath}`;
        const headers = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github.v3+json' };

        try {
            let currentSha: string | undefined;
            try {
                const getResponse = await fetch(apiUrl, { headers });
                if (getResponse.ok) {
                    currentSha = (await getResponse.json()).sha;
                } else if (getResponse.status !== 404) {
                    throw new Error(`無法讀取 GitHub 檔案: ${getResponse.statusText}`);
                }
            } catch (e) {
                console.warn("Could not fetch current file SHA, proceeding without it.", e);
            }
            
            const backupData = getFullData();
            const content = JSON.stringify(backupData, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));

            const body = JSON.stringify({
                message: `Sync financial data: ${new Date().toISOString()}`,
                content: encodedContent,
                sha: currentSha,
            });
            const putResponse = await fetch(apiUrl, { method: 'PUT', headers, body });

            if (!putResponse.ok) {
                throw new Error(`GitHub API 錯誤: ${(await putResponse.json()).message}`);
            }

            const syncTime = new Date().toLocaleString();
            setLastSync(syncTime);
            localStorage.setItem('lastSync', syncTime);
            setNotification({ message: '資料已成功同步至 GitHub！', type: 'success', show: true });

        } catch (error) {
            console.error("GitHub Sync Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setNotification({ message: `同步失敗: ${errorMessage}`, type: 'error', show: true });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleLoadFromGitHub = async () => {
        if (!githubToken || !githubRepo || !githubPath) {
            setNotification({ message: '請填寫完整的 GitHub 同步設定。', type: 'error', show: true });
            return;
        }
        if (!window.confirm('您確定要從 GitHub 載入資料嗎？這將會覆寫您目前的所有本地資料！')) return;
        
        setIsSyncing(true);
        setSyncMessage('正在從 GitHub 載入...');
        const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/${githubPath}`;
        
        try {
            const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github.v3+json' }});
            if (!response.ok) throw new Error(`無法讀取 GitHub 檔案: ${response.statusText}`);
            
            const fileData = await response.json();
            const decodedContent = decodeURIComponent(escape(atob(fileData.content)));
            const data = JSON.parse(decodedContent);

            const collections: { name: string, data: any[] }[] = [
                { name: 'assetAccounts', data: data.assetAccounts || [] }, { name: 'cashflowRecords', data: data.cashflowRecords || [] },
                { name: 'budgets', data: data.budgets || [] }, { name: 'goals', data: data.goals || [] },
            ];
            
            setSyncMessage('正在寫入資料庫...');
            for (const collection of collections) {
                const collectionPath = `artifacts/${appId}/users/${userId}/${collection.name}`;
                const existingDocs = await db.collection(collectionPath).get();
                const batchDelete = db.batch();
                existingDocs.docs.forEach(doc => batchDelete.delete(doc.ref));
                await batchDelete.commit();

                const batchAdd = db.batch();
                collection.data.forEach(item => {
                    const { id, ...itemData } = item;
                    const docRef = id ? db.collection(collectionPath).doc(id) : db.collection(collectionPath).doc();
                    batchAdd.set(docRef, itemData);
                });
                await batchAdd.commit();
            }
            
            await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set(data.settings || {});
            setNotification({ message: '資料已成功從 GitHub 載入並同步！', type: 'success', show: true });

        } catch(error) {
            console.error("GitHub Load Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setNotification({ message: `載入失敗: ${errorMessage}`, type: 'error', show: true });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSaveSettings = async () => {
        const settingsData = { ...settings, manualRate: parseFloat(String(manualRate)) || null };
        await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set(settingsData, { merge: true });
        setNotification({ message: '設定已儲存！', type: 'success', show: true });
    };

    const handleAddCategory = async (type: 'income' | 'expense') => {
        const category = type === 'income' ? newIncomeCat.trim() : newExpenseCat.trim();
        if (!category) return;
        const fieldKey = type === 'income' ? 'customIncome' : 'customExpense';
        const currentCategories = settings[fieldKey] || [];
        if (currentCategories.includes(category)) {
            setNotification({ message: '類別已存在。', type: 'error', show: true }); return;
        }
        await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set({ [fieldKey]: [...currentCategories, category] }, { merge: true });
        if (type === 'income') setNewIncomeCat(''); else setNewExpenseCat('');
        setNotification({ message: '類別新增成功！', type: 'success', show: true });
    };
    
    const handleRemoveCategory = async (type: 'income' | 'expense', categoryToRemove: string) => {
        if (window.confirm(`您確定要移除「${categoryToRemove}」這個類別嗎？`)) {
            const fieldKey = type === 'income' ? 'customIncome' : 'customExpense';
            const updatedCategories = (settings[fieldKey] || []).filter(cat => cat !== categoryToRemove);
            await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set({ [fieldKey]: updatedCategories }, { merge: true });
            setNotification({ message: '類別已移除。', type: 'success', show: true });
        }
    };
    
    return (
        <div className="relative">
             {isSyncing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                    <p className="text-lg text-gray-700 mt-4 font-semibold">{syncMessage}</p>
                </div>
            )}
            <div className={`space-y-8 max-w-3xl mx-auto ${isSyncing ? 'filter blur-sm' : ''}`}>
                <div className="p-6 border rounded-xl bg-white shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                        GitHub 同步
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">將您的財務資料安全地備份至私有 GitHub 儲存庫，實現跨裝置同步。</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">GitHub Personal Access Token (PAT)</label>
                            <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} onBlur={handleSaveGitHubSettings} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"/>
                            <div className="mt-1 text-xs text-gray-500 p-2 bg-gray-50 rounded-md border">
                            <p>
                                    1. 前往您的 GitHub <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">開發者設定</a>。
                            </p>
                            <p>
                                    2. 點擊 "Generate new token" 並選擇 "Generate new token (classic)"。
                            </p>
                            <p>
                                    3. <strong>最重要的一步：請務必勾選授予 <code className="text-xs bg-gray-200 p-1 rounded">repo</code> 權限</strong>，以允許此應用程式讀寫您的儲存庫。
                            </p>
                            <strong className="block text-red-600 mt-2">警告：此金鑰將儲存在您的瀏覽器本地儲存空間中。請勿在公共或不信任的電腦上使用此功能。</strong>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">儲存庫 (Repository)</label>
                            <input type="text" value={githubRepo} onChange={e => setGithubRepo(e.target.value)} onBlur={handleSaveGitHubSettings} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="your_username/your_repo_name"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">檔案路徑 (File Path)</label>
                            <input type="text" value={githubPath} onChange={e => setGithubPath(e.target.value)} onBlur={handleSaveGitHubSettings} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row gap-4">
                        <button onClick={handleSaveToGitHub} disabled={isSyncing} className="flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center font-semibold disabled:bg-green-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            {isSyncing ? '同步中...' : '儲存至 GitHub'}
                        </button>
                        <button onClick={handleLoadFromGitHub} disabled={isSyncing} className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center font-semibold disabled:bg-blue-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                            {isSyncing ? '載入中...' : '從 GitHub 載入'}
                        </button>
                    </div>
                    {lastSync && <p className="text-xs text-gray-500 mt-4 text-center">上次同步時間: {lastSync}</p>}
                </div>

                <div className="p-6 border rounded-xl bg-white shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        手動資料匯出 / 備份
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">點擊按鈕將您的所有應用程式資料匯出為一個 JSON 檔案作為手動備份。</p>
                    <div className="flex justify-center">
                        <button onClick={handleDownloadBackup} disabled={isSyncing} className="w-full sm:w-auto bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors shadow-sm flex items-center justify-center font-semibold disabled:bg-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            下載手動備份
                        </button>
                    </div>
                </div>
                
                <div className="p-6 border rounded-xl bg-white shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6" /></svg>
                        自訂類別
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">收入類別</h4>
                            <div className="flex items-center space-x-2 mb-4">
                                <input value={newIncomeCat} onChange={e => setNewIncomeCat(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleAddCategory('income'); }} placeholder="新增收入類別" className="flex-grow p-2 border rounded-md" />
                                <button onClick={() => handleAddCategory('income')} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">新增</button>
                            </div>
                            <ul className="space-y-2">{(settings.customIncome || []).map(cat => (<li key={cat} className="flex justify-between items-center bg-gray-50 p-2 rounded-md group"><span className="text-gray-700">{cat}</span><button onClick={() => handleRemoveCategory('income', cat)} className="text-gray-400 opacity-0 group-hover:opacity-100 h-t-r"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></li>))}</ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-700 mb-2">支出類別</h4>
                            <div className="flex items-center space-x-2 mb-4">
                                <input value={newExpenseCat} onChange={e => setNewExpenseCat(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleAddCategory('expense'); }} placeholder="新增支出類別" className="flex-grow p-2 border rounded-md" />
                                <button onClick={() => handleAddCategory('expense')} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">新增</button>
                            </div>
                            <ul className="space-y-2">{(settings.customExpense || []).map(cat => (<li key={cat} className="flex justify-between items-center bg-gray-50 p-2 rounded-md group"><span className="text-gray-700">{cat}</span><button onClick={() => handleRemoveCategory('expense', cat)} className="text-gray-400 opacity-0 group-hover:opacity-100 h-t-r"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></li>))}</ul>
                        </div>
                    </div>
                </div>

                <div className="p-6 border rounded-xl bg-white shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>
                        匯率設定
                    </h3>
                    <div className="flex items-center space-x-4">
                        <label className="font-medium text-gray-700">USD-TWD 手動匯率:</label>
                        <input type="number" step="any" value={manualRate} onChange={e => setManualRate(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm" placeholder="例如: 32.5" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">* 留白則使用系統預設匯率。</p>
                </div>

                <div className="flex justify-end pt-6 border-t mt-8">
                    <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg hover:bg-blue-700 shadow-md font-semibold transition-transform transform hover:scale-105">儲存所有設定</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsEditor;