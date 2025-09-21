import React, { useRef, useState, useMemo, useEffect } from 'react';
import Chart, { TooltipItem } from 'chart.js/auto';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { CashflowRecord, Budget, Settings, NotificationType } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';

interface BudgetAndMissionsProps {
    cashflowRecords: CashflowRecord[];
    budgets: Budget[];
    db: firebase.firestore.Firestore;
    userId: string;
    appId: string;
    settings: Settings;
    setNotification: (notification: NotificationType) => void;
}

const BudgetAndMissions: React.FC<BudgetAndMissionsProps> = ({ cashflowRecords, budgets, db, userId, appId, settings, setNotification }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const initialFormState = { category: '', amount: '' };
    const [newBudgetData, setNewBudgetData] = useState(initialFormState);

    const expenseCategories = [...DEFAULT_CATEGORIES.expense, ...(settings.customExpense || [])];

    const monthlyData = useMemo(() => {
        const currentMonthExpenses = cashflowRecords.filter(record => record.date.startsWith(currentMonth) && record.type === 'expense');
        const currentMonthBudgets = budgets.filter(budget => budget.month === currentMonth);
        const spendingByCategory = currentMonthExpenses.reduce((acc: { [key: string]: number }, record) => {
            acc[record.category] = (acc[record.category] || 0) + record.amount;
            return acc;
        }, {});
        const categories = [...new Set([...currentMonthBudgets.map(b => b.category), ...Object.keys(spendingByCategory)])];
        
        const combinedData = categories.map(category => {
            const budgetAmount = currentMonthBudgets.find(b => b.category === category)?.amount || 0;
            const spentAmount = spendingByCategory[category] || 0;
            return { category, budget: budgetAmount, spent: spentAmount, overBudget: spentAmount > budgetAmount };
        });

        const totalBudget = currentMonthBudgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = Object.values(spendingByCategory).reduce((sum, amount) => sum + Number(amount), 0);

        return { combinedData, totalBudget, totalSpent };
    }, [currentMonth, cashflowRecords, budgets]);

    const handleOpenModal = () => {
        setNewBudgetData(initialFormState); // Reset form when opening
        setIsModalOpen(true);
    };

    const handleSaveBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        const { category, amount } = newBudgetData;
        const amountNum = parseFloat(amount);

        if (!category || isNaN(amountNum) || amountNum <= 0) {
            setNotification({ message: '請選擇一個類別並輸入有效的預算金額。', type: 'error', show: true });
            return;
        }

        const docPath = `artifacts/${appId}/users/${userId}/budgets`;
        const existingBudget = budgets.find(b => b.month === currentMonth && b.category === category);

        try {
            if (existingBudget) {
                // Update existing budget
                await db.doc(`${docPath}/${existingBudget.id}`).update({ amount: amountNum });
                setNotification({ message: '預算更新成功！', type: 'success', show: true });
            } else {
                // Add new budget
                await db.collection(docPath).add({ month: currentMonth, category, amount: amountNum });
                setNotification({ message: '預算新增成功！', type: 'success', show: true });
            }
        } catch (error) {
            console.error("Error saving budget:", error);
            setNotification({ message: '儲存預算時發生錯誤。', type: 'error', show: true });
        }

        setIsModalOpen(false);
    };

    useEffect(() => {
        if (chartRef.current && monthlyData.combinedData.length > 0) {
            if (chartInstance.current) chartInstance.current.destroy();
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                const labels = monthlyData.combinedData.map(d => d.category);
                const budgetValues = monthlyData.combinedData.map(d => d.budget);
                const spentValues = monthlyData.combinedData.map(d => d.spent);
                
                // Create gradients
                const budgetGradient = ctx.createLinearGradient(0, 0, 0, 400);
                budgetGradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
                budgetGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');

                const spentGradient = ctx.createLinearGradient(0, 0, 0, 400);
                spentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.7)');
                spentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');

                const overspentGradient = ctx.createLinearGradient(0, 0, 0, 400);
                overspentGradient.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
                overspentGradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');

                chartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            { 
                                label: '預算金額', 
                                data: budgetValues, 
                                backgroundColor: budgetGradient, 
                                borderColor: 'rgba(59, 130, 246, 1)', 
                                borderWidth: 1,
                                borderRadius: 5,
                                hoverBackgroundColor: 'rgba(59, 130, 246, 1)',
                            },
                            { 
                                label: '實際支出', 
                                data: spentValues,
                                backgroundColor: spentValues.map((spent, i) => spent > budgetValues[i] ? overspentGradient : spentGradient),
                                borderColor: spentValues.map((spent, i) => spent > budgetValues[i] ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)'),
                                borderWidth: 1,
                                borderRadius: 5,
                                hoverBackgroundColor: spentValues.map((spent, i) => spent > budgetValues[i] ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)'),
                            }
                        ]
                    },
                    options: { 
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        scales: { 
                            y: { 
                                beginAtZero: true, 
                                grid: { color: 'rgba(200, 200, 200, 0.2)' },
                                ticks: { callback: (value) => `${Number(value)/1000}k` }
                            },
                            x: {
                                grid: { display: false }
                            }
                        }, 
                        plugins: { 
                            title: { display: true, text: `${currentMonth} 預算 vs. 支出分析`, font: { size: 16 } },
                            tooltip: {
                                enabled: true,
                                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                footerColor: '#ffffff',
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 12 },
                                footerFont: { size: 12, weight: 'bold' },
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: true,
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(context.parsed.y);
                                        }
                                        return label;
                                    },
                                    footer: (tooltipItems: TooltipItem<'bar'>[]) => {
                                        let budget = 0;
                                        let spent = 0;
                                        
                                        const budgetItem = tooltipItems.find(item => item.dataset.label === '預算金額');
                                        const spentItem = tooltipItems.find(item => item.dataset.label === '實際支出');

                                        if (budgetItem) budget = budgetItem.raw as number;
                                        if (spentItem) spent = spentItem.raw as number;
                                        
                                        if (budget > 0) {
                                            const difference = budget - spent;
                                            if (difference >= 0) {
                                                return `剩餘額度: ${difference.toLocaleString()} 元`;
                                            } else {
                                                return `超支金額: ${Math.abs(difference).toLocaleString()} 元`;
                                            }
                                        }
                                        return '';
                                    }
                                }
                            }
                        }, 
                    }
                });
            }
        }
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [monthlyData, currentMonth]);
    
    const missionCards = useMemo(() => {
        const missions = [];
        const { combinedData, totalBudget, totalSpent } = monthlyData;

        if (totalBudget > 0) {
            missions.push(totalSpent > totalBudget ?
                { title: "超出總預算", message: `本月總支出已超出總預算 ${(totalSpent - totalBudget).toLocaleString()} 元。`, type: "warning" } :
                { title: "預算控制良好", message: `本月總支出仍在預算內，剩餘額度為 ${(totalBudget - totalSpent).toLocaleString()} 元。`, type: "success" });
        } else {
             missions.push({ title: "設定月度預算", message: "您尚未設定本月預算，可點擊上方按鈕快速新增或前往「資料管理」設定。", type: "info" });
        }
        
        const overBudgetItems = combinedData.filter(item => item.overBudget && item.budget > 0);
        if (overBudgetItems.length > 0) {
            missions.push({ title: "注意超支項目", message: `您在「${overBudgetItems.map(i => i.category).join(', ')}」等項目上已超支。`, type: "warning" });
        }

        return missions;
    }, [monthlyData]);
    
    const cardColors = {
        success: 'bg-green-50 border-green-500 text-green-800',
        warning: 'bg-red-100 border-red-600 text-red-900',
        info: 'bg-blue-50 border-blue-500 text-blue-800',
    };

    return (
        <Card>
            <PageHeader title="預算檢視 & 月任務卡" subtitle="此頁面為您的預算檢視。點擊「快速新增預算」來為當前月份新增項目，或前往「資料管理」頁面進行更詳細的設定。"/>
            <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center space-x-2">
                    <label htmlFor="budget-month-select" className="text-sm font-medium text-gray-700">選擇月份:</label>
                    <input type="month" id="budget-month-select" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="p-2 border rounded-md shadow-sm"/>
                </div>
                <button onClick={handleOpenModal} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm transition-colors flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    快速新增預算
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-gray-50 p-4 rounded-lg border h-96">
                    {monthlyData.combinedData.length > 0 ? (
                        <canvas ref={chartRef}></canvas>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">此月份無預算或支出數據可供分析。</div>
                    )}
                </div>
                <div className="lg:col-span-2">
                    <h3 className="text-xl font-semibold mb-4 text-gray-800">本月任務與洞察</h3>
                    <div className="space-y-4">
                        {missionCards.map((mission, index) => (
                            <div key={index} className={`flex items-start p-4 ${mission.type === 'warning' ? 'border-l-8' : 'border-l-[5px]'} rounded-r-lg shadow-sm ${cardColors[mission.type]}`}>
                                {mission.type === 'warning' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                                {mission.type === 'success' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                {mission.type === 'info' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                <div>
                                    <h4 className="font-bold">{mission.title}</h4>
                                    <p className="text-sm leading-tight">{mission.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">為 {currentMonth} 新增/更新預算</h3>
                        <form onSubmit={handleSaveBudget} className="space-y-4">
                            <div>
                                <label htmlFor="budget-category" className="block text-sm font-medium text-gray-700">支出類別</label>
                                <select 
                                    id="budget-category" 
                                    name="category"
                                    value={newBudgetData.category}
                                    onChange={(e) => setNewBudgetData(prev => ({ ...prev, category: e.target.value }))}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    required
                                >
                                    <option value="" disabled>-- 請選擇類別 --</option>
                                    {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="budget-amount" className="block text-sm font-medium text-gray-700">預算金額 (TWD)</label>
                                <input 
                                    type="number"
                                    id="budget-amount"
                                    name="amount"
                                    value={newBudgetData.amount}
                                    onChange={(e) => setNewBudgetData(prev => ({ ...prev, amount: e.target.value }))}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="例如: 5000"
                                    required
                                    min="1"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 font-medium">取消</button>
                                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">儲存預算</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default BudgetAndMissions;
