
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Chart, { TooltipItem } from 'chart.js/auto';
import { AssetAccount, CashflowRecord } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import PNLStatement from './PNLStatement';

const ReportAndAnalysis: React.FC<{ assetAccounts: AssetAccount[]; cashflowRecords: CashflowRecord[] }> = ({ assetAccounts, cashflowRecords }) => {
    const [analysisMonth, setAnalysisMonth] = useState(new Date().toISOString().slice(0, 7));
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
    const [view, setView] = useState<'main' | 'pnl'>('main');
    
    const trendChartRef = useRef<HTMLCanvasElement>(null);
    const expenseChartRef = useRef<HTMLCanvasElement>(null);
    const netWorthTrendChartRef = useRef<HTMLCanvasElement>(null);
    
    const analysisData = useMemo(() => {
        const monthlySummaries: {[key:string]: {income: number, expense: number, net: number}} = {};
        const today = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = d.toISOString().slice(0, 7);
            monthlySummaries[monthKey] = { income: 0, expense: 0, net: 0 };
        }
        
        cashflowRecords.forEach(record => {
            const monthKey = record.date.slice(0, 7);
            if (monthlySummaries[monthKey]) {
                if (record.type === 'income') monthlySummaries[monthKey].income += record.amount;
                else monthlySummaries[monthKey].expense += record.amount;
            }
        });

        Object.keys(monthlySummaries).forEach(key => {
            monthlySummaries[key].net = monthlySummaries[key].income - monthlySummaries[key].expense;
        });
        
        const expenseBreakdown = cashflowRecords
            .filter(r => r.date.startsWith(analysisMonth) && r.type === 'expense')
            .reduce((acc, r) => {
                acc[r.category] = (acc[r.category] || 0) + r.amount;
                return acc;
            }, {} as {[key: string]: number});
        
        const totalAssets = assetAccounts.reduce((sum, acc) => sum + (acc.assets || []).reduce((s, asset) => s + (asset.currentValueTWD || 0), 0), 0);
        
        const allAssets = assetAccounts.flatMap(acc => acc.assets || []);
        const pnlReportData = allAssets.map(asset => {
            const cost = asset.costTWD || 0;
            const pnl = asset.profitLossTWD || 0;
            const pnlPercentage = cost > 0 ? (pnl / cost) * 100 : 0;
            return {
                ...asset,
                pnlPercentage,
            };
        });

        const sortedMonths = Object.keys(monthlySummaries).sort((a,b) => b.localeCompare(a));
        
        const totalPNL = pnlReportData.reduce((sum, asset) => sum + (asset.profitLossTWD || 0), 0);
        // This is a simplified simulation for trend visualization
        const monthlyPNL = (totalPNL / 12);

        let simulatedNetWorth = totalAssets;
        const netWorthTrendData = [];
        for (const month of sortedMonths) {
            netWorthTrendData.push({ month, value: simulatedNetWorth });
            simulatedNetWorth -= (monthlySummaries[month].net + monthlyPNL);
        }
        netWorthTrendData.reverse();

        const currentMonthSummary = monthlySummaries[analysisMonth] || {income: 0, expense: 0};
        const savingsRate = currentMonthSummary.income > 0 ? ((currentMonthSummary.income - currentMonthSummary.expense) / currentMonthSummary.income) * 100 : 0;

        return { monthlySummaries, expenseBreakdown, pnlReportData, netWorthTrendData, kpis: { savingsRate: savingsRate.toFixed(1) } };
    }, [cashflowRecords, assetAccounts, analysisMonth]);

    const sortedPnlData = useMemo(() => {
        return [...analysisData.pnlReportData].sort((a, b) => {
            const pnlA = a.profitLossTWD || 0;
            const pnlB = b.profitLossTWD || 0;
            return sortDirection === 'desc' ? pnlB - pnlA : pnlA - pnlB;
        });
    }, [analysisData.pnlReportData, sortDirection]);

    useEffect(() => {
        if (view !== 'main') return;

        const instances: Chart[] = [];
        const commonTooltipOptions = {
            enabled: true,
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            titleFont: { size: 14, weight: 'bold' as const },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
        };
        
        // Trend Chart
        if (trendChartRef.current) {
            const existing = Chart.getChart(trendChartRef.current);
            if (existing) existing.destroy();
            
            const ctx = trendChartRef.current.getContext('2d');
            if (ctx) {
                const labels = Object.keys(analysisData.monthlySummaries);
                const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
                incomeGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
                incomeGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
                const expenseGradient = ctx.createLinearGradient(0, 0, 0, 400);
                expenseGradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
                expenseGradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');

                const trendChart = new Chart(trendChartRef.current, {
                    type: 'bar',
                    data: { labels, datasets: [
                        { label: '總收入', data: labels.map(l => analysisData.monthlySummaries[l].income), backgroundColor: incomeGradient, borderColor: 'rgba(59, 130, 246, 1)', hoverBackgroundColor: 'rgba(59, 130, 246, 1)', borderWidth: 1, borderRadius: 5 },
                        { label: '總支出', data: labels.map(l => analysisData.monthlySummaries[l].expense), backgroundColor: expenseGradient, borderColor: 'rgba(239, 68, 68, 1)', hoverBackgroundColor: 'rgba(239, 68, 68, 1)', borderWidth: 1, borderRadius: 5 }
                    ]},
                    options: { 
                        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                        plugins: { 
                            title: { display: true, text: '近12個月收支趨勢', font: { size: 16 } },
                            tooltip: { ...commonTooltipOptions, callbacks: {
                                title: (items: TooltipItem<'bar'>[]) => items[0].label,
                                label: (c) => ` ${c.dataset.label}: ${Number(c.raw).toLocaleString()} 元` 
                            }}
                        },
                        scales: { y: { beginAtZero: true, ticks: { callback: (v) => `${Number(v) / 1000}k` } }, x: { grid: { display: false } } }
                    }
                });
                instances.push(trendChart);
            }
        }

        // Expense Chart
        if (expenseChartRef.current) {
            const existing = Chart.getChart(expenseChartRef.current);
            if (existing) existing.destroy();
            const expenseLabels = Object.keys(analysisData.expenseBreakdown);
            const expenseData = Object.values(analysisData.expenseBreakdown);
            const totalExpense = expenseData.reduce((a, b) => a + b, 0);
            const expenseColors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#6366F1', '#F97316'];

            const expenseChart = new Chart(expenseChartRef.current, {
                type: 'doughnut',
                data: { labels: expenseLabels, datasets: [{ data: expenseData, backgroundColor: expenseColors, borderColor: '#fff', borderWidth: 3, hoverOffset: 15, hoverBorderColor: '#fff' }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { 
                        title: { display: false }, legend: { position: 'right' },
                        tooltip: { ...commonTooltipOptions, callbacks: {
                            title: (items: TooltipItem<'doughnut'>[]) => items[0].label,
                            label: (c) => {
                                const value = c.raw as number;
                                const percentage = totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : 0;
                                return `金額: ${value.toLocaleString()} 元 (${percentage}%)`;
                            }
                        }}
                    } 
                }
            });
            instances.push(expenseChart);
        }

        // Net Worth Trend Chart
        if (netWorthTrendChartRef.current) {
            const existing = Chart.getChart(netWorthTrendChartRef.current);
            if (existing) existing.destroy();
            const ctx = netWorthTrendChartRef.current.getContext('2d');
            if (ctx) {
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(139, 92, 246, 0.7)');
                gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');
                const netWorthTrendChart = new Chart(netWorthTrendChartRef.current, {
                    type: 'line',
                    data: {
                        labels: analysisData.netWorthTrendData.map(d => d.month),
                        datasets: [{
                            label: '資產淨值趨勢 (TWD)', data: analysisData.netWorthTrendData.map(d => d.value),
                            borderColor: 'rgb(139, 92, 246)', backgroundColor: gradient,
                            tension: 0.4, fill: true, pointBackgroundColor: 'rgb(139, 92, 246)',
                            pointHoverBackgroundColor: '#fff', pointHoverBorderColor: 'rgb(139, 92, 246)',
                            pointRadius: 4, pointHoverRadius: 8, pointBorderWidth: 2, pointHoverBorderWidth: 3,
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                        plugins: {
                            title: { display: true, text: `資產淨值趨勢 (含投資損益模擬)`, font: { size: 16 } },
                            tooltip: { ...commonTooltipOptions, callbacks: {
                                title: (items: TooltipItem<'line'>[]) => `月份: ${items[0].label}`,
                                label: (c) => ` 淨值: ${Number(c.raw).toLocaleString()} 元`
                            }}
                        },
                        scales: { y: { ticks: { callback: (v) => `${Number(v) / 1000}k` } }, x: { grid: { display: false } } }
                    }
                });
                instances.push(netWorthTrendChart);
            }
        }

        return () => instances.forEach(i => i.destroy());
    }, [analysisData, view]);

    if (view === 'pnl') {
        return <PNLStatement assetAccounts={assetAccounts} onBack={() => setView('main')} />;
    }

    return (
        <Card>
            <PageHeader title="財務報表與分析" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-center">
                <div className="md:col-span-2 flex items-center space-x-4 bg-gray-50 p-4 rounded-lg border">
                    <label htmlFor="analysis-month-select" className="text-lg font-medium text-gray-700">分析月份:</label>
                    <input 
                        id="analysis-month-select"
                        type="month" 
                        value={analysisMonth} 
                        onChange={e => setAnalysisMonth(e.target.value)} 
                        className="p-2 border rounded-md shadow-sm"
                        aria-label="Select month for analysis"
                    />
                </div>
                <div className="p-4 bg-blue-100 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-blue-800">儲蓄率 ({analysisMonth})</h3>
                    <p className="text-3xl font-bold text-blue-900">{analysisData.kpis.savingsRate}%</p>
                    <p className="text-xs text-blue-700">(收入 - 支出) / 收入</p>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border mb-8">
                <h3 className="text-xl font-semibold text-gray-800">近12個月收支趨勢</h3>
                <p className="text-xs text-gray-500 mb-2">將滑鼠懸停在圖表上以查看詳細數據。</p>
                <div className="h-96"><canvas ref={trendChartRef}></canvas></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg border h-96 flex flex-col">
                    <h3 className="text-xl font-semibold text-gray-800 text-center">{analysisMonth} 支出分類</h3>
                    <p className="text-xs text-gray-500 mb-2 text-center">將滑鼠懸停在圓環圖上以查看百分比。</p>
                    <div className="relative flex-grow h-full">
                         <canvas ref={expenseChartRef}></canvas>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border h-96 flex flex-col">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">資產淨值趨勢</h3>
                    <p className="text-xs text-gray-500 mb-2">將滑鼠懸停在圖表上以查看每月淨值。</p>
                    <div className="relative flex-grow h-full">
                        <canvas ref={netWorthTrendChartRef}></canvas>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">* 此圖表基於歷史收支淨額，並將總投資損益平均分配至過去12個月進行模擬。</p>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">資產損益總表</h3>
                    <button 
                        onClick={() => setView('pnl')}
                        className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors shadow-sm font-semibold flex items-center"
                    >
                        查看詳細報表
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="py-3 px-6">資產代號</th>
                                <th scope="col" className="py-3 px-6">類型</th>
                                <th scope="col" className="py-3 px-6 text-right">現值 (TWD)</th>
                                <th 
                                    scope="col" 
                                    className="py-3 px-6 text-right cursor-pointer"
                                    onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                                >
                                    損益 (TWD) {sortDirection === 'desc' ? '▼' : '▲'}
                                </th>
                                <th scope="col" className="py-3 px-6 text-right">損益 (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPnlData.slice(0, 5).map((asset, index) => {
                                const pnl = asset.profitLossTWD || 0;
                                const isProfit = pnl >= 0;
                                return (
                                    <tr key={asset.id || index} className="bg-white border-b hover:bg-gray-50">
                                        <td className="py-4 px-6 font-medium text-gray-900">{asset.code}</td>
                                        <td className="py-4 px-6">{asset.accountType}</td>
                                        <td className="py-4 px-6 text-right">{(asset.currentValueTWD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className={`py-4 px-6 text-right font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                            {pnl.toLocaleString(undefined, { maximumFractionDigits: 0, signDisplay: 'always' })}
                                        </td>
                                        <td className={`py-4 px-6 text-right font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                            {asset.pnlPercentage.toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {sortedPnlData.length > 5 && <p className="text-center text-xs text-gray-500 pt-2">...及其他 {sortedPnlData.length - 5} 項資產。請至詳細報表查看。</p>}
                </div>
            </div>
        </Card>
    );
};

export default ReportAndAnalysis;
