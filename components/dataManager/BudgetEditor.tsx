import React, { useState, useEffect, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Budget, Settings, NotificationType, CashflowRecord } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';

interface BudgetEditorProps {
    userId: string;
    db: firebase.firestore.Firestore;
    budgets: Budget[];
    cashflowRecords: CashflowRecord[];
    settings: Settings;
    setNotification: (notification: NotificationType) => void;
    appId: string;
}

const BudgetEditor: React.FC<BudgetEditorProps> = ({ userId, db, budgets, cashflowRecords, settings, setNotification, appId }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [budgetData, setBudgetData] = useState<{ [key: string]: string }>({});
    
    const expenseCategories = [...DEFAULT_CATEGORIES.expense, ...(settings.customExpense || [])];

    useEffect(() => {
        const monthBudgets = budgets.filter(b => b.month === selectedMonth);
        const data = monthBudgets.reduce((acc, curr) => ({ ...acc, [curr.category]: String(curr.amount) }), {});
        setBudgetData(data);
    }, [selectedMonth, budgets]);

    const { monthlySpending, averageSpending } = useMemo(() => {
        const spending: { [key: string]: number } = {};
        const avgSpending: { [key: string]: number } = {};
        
        // Calculate current month's spending
        cashflowRecords
            .filter(r => r.date.startsWith(selectedMonth) && r.type === 'expense')
            .forEach(record => {
                spending[record.category] = (spending[record.category] || 0) + record.amount;
            });

        // Calculate 3-month average spending for context
        const threeMonthsAgo = new Date(selectedMonth);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthCutoff = threeMonthsAgo.toISOString().slice(0, 7);
        
        const relevantRecords = cashflowRecords.filter(r => r.type === 'expense' && r.date >= threeMonthCutoff && r.date < selectedMonth);
        const monthlyTotals: { [month: string]: { [category: string]: number } } = {};
        
        relevantRecords.forEach(r => {
            const month = r.date.slice(0, 7);
            if (!monthlyTotals[month]) monthlyTotals[month] = {};
            monthlyTotals[month][r.category] = (monthlyTotals[month][r.category] || 0) + r.amount;
        });
        
        expenseCategories.forEach(cat => {
            let total = 0;
            let monthCount = 0;
            Object.values(monthlyTotals).forEach(monthData => {
                if (monthData[cat]) {
                    total += monthData[cat];
                    monthCount++;
                }
            });
            if (monthCount > 0) {
                avgSpending[cat] = total / monthCount;
            }
        });

        return { monthlySpending: spending, averageSpending: avgSpending };
    }, [selectedMonth, cashflowRecords, expenseCategories]);

    const handleBudgetChange = (category: string, amount: string) => {
        setBudgetData(prev => ({ ...prev, [category]: amount }));
    };

    const handleCopyLastMonth = () => {
        const currentDate = new Date(selectedMonth + '-02'); // Use day 2 to avoid timezone issues
        currentDate.setMonth(currentDate.getMonth() - 1);
        const lastMonth = currentDate.toISOString().slice(0, 7);
    
        const lastMonthBudgets = budgets.filter(b => b.month === lastMonth);
        if (lastMonthBudgets.length === 0) {
            setNotification({ message: '上個月沒有設定預算可供複製。', type: 'info', show: true });
            return;
        }
    
        const copiedData = lastMonthBudgets.reduce((acc, curr) => ({ ...acc, [curr.category]: String(curr.amount) }), {});
        setBudgetData(copiedData);
        setNotification({ message: `已從 ${lastMonth} 複製 ${Object.keys(copiedData).length} 個預算項目。請記得儲存變更。`, type: 'success', show: true });
    };

    const handleSaveBudgets = async () => {
        try {
            const batch = db.batch();
            const collectionPath = `artifacts/${appId}/users/${userId}/budgets`;

            for (const category of expenseCategories) {
                const amountStr = budgetData[category];
                const amount = amountStr ? parseFloat(amountStr) : 0;
                const existingBudget = budgets.find(b => b.month === selectedMonth && b.category === category);

                if (existingBudget) {
                    if (amount > 0) {
                        if (existingBudget.amount !== amount) {
                            const docRef = db.doc(`${collectionPath}/${existingBudget.id}`);
                            batch.update(docRef, { amount });
                        }
                    } else {
                        const docRef = db.doc(`${collectionPath}/${existingBudget.id}`);
                        batch.delete(docRef);
                    }
                } else if (amount > 0) {
                    const docRef = db.collection(collectionPath).doc();
                    batch.set(docRef, { month: selectedMonth, category, amount });
                }
            }
            await batch.commit();
            setNotification({ message: '預算儲存成功！', type: 'success', show: true });
        } catch (error) {
            console.error("Error saving budgets:", error);
            setNotification({ message: '儲存預算時發生錯誤。', type: 'error', show: true });
        }
    };

    return (
        <div className="p-6 border rounded-lg bg-gray-50 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div className="flex items-center space-x-4">
                    <label htmlFor="budget-month" className="text-md font-medium text-gray-700">選擇月份:</label>
                    <input type="month" id="budget-month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md shadow-sm bg-white" />
                </div>
                 <button onClick={handleCopyLastMonth} className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 shadow-sm transition-colors font-medium flex items-center justify-center text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    從上個月複製
                </button>
                 <button onClick={handleSaveBudgets} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-sm transition-colors font-medium">儲存所有預算</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                {expenseCategories.map(category => {
                    const spent = monthlySpending[category] || 0;
                    const budget = parseFloat(budgetData[category]) || 0;
                    const remaining = budget - spent;
                    const hasBudget = budget > 0;
                    const avg = averageSpending[category];
                    return (
                        <div key={category} className="grid grid-cols-2 items-center gap-2">
                            <label className="text-right font-medium text-gray-700">{category}:</label>
                            <div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                    <input 
                                        type="number" 
                                        value={budgetData[category] || ''} 
                                        onChange={e => handleBudgetChange(category, e.target.value)} 
                                        placeholder="設定預算" 
                                        className="p-2 pl-7 border rounded-md shadow-sm w-full"
                                    />
                                </div>
                                <div className="text-xs mt-1 text-right h-4">
                                    {hasBudget ? (
                                        <p className={`${remaining >= 0 ? 'text-gray-500' : 'text-red-500 font-bold'}`}>
                                            已支出: {spent.toLocaleString()}, {remaining >= 0 ? `剩餘: ${remaining.toLocaleString()}`: `超支: ${Math.abs(remaining).toLocaleString()}`}
                                        </p>
                                    ) : (
                                        spent > 0 ? <p className="text-gray-500">已支出: {spent.toLocaleString()}</p> : (avg && <p className="text-gray-400 italic">近3個月平均: {Math.round(avg).toLocaleString()}</p>)
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-6 flex justify-end">
                <button onClick={handleSaveBudgets} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 shadow-sm transition-colors font-medium">儲存所有預算</button>
            </div>
        </div>
    );
};

export default BudgetEditor;