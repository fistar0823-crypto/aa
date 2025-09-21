import React, { useState, useMemo, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Goal, AssetAccount, NotificationType } from '../../types';

interface GoalEditorProps {
    userId: string;
    db: firebase.firestore.Firestore;
    goals: Goal[];
    assetAccounts: AssetAccount[];
    setNotification: (notification: NotificationType) => void;
    appId: string;
    effectiveUsdToTwdRate: number;
}

const GoalEditor: React.FC<GoalEditorProps> = ({ userId, db, goals, assetAccounts, setNotification, appId, effectiveUsdToTwdRate }) => {
    const initialFormState = { name: '', targetAmount: '', currentAmount: '', targetDate: '', linkedAccountIds: [] as string[] };
    const [formData, setFormData] = useState(initialFormState);
    const [editId, setEditId] = useState<string | null>(null);

    const processedAccounts = useMemo(() => {
        return assetAccounts.map(account => {
            const totalValueTWD = (account.assets || []).reduce((sum, asset) => {
                const rate = asset.currency === 'USD' ? effectiveUsdToTwdRate : 1;
                const value = parseFloat(String(asset.currentValue)) || 0;
                const units = parseFloat(String(asset.units)) || 0;
                return sum + (value * units * rate);
            }, 0);
            return { id: account.id, name: account.name, totalValueTWD };
        }).sort((a, b) => b.totalValueTWD - a.totalValueTWD);
    }, [assetAccounts, effectiveUsdToTwdRate]);
    
    // Effect to update currentAmount whenever linked accounts change
    useEffect(() => {
        const totalFromLinkedAccounts = (formData.linkedAccountIds || []).reduce((sum, id) => {
            const account = processedAccounts.find(acc => acc.id === id);
            return sum + (account?.totalValueTWD || 0);
        }, 0);
        // Only update if accounts are actually linked
        if (formData.linkedAccountIds.length > 0) {
            setFormData(prev => ({ ...prev, currentAmount: totalFromLinkedAccounts.toFixed(0) }));
        }
    }, [formData.linkedAccountIds, processedAccounts]);


    const handleAccountLinkChange = (accountId: string) => {
        setFormData(prev => {
            const currentLinkedIds = prev.linkedAccountIds || [];
            const newLinkedIds = currentLinkedIds.includes(accountId)
                ? currentLinkedIds.filter(id => id !== accountId)
                : [...currentLinkedIds, accountId];
            
            // If all accounts are unlinked, clear the current amount
            if (newLinkedIds.length === 0) {
                return { ...prev, linkedAccountIds: [], currentAmount: '' };
            }
            
            return { ...prev, linkedAccountIds: newLinkedIds };
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const data: Omit<Goal, 'id' | 'currentAmount'> & { currentAmount?: number } = {
            name: formData.name,
            targetAmount: parseFloat(formData.targetAmount) || 0,
            targetDate: formData.targetDate,
            linkedAccountIds: formData.linkedAccountIds || []
        };
        
        // Only save currentAmount if no accounts are linked (manual entry)
        if (data.linkedAccountIds.length === 0) {
            data.currentAmount = parseFloat(formData.currentAmount) || 0;
        }

        const collectionPath = `artifacts/${appId}/users/${userId}/goals`;
        if (editId) {
            await db.doc(`${collectionPath}/${editId}`).set(data);
            setNotification({ message: '目標更新成功！', type: 'success', show: true });
        } else {
            await db.collection(collectionPath).add(data);
            setNotification({ message: '目標新增成功！', type: 'success', show: true });
        }
        setFormData(initialFormState);
        setEditId(null);
    };
    
    const handleEdit = (goal: Goal) => {
        setFormData({ 
            name: goal.name,
            targetAmount: String(goal.targetAmount), 
            currentAmount: String(goal.currentAmount || 0),
            targetDate: goal.targetDate,
            linkedAccountIds: goal.linkedAccountIds || []
        });
        setEditId(goal.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('您確定要刪除這個目標嗎？')) {
            await db.doc(`artifacts/${appId}/users/${userId}/goals/${id}`).delete();
            setNotification({ message: '目標已刪除。', type: 'success', show: true });
        }
    };
    
    const hasLinkedAccounts = formData.linkedAccountIds && formData.linkedAccountIds.length > 0;

    return (
        <div>
            <form onSubmit={handleSubmit} className="mb-8 p-6 border rounded-lg bg-gray-50 space-y-4 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800">{editId ? '編輯財務目標' : '新增財務目標'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">目標名稱*</label>
                        <input name="name" value={formData.name} onChange={handleInputChange} placeholder="例如: 購車基金" className="mt-1 w-full p-2 border rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">目標金額 (TWD)*</label>
                        <input type="number" name="targetAmount" value={formData.targetAmount} onChange={handleInputChange} placeholder="例如: 500000" className="mt-1 w-full p-2 border rounded-md shadow-sm" required />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">連結資產帳戶 (選填)</label>
                        <p className="text-xs text-gray-500 mb-2">選擇一個或多個帳戶，將自動加總其目前價值作為已存金額。</p>
                        <div className="p-2 border rounded-md bg-white shadow-sm max-h-32 overflow-y-auto space-y-1">
                            {processedAccounts.map(acc => (
                                <div key={acc.id} className="flex items-center">
                                    <input 
                                        type="checkbox"
                                        id={`acc-${acc.id}`}
                                        checked={(formData.linkedAccountIds || []).includes(acc.id)}
                                        onChange={() => handleAccountLinkChange(acc.id)}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`acc-${acc.id}`} className="ml-2 text-sm text-gray-700">
                                        {acc.name} (${acc.totalValueTWD.toLocaleString(undefined, {maximumFractionDigits: 0})})
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                           {hasLinkedAccounts ? '目前已存金額 (自動計算)' : '目前已存金額 (手動輸入)*'}
                        </label>
                         <input 
                            type="number"
                            name="currentAmount"
                            value={formData.currentAmount}
                            onChange={handleInputChange}
                            placeholder={hasLinkedAccounts ? '由連結帳戶計算' : '例如: 150000'}
                            className="mt-1 w-full p-2 border rounded-md shadow-sm disabled:bg-gray-100 disabled:text-gray-500"
                            required
                            disabled={hasLinkedAccounts}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">目標日期</label>
                        <input type="date" name="targetDate" value={formData.targetDate} onChange={handleInputChange} className="mt-1 w-full p-2 border rounded-md shadow-sm" />
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    {editId && <button type="button" onClick={() => { setEditId(null); setFormData(initialFormState); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-medium">取消</button>}
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium shadow-sm">{editId ? '更新目標' : '新增目標'}</button>
                </div>
            </form>
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">現有目標</h3>
                {goals.map(goal => {
                    const currentAmount = (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) 
                        ? (goal.linkedAccountIds || []).reduce((sum, accountId) => {
                            const account = processedAccounts.find(acc => acc.id === accountId);
                            return sum + (account?.totalValueTWD || 0);
                          }, 0)
                        : (goal.currentAmount || 0);

                    const progress = Math.min((currentAmount / goal.targetAmount) * 100, 100);
                    const accountNames = (goal.linkedAccountIds || [])
                        .map(id => assetAccounts.find(a => a.id === id)?.name)
                        .filter(Boolean)
                        .join(', ');

                    return (
                        <div key={goal.id} className="p-4 border rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-gray-800">{goal.name}</h4>
                                    <p className="text-xs text-gray-500">
                                        目標日期: {goal.targetDate || '未設定'}
                                        {accountNames && ` | 連結帳戶: ${accountNames}`}
                                    </p>
                                </div>
                                <div>
                                    <button onClick={() => handleEdit(goal)} className="text-indigo-600 hover:text-indigo-900 mr-3 text-sm font-medium">編輯</button>
                                    <button onClick={() => handleDelete(goal.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">刪除</button>
                                </div>
                            </div>
                            <p className="text-gray-700 text-sm mt-3">
                                ${currentAmount.toLocaleString(undefined, {maximumFractionDigits: 0})} / <span className="font-medium">${goal.targetAmount.toLocaleString()}</span>
                            </p>
                            <div className="mt-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-xs font-medium text-blue-700">進度</span>
                                    <span className="text-sm font-medium text-blue-700">{progress.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-gradient-to-r from-green-400 to-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                 {goals.length === 0 && <p className="text-gray-500 text-center py-6">尚未新增任何財務目標。</p>}
            </div>
        </div>
    );
};

export default GoalEditor;