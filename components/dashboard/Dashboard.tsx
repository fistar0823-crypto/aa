import React, { useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import { AssetAccount, CashflowRecord } from '../../types';
import { calculateAssetSummary, calculateHealthScore } from '../../utils/dataProcessing';
import { BUFFETT_TARGET } from '../../constants';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import EmptyState from '../shared/EmptyState';

interface DashboardProps {
  userId: string;
  assetAccounts: AssetAccount[];
  cashflowRecords: CashflowRecord[];
}

const ChartEmptyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
);

const FinancialHealthScore: React.FC<{ score: number; level: string; color: string; feedback: string[] }> = ({ score, level, color, feedback }) => {
    const circumference = 2 * Math.PI * 52; // Circle radius is 52
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <Card className="flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">財務健康分數</h3>
            <div className="relative w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e6e6e6" strokeWidth="8" />
                    <circle
                        cx="60" cy="60" r="52" fill="none"
                        className={`stroke-current ${color.replace('text-', 'stroke-')}`} // Use stroke color utility
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${color}`}>{score}</span>
                    <span className={`text-sm font-semibold ${color}`}>{level}</span>
                </div>
            </div>
            <div className="text-center mt-3 text-xs text-gray-500 w-full">
                {feedback.slice(0, 1).map((fb, i) => <p key={i}>{fb}</p>)}
            </div>
        </Card>
    );
};

const PortfolioInsightCard: React.FC<{ assetAccounts: AssetAccount[] }> = ({ assetAccounts }) => {
    const { total, breakdown } = calculateAssetSummary(assetAccounts);

    const getInsight = () => {
        if (total === 0) {
            return {
                title: '開始您的理財之旅',
                message: '您的資產組合目前是空的。請前往「資料管理」新增您的第一筆資產，開始追踪您的財務狀況！',
                icon: '🚀'
            };
        }

        const cashPercentage = (breakdown.find(b => b.type === '現金')?.value || 0) / total;
        const etfPercentage = (breakdown.find(b => b.type === 'ETF')?.value || 0) / total;
        const stockPercentage = (breakdown.find(b => b.type === '股票')?.value || 0) / total;
        
        const allInvestmentAssets = assetAccounts.flatMap(acc => acc.assets || []).filter(asset => ['股票', 'ETF'].includes(asset.accountType));
        const totalInvestmentValue = allInvestmentAssets.reduce((sum, asset) => sum + (asset.currentValueTWD || 0), 0);
        const topAsset = totalInvestmentValue > 0 ? [...allInvestmentAssets].sort((a, b) => (b.currentValueTWD ?? 0) - (a.currentValueTWD ?? 0))[0] : null;
        const concentration = totalInvestmentValue > 0 && topAsset ? ((topAsset.currentValueTWD ?? 0) / totalInvestmentValue) * 100 : 0;


        if (cashPercentage > 0.4) {
            return {
                title: '現金比例偏高',
                message: `您有超過 ${(cashPercentage * 100).toFixed(0)}% 的資產是現金。雖然保有流動性是好事，但考慮將部分閒置資金投入 ETF 或其他投資，可能會有更好的長期回報。`,
                icon: '💰'
            };
        }
        
        if (concentration > 40) {
             return {
                title: '注意投資集中風險',
                message: `您在「${topAsset?.code}」上的投資佔了投資組合的 ${concentration.toFixed(1)}%。這可能會帶來較高的風險。建議您考慮增加其他標的，以達到更好的分散效果。`,
                icon: '⚠️'
            };
        }

        if (etfPercentage < 0.3 && (stockPercentage > 0 || cashPercentage > 0.1)) {
            return {
                title: '建立穩健的投資核心',
                message: '您的 ETF 佔比目前較低。考慮增加指數型 ETF 的配置，這有助於建立一個分散風險、穩健增長的投資組合核心。',
                icon: '📈'
            };
        }

        return {
            title: '資產配置均衡',
            message: '您的資產配置看起來相當均衡。請繼續保持定期檢視，並根據您的財務目標進行調整。做得很好！',
            icon: '👍'
        };
    };

    const insight = getInsight();

    return (
        <Card>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <span className="text-2xl mr-2">{insight.icon}</span>
                投資組合洞察
            </h3>
            <div className="text-gray-600 text-base leading-relaxed h-full flex flex-col justify-center">
                 <p className="font-semibold text-gray-700 mb-1">{insight.title}</p>
                 <p className="text-sm">{insight.message}</p>
            </div>
        </Card>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ userId, assetAccounts, cashflowRecords }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const assetSummary = useMemo(() => calculateAssetSummary(assetAccounts), [assetAccounts]);
  const healthScoreData = useMemo(() => calculateHealthScore(assetAccounts, cashflowRecords), [assetAccounts, cashflowRecords]);
  
  const { total, breakdown, totalUsdAssetsInTwd } = assetSummary;

  const lastMonthSummary = useMemo(() => {
    const now = new Date();
    // Set to day 15 to avoid timezone issues with month changes
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    
    const lastMonthDate = new Date(firstDayOfCurrentMonth);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthMonth = lastMonthDate.getMonth();
    
    const lastMonthKey = `${lastMonthYear}-${String(lastMonthMonth + 1).padStart(2, '0')}`;

    const records = cashflowRecords.filter(record => record.date.startsWith(lastMonthKey));

    const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    return {
        totalIncome,
        totalExpense,
        netSavings,
        savingsRate,
        monthLabel: `${lastMonthYear}年${lastMonthMonth + 1}月`
    };
}, [cashflowRecords]);

  useEffect(() => {
    if (chartRef.current && total > 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      const ctx = chartRef.current.getContext('2d');
      if(ctx) {
        chartInstance.current = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: breakdown.map(asset => asset.type),
              datasets: [{
                data: breakdown.map(asset => asset.value),
                backgroundColor: breakdown.map(asset => asset.color),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 8
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { font: { size: 14, family: 'Inter, sans-serif' }, color: '#333', boxWidth: 20 } },
                title: { display: true, text: '資產配置圓餅圖', font: { size: 18, family: 'Inter, sans-serif' }, color: '#333' }
              }
            }
          });
      }
    } else if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [total, breakdown]);
  

  return (
    <div>
      <PageHeader title="您的個人財務導航中心" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-transform duration-300 relative overflow-hidden">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/10 rounded-full"></div>
            <div className="relative z-10">
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mr-2 opacity-75">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                    總資產顯示
                </h3>
                <p className="text-4xl font-bold mt-4">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-blue-200 text-sm mt-2">包含所有帳戶資產</p>
            </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-transform duration-300 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"></div>
            <div className="relative z-10">
                <h3 className="text-xl font-semibold mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 mr-2 opacity-75">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    美元計價資產總值 (TWD)
                </h3>
                <p className="text-4xl font-bold mt-4">${totalUsdAssetsInTwd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-emerald-100 text-sm mt-2">已轉換為新台幣</p>
            </div>
        </div>
        <FinancialHealthScore 
            score={healthScoreData.score} 
            level={healthScoreData.level}
            color={healthScoreData.levelColor}
            feedback={healthScoreData.feedback}
        />
        <PortfolioInsightCard assetAccounts={assetAccounts} />
      </div>
      
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">{lastMonthSummary.monthLabel} 財務摘要</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-green-50 border-green-200">
                <h4 className="text-md font-semibold text-green-800 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    總收入
                </h4>
                <p className="text-3xl font-bold text-green-900">${lastMonthSummary.totalIncome.toLocaleString()}</p>
            </Card>
            <Card className="bg-red-50 border-red-200">
                <h4 className="text-md font-semibold text-red-800 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    總支出
                </h4>
                <p className="text-3xl font-bold text-red-900">${lastMonthSummary.totalExpense.toLocaleString()}</p>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
                <h4 className="text-md font-semibold text-blue-800 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                    淨儲蓄
                </h4>
                <p className={`text-3xl font-bold ${lastMonthSummary.netSavings >= 0 ? 'text-blue-900' : 'text-red-900'}`}>${lastMonthSummary.netSavings.toLocaleString()}</p>
            </Card>
             <Card className="bg-purple-50 border-purple-200">
                <h4 className="text-md font-semibold text-purple-800 mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    儲蓄率
                </h4>
                <p className="text-3xl font-bold text-purple-900">{lastMonthSummary.savingsRate.toFixed(1)}%</p>
            </Card>
        </div>
      </div>

      <Card className="h-[450px]">
        {total > 0 ? (
          <canvas ref={chartRef}></canvas>
        ) : (
          <EmptyState 
              Icon={ChartEmptyIcon}
              title="尚無資產數據"
              message="新增您的第一個資產，開始視覺化您的財務狀況。"
          />
        )}
      </Card>

    </div>
  );
};

export default Dashboard;