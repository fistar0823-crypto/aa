import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CashflowRecord, AssetAccount, Settings, NotificationType } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';

interface CashflowEditorProps {
    userId: string;
    db: firebase.firestore.Firestore;
    cashflowRecords: CashflowRecord[];
    assetAccounts: AssetAccount[];
    settings: Settings;
    setNotification: (notification: NotificationType) => void;
    appId: string;
    effectiveUsdToTwdRate: number;
}

const ITEMS_PER_PAGE = 25;

const CashflowEditor: React.FC<CashflowEditorProps> = ({ userId, db, cashflowRecords, assetAccounts, settings, setNotification, appId, effectiveUsdToTwdRate }) => {
    const initialFormState = { id: '', date: new Date().toISOString().split('T')[0], type: 'expense' as 'expense' | 'income', category: '', amount: '', currency: 'TWD' as 'TWD' | 'USD', description: '', isRecurring: false, accountId: '', recurrenceDay: '' };
    const [formData, setFormData] = useState(initialFormState);
    const [editId, setEditId] = useState<string | null>(null);
    const [localRate, setLocalRate] = useState(String(effectiveUsdToTwdRate));
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setLocalRate(String(effectiveUsdToTwdRate));
    }, [effectiveUsdToTwdRate]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1); // Reset page on new search
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    const filteredRecords = useMemo(() => {
        if (!debouncedSearchTerm) {
            return cashflowRecords;
        }
        return cashflowRecords.filter(record =>
            record.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            record.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            record.accountName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            record.amount.toString().includes(debouncedSearchTerm)
        );
    }, [cashflowRecords, debouncedSearchTerm]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: e.target.type === 'checkbox' ? checked : value }));
    };

    const handleRateUpdate = async () => {
        const newRate = parseFloat(localRate);
        if (!isNaN(newRate) && newRate > 0) {
            if (newRate !== settings.manualRate) {
                await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set({ manualRate: newRate }, { merge: true });
                setNotification({ message: `匯率已更新為 ${newRate}`, type: 'info', show: true });
            }
        } else if (localRate === '') {
             if (settings.manualRate !== null) {
                await db.doc(`artifacts/${appId}/users/${userId}/settings/userSettings`).set({ manualRate: null }, { merge: true });
                setNotification({ message: '手動匯率已清除，將使用系統預設值。', type: 'info', show: true });
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.category || !formData.amount || !formData.accountId) {
             setNotification({ message: '類別、金額和帳戶為必填項。', type: 'error', show: true });
            return;
        }
        if (formData.isRecurring && (!formData.recurrenceDay || Number(formData.recurrenceDay) < 1 || Number(formData.recurrenceDay) > 31)) {
            setNotification({ message: '請為定額項目設定有效的每月執行日期 (1-31)。', type: 'error', show: true });
            return;
        }
        const collectionPath = `artifacts/${appId}/users/${userId}/cashflowRecords`;
        const accountName = assetAccounts.find(acc => acc.id === formData.accountId)?.name || '';
        
        const dataToSave: Omit<CashflowRecord, 'id'> = {
            date: formData.date,
            type: formData.type,
            category: formData.category,
            amount: parseFloat(formData.amount) || 0,
            currency: formData.currency,
            description: formData.description,
            isRecurring: formData.isRecurring,
            accountId: formData.accountId,
            accountName: accountName,
        };

        if (formData.isRecurring) {
            dataToSave.recurrenceDay = Number(formData.recurrenceDay);
        }
        
        try {
            if (editId) {
                await db.doc(`${collectionPath}/${editId}`).set(dataToSave);
                setNotification({ message: '收支紀錄更新成功！', type: 'success', show: true });
            } else {
                await db.collection(collectionPath).add(dataToSave);
                setNotification({ message: '收支紀錄新增成功！', type: 'success', show: true });
            }
            setFormData(initialFormState);
            setEditId(null);
        } catch (error) {
             console.error('Error saving cashflow record:', error);
             const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
             setNotification({ message: `儲存失敗: ${errorMessage}`, type: 'error', show: true });
        }
    };
    
    const handleEdit = (record: CashflowRecord) => {
        setFormData({ ...initialFormState, ...record, amount: record.amount.toString(), recurrenceDay: String(record.recurrenceDay || '') });
        setEditId(record.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if(window.confirm('您確定要刪除這筆紀錄嗎？')) {
            await db.doc(`artifacts/${appId}/users/${userId}/cashflowRecords/${id}`).delete();
            setNotification({ message: '紀錄已刪除。', type: 'success', show: true });
        }
    };

    const categories = formData.type === 'income' ? 
        [...DEFAULT_CATEGORIES.income, ...(settings.customIncome || [])] : 
        [...DEFAULT_CATEGORIES.expense, ...(settings.customExpense || [])];

    return (
      <div>
        <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-lg bg-gray-50 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{editId ? '編輯收支紀錄' : '新增收支紀錄'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">日期</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">帳戶*</label>
                    <select name="accountId" value={formData.accountId} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm bg-white"><option value="">選擇帳戶</option>{assetAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">類型</label>
                    <select name="type" value={formData.type} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm bg-white"><option value="expense">支出</option><option value="income">收入</option></select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">類別*</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm bg-white"><option value="">選擇類別</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">金額*</label>
                    <input type="number" name="amount" placeholder="輸入金額" value={formData.amount} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">幣別 & 匯率</label>
                    <div className="flex space-x-2 mt-1">
                        <select name="currency" value={formData.currency} onChange={handleInputChange} className={`p-2 border rounded-md shadow-sm bg-white transition-all duration-200 ${formData.currency === 'USD' ? 'w-1/2' : 'w-full'}`}>
                            <option value="TWD">TWD</option><option value="USD">USD</option>
                        </select>
                        {formData.currency === 'USD' && (
                            <input type="number" step="0.01" aria-label="USD to TWD Exchange Rate" placeholder="匯率" value={localRate} onChange={e => setLocalRate(e.target.value)} onBlur={handleRateUpdate} className="p-2 border rounded-md shadow-sm w-1/2"/>
                        )}
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">說明 (選填)</label>
                    <input type="text" name="description" placeholder="例如：與同事的午餐" value={formData.description} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm" />
                </div>
                <div className="flex items-end">
                    <div className="p-3 border rounded-md bg-white shadow-sm w-full">
                        <div className="flex items-center">
                            <input type="checkbox" id="isRecurring" name="isRecurring" checked={formData.isRecurring} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                            <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-900">設為定額項目</label>
                        </div>
                        {formData.isRecurring && (
                            <div className="flex items-center mt-2">
                                <label htmlFor="recurrenceDay" className="mr-2 text-sm text-gray-700">每月</label>
                                <input type="number" id="recurrenceDay" name="recurrenceDay" value={formData.recurrenceDay} onChange={handleInputChange} min="1" max="31" placeholder="日" className="p-1 border rounded-md shadow-sm w-20" />
                                <span className="ml-2 text-sm text-gray-700">日執行</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
                {editId && <button type="button" onClick={() => { setEditId(null); setFormData(initialFormState); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-medium">取消編輯</button>}
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium shadow-sm">{editId ? '更新紀錄' : '新增紀錄'}</button>
            </div>
        </form>

        <div className="mb-4">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                    type="text"
                    placeholder="搜尋類別、說明、金額..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
        </div>

        <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">帳戶</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類別</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">說明</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedRecords.map((record, index) => (
                        <tr key={record.id} className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${editId === record.id ? 'bg-blue-100' : 'hover:bg-yellow-50'}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.accountName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {record.type === 'income' ? '收入' : '支出'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.category}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${record.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>{record.amount.toLocaleString()} <span className="text-xs text-gray-400">{record.currency}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs" title={record.description || '-'}>{record.description || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                 {record.isRecurring && (
                                    <span title={`定額項目: 每月 ${record.recurrenceDay} 日`} className="mr-3 text-blue-500 cursor-help">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M5 12a7 7 0 0011.66 4.995M20 20v-5h-5" /></svg>
                                    </span>
                                )}
                                <button onClick={() => handleEdit(record)} className="text-indigo-600 hover:text-indigo-900 mr-4">編輯</button>
                                <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-900">刪除</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
             {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 p-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                    上一頁
                  </button>
                  <span className="text-sm text-gray-700">第 {currentPage} 頁 / 共 {totalPages} 頁</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                    下一頁
                  </button>
                </div>
              )}
        </div>
      </div>
    );
};

export default CashflowEditor;