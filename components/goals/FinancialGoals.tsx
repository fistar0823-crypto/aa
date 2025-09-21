import React, { useMemo } from 'react';
import { Goal, AssetAccount, CashflowRecord } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import EmptyState from '../shared/EmptyState';

interface FinancialGoalsProps {
  goals: Goal[];
  assetAccounts: AssetAccount[];
  cashflowRecords: CashflowRecord[];
}

const GoalEmptyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
);

const FinancialGoals: React.FC<FinancialGoalsProps> = ({ goals, assetAccounts, cashflowRecords }) => {
    
    const averageMonthlySavings = useMemo(() => {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sixMonthCutoff = sixMonthsAgo.toISOString().slice(0, 7);

        const monthlyNet: { [month: string]: number } = {};
        
        cashflowRecords.filter(r => r.date >= sixMonthCutoff).forEach(r => {
            const month = r.date.slice(0, 7);
            if (!monthlyNet[month]) monthlyNet[month] = 0;
            monthlyNet[month] += r.type === 'income' ? r.amount : -r.amount;
        });

        const netValues = Object.values(monthlyNet);
        if (netValues.length === 0) return 0;
        
        const totalNet = netValues.reduce((sum, net) => sum + net, 0);
        return totalNet / netValues.length;
    }, [cashflowRecords]);

    const getAccountNames = (linkedIds: string[]) => 
        (linkedIds || [])
            .map(id => assetAccounts.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(', ') || '未連結';

    const processedGoals = useMemo(() => {
        return goals.map(goal => {
            // Dynamic calculation of current amount based on linked accounts
            const dynamicCurrentAmount = (goal.linkedAccountIds || []).reduce((sum, accountId) => {
                const account = assetAccounts.find(acc => acc.id === accountId);
                const accountTotal = (account?.assets || []).reduce((accSum, asset) => accSum + (asset.currentValueTWD || 0), 0);
                return sum + accountTotal;
            }, 0);

            // Use dynamic amount if accounts are linked, otherwise use the saved amount
            const currentAmount = (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) ? dynamicCurrentAmount : (goal.currentAmount || 0);
            
            return {
                ...goal,
                currentAmount, // Overwrite with the dynamically calculated value
            };
        });
    }, [goals, assetAccounts]);

    return (
        <Card>
            <PageHeader title="財務目標進度" subtitle="此頁面為您的目標進度。如需新增或修改目標，請前往「資料管理」頁面。" />
            {processedGoals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {processedGoals.map(goal => {
                        const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                        const isCompleted = progress >= 100;
                        const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
                        
                        let projection = null;
                        if (!isCompleted && averageMonthlySavings > 0 && remainingAmount > 0) {
                            const monthsToGoal = Math.ceil(remainingAmount / averageMonthlySavings);
                            const completionDate = new Date();
                            completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
                            projection = `${monthsToGoal} 個月後 (${completionDate.getFullYear()}/${completionDate.getMonth() + 1})`;
                        }

                        return (
                            <div key={goal.id} className="p-5 border rounded-lg shadow-sm bg-white transition-transform transform hover:-translate-y-1 hover:shadow-lg flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center">
                                            {isCompleted && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                            {goal.name}
                                        </h3>
                                        <p className="text-xs text-gray-500">連結帳戶: {getAccountNames(goal.linkedAccountIds)}</p>
                                    </div>
                                    <span className="text-sm text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{goal.targetDate}</span>
                                </div>
                                <p className="text-gray-700 text-sm mt-4">
                                    進度: ${goal.currentAmount.toLocaleString(undefined, {maximumFractionDigits: 0})} / <span className="font-medium">${goal.targetAmount.toLocaleString()}</span>
                                </p>
                                
                                <div className="mt-2 mb-4">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-medium text-blue-700">進度</span>
                                        <span className="text-sm font-medium text-blue-700">{progress.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-1000 ease-out" 
                                            style={{ width: `${progress}%` }}
                                            aria-valuenow={progress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            role="progressbar"
                                            aria-label={`${goal.name} progress`}
                                        ></div>
                                    </div>
                                </div>
                                <div className="mt-auto pt-4 border-t border-gray-100">
                                     {isCompleted ? (
                                        <div className="text-center font-semibold text-green-600">恭喜！目標已達成！</div>
                                     ) : (
                                        <div className="text-xs text-gray-600">
                                            <div className="flex justify-between">
                                                <span>尚需金額:</span>
                                                <span className="font-medium">${remainingAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>預計達成時間:</span>
                                                <span className="font-medium">{projection || '需正向儲蓄'}</span>
                                            </div>
                                        </div>
                                     )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <EmptyState 
                    Icon={GoalEmptyIcon}
                    title="尚無財務目標"
                    message="設定您的第一個財務目標，例如「購車基金」或「房屋頭期款」，並開始追踪您的進度！"
                />
            )}
        </Card>
    );
};

export default FinancialGoals;