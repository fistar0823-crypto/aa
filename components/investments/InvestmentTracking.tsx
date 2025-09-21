import React, { useMemo, useRef, useEffect, useState } from 'react';
import Chart from 'chart.js/auto';
import { AssetAccount } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import EmptyState from '../shared/EmptyState';

const InvestmentEmptyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const InvestmentTracking: React.FC<{ assetAccounts: AssetAccount[] }> = ({ assetAccounts }) => {
    const [simulatedAccounts, setSimulatedAccounts] = useState<AssetAccount[] | null>(null);
    const portfolioChartRef = useRef<HTMLCanvasElement>(null);
    const portfolioChartInstance = useRef<Chart | null>(null);

    const accountsToDisplay = simulatedAccounts || assetAccounts;

    const investmentData = useMemo(() => {
        const allAssets = accountsToDisplay.flatMap(acc => (acc.assets || []).map(asset => ({...asset, accountName: acc.name})))
            .filter(asset => asset.accountType === '股票' || asset.accountType === 'ETF');

        if (allAssets.length === 0) {
            return { totalValue: 0, totalCost: 0, totalPNL: 0, roi: 0, assets: [], best: null, worst: null, concentration: 0, topAsset: null, stockPercentage: 0, numberOfAssets: 0 };
        }

        const totalValue = allAssets.reduce((sum, asset) => sum + (asset.currentValueTWD || 0), 0);
        const totalCost = allAssets.reduce((sum, asset) => sum + (asset.costTWD || 0), 0);
        const totalPNL = totalValue - totalCost;
        const roi = totalCost > 0 ? (totalPNL / totalCost) * 100 : 0;
        
        const assetsWithPerf = allAssets.map(asset => {
            const pnl = asset.profitLossTWD || 0;
            const cost = asset.costTWD || 0;
            const assetRoi = cost > 0 ? (pnl / cost) * 100 : 0;
            return {...asset, pnl, roi: assetRoi};
        }).sort((a,b) => b.pnl - a.pnl);
        
        const best = assetsWithPerf[0];
        const worst = assetsWithPerf[assetsWithPerf.length - 1];

        const topAsset = [...assetsWithPerf].sort((a,b) => (b.currentValueTWD ?? 0) - (a.currentValueTWD ?? 0))[0];
        const concentration = totalValue > 0 && topAsset ? ((topAsset.currentValueTWD ?? 0) / totalValue) * 100 : 0;
        
        const stockValue = allAssets.filter(a => a.accountType === '股票').reduce((sum, a) => sum + (a.currentValueTWD || 0), 0);
        const stockPercentage = totalValue > 0 ? (stockValue / totalValue) * 100 : 0;
        const numberOfAssets = allAssets.length;

        return { totalValue, totalCost, totalPNL, roi, assets: assetsWithPerf, best, worst, topAsset, concentration, stockPercentage, numberOfAssets };
    }, [accountsToDisplay]);

    const handleSimulate = () => {
        const currentData = simulatedAccounts || assetAccounts;
        const newSimulatedAccounts = JSON.parse(JSON.stringify(currentData)).map((account: AssetAccount) => ({
            ...account,
            assets: (account.assets || []).map(asset => {
                if (asset.accountType === '股票' || asset.accountType === 'ETF') {
                    const changePercent = (Math.random() - 0.45) * 0.1; // -4.5% to +5.5% change
                    const newCurrentValueTWD = (asset.currentValueTWD || 0) * (1 + changePercent);
                    return { ...asset, currentValueTWD: newCurrentValueTWD, profitLossTWD: newCurrentValueTWD - (asset.costTWD || 0) };
                }
                return asset;
            })
        }));
        setSimulatedAccounts(newSimulatedAccounts);
    };
    
    const handleResetSimulation = () => {
        setSimulatedAccounts(null);
    };

    const getInvestmentInsights = () => {
        const { best, worst, concentration, topAsset, stockPercentage, numberOfAssets } = investmentData;
        const insights = [];
        
        if (numberOfAssets === 0) {
            insights.push({ title: "開始您的投資", message: `您尚未加入任何投資項目。前往「資料管理」新增您的股票或ETF，開始追蹤績效。`, type: "info" });
            return insights;
        }

        // Risk Level Analysis
        if (stockPercentage > 60) {
            insights.push({ title: "風險等級: 偏高", message: `您的投資組合偏向高風險，個股佔比達 ${stockPercentage.toFixed(1)}%。`, type: "warning" });
        } else if (stockPercentage < 30) {
            insights.push({ title: "風險等級: 穩健", message: `您的投資組合偏向穩健，個股佔比為 ${stockPercentage.toFixed(1)}%。`, type: "success" });
        } else {
            insights.push({ title: "風險等級: 適中", message: `您的投資組合風險適中，個股佔比為 ${stockPercentage.toFixed(1)}%。`, type: "info" });
        }

        // Diversification Analysis
        if (concentration > 40) {
            insights.push({ title: "風險集中警告", message: `您的資金過度集中於「${topAsset?.code}」，佔總投資額的 ${concentration.toFixed(1)}%。`, type: "warning" });
        }
        if (numberOfAssets < 5) {
             insights.push({ title: "分散度提醒", message: `您目前僅持有 ${numberOfAssets} 項投資標的，可考慮增加持股以提高分散性。`, type: "info" });
        }

        // Performance Highlights
        if (best) insights.push({ title: "最佳貢獻", message: `「${best.code}」是您目前獲利最高的資產，貢獻了 ${best.pnl.toLocaleString()} 元的收益。`, type: "info" });
        if (worst && worst.pnl < 0) insights.push({ title: "主要虧損來源", message: `「${worst.code}」是您目前虧損最多的資產，虧損達 ${worst.pnl.toLocaleString()} 元。`, type: "warning" });
        
        return insights;
    };

    const getRebalancingSuggestions = () => {
        const { stockPercentage, concentration, topAsset, numberOfAssets } = investmentData;
        const suggestions: string[] = [];
        let isBalanced = false;

        if (numberOfAssets === 0) return { suggestions: [], isBalanced: false };

        if (stockPercentage > 60) suggestions.push("考慮增加指數型ETF的比重，以分散個股風險並降低波動性。");
        if (concentration > 40) suggestions.push(`建議適度減持「${topAsset?.code}」，並將資金分配到其他資產中。`);
        if (numberOfAssets < 5) suggestions.push("研究並增加新的投資標的，以提高投資組合的多元性。");
        
        if (suggestions.length === 0) {
            isBalanced = true;
            suggestions.push("您的投資組合目前配置均衡，無需立即進行重大調整。繼續保持監控！");
        }
        
        return { suggestions, isBalanced };
    };

    useEffect(() => {
        if (portfolioChartRef.current && investmentData.assets.length > 0) {
            if (portfolioChartInstance.current) portfolioChartInstance.current.destroy();
            
            const ctx = portfolioChartRef.current.getContext('2d');
            if (ctx) {
                const portfolioBreakdown = investmentData.assets.reduce((acc, asset) => {
                    const key = asset.code;
                    acc[key] = (acc[key] || 0) + (asset.currentValueTWD ?? 0);
                    return acc;
                }, {} as {[key: string]: number});

                portfolioChartInstance.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels: Object.keys(portfolioBreakdown), datasets: [{ data: Object.values(portfolioBreakdown), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'], borderColor: '#fff', borderWidth: 2, hoverOffset: 8 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 20 } }, title: { display: true, text: '投資組合佔比' } } }
                });
            }
        }
        return () => { if (portfolioChartInstance.current) portfolioChartInstance.current.destroy(); };
    }, [investmentData]);
    
    const insights = getInvestmentInsights();
    const { suggestions, isBalanced } = getRebalancingSuggestions();
    const cardColors = {
        success: 'bg-green-100 border-green-400 text-green-800',
        warning: 'bg-yellow-100 border-yellow-400 text-yellow-800',
        info: 'bg-blue-100 border-blue-400 text-blue-800',
    };

    return (
        <Card>
            <PageHeader title="投資追蹤 & 智慧分析" />
            {assetAccounts.length === 0 || investmentData.numberOfAssets === 0 ? (
                <EmptyState 
                    Icon={InvestmentEmptyIcon}
                    title="開始追蹤您的投資"
                    message="您尚未新增任何股票或ETF資產。請前往「資料管理」新增您的投資項目，即可在此查看詳細的績效分析與智慧建議。"
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="p-4 bg-green-100 rounded-lg text-center shadow-sm"><h3 className="text-sm font-semibold text-green-800">總投資價值 (TWD)</h3><p className="text-2xl font-bold text-green-900">${investmentData.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div>
                        <div className={`p-4 rounded-lg text-center shadow-sm ${investmentData.totalPNL >= 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}><h3 className="text-sm font-semibold">總損益 (TWD)</h3><p className={`text-2xl font-bold ${investmentData.totalPNL >= 0 ? 'text-blue-900' : 'text-red-900'}`}>{investmentData.totalPNL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div>
                        <div className="p-4 bg-purple-100 rounded-lg text-center shadow-sm"><h3 className="text-sm font-semibold text-purple-800">總投資回報率</h3><p className="text-2xl font-bold text-purple-900">{investmentData.roi.toFixed(2)}%</p></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 space-y-6">
                            <Card className="h-96 flex flex-col">
                                <h3 className="text-xl font-semibold mb-2 text-gray-800 text-center">投資組合分佈</h3>
                                <div className="relative flex-grow h-full">
                                    <canvas ref={portfolioChartRef}></canvas>
                                </div>
                            </Card>
                            <Card>
                                <h3 className="text-xl font-semibold mb-4 text-gray-800">資產詳細表現</h3>
                                <div className="overflow-x-auto max-h-96 shadow-inner rounded-lg bg-gray-50">
                                    <table className="w-full text-sm text-left"><thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0"><tr><th className="py-2 px-4">代號</th><th className="py-2 px-4">帳戶</th><th className="py-2 px-4">損益(TWD)</th><th className="py-2 px-4">回報率</th></tr></thead>
                                        <tbody>
                                            {investmentData.assets.map(asset => (
                                                <tr key={asset.id} className="bg-white border-b">
                                                    <td className="py-2 px-4 font-medium">{asset.code}</td><td className="py-2 px-4 text-gray-600">{asset.accountName}</td>
                                                    <td className={`py-2 px-4 font-semibold ${asset.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{asset.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                    <td className={`py-2 px-4 font-semibold ${asset.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{asset.roi.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            <Card className="bg-gray-50">
                                <h3 className="text-xl font-semibold text-gray-800 mb-3">"What-If" 壓力測試</h3>
                                <p className="text-xs text-gray-600 mb-4">模擬市場波動對您投資組合的影響，此操作不會儲存。</p>
                                <div className="flex space-x-2">
                                    <button onClick={handleSimulate} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg font-semibold flex items-center justify-center text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        執行市場模擬
                                    </button>
                                    {simulatedAccounts && (
                                        <button onClick={handleResetSimulation} className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors shadow-lg font-semibold flex items-center justify-center text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M5 12a7 7 0 0011.66 4.995M20 20v-5h-5" /></svg>
                                            重置為原始數據
                                        </button>
                                    )}
                                </div>
                                {simulatedAccounts && <p className="text-center text-indigo-700 text-xs mt-3 font-semibold">模擬模式已啟用</p>}
                            </Card>
                            <Card>
                                <h3 className="text-xl font-semibold text-gray-800 mb-3">投資組合洞察</h3>
                                <div className="space-y-3">
                                {insights.map((insight, index) => (
                                    <div key={index} className={`p-3 border-l-4 rounded-r-lg ${cardColors[insight.type]}`}>
                                        <h4 className="font-bold text-sm">{insight.title}</h4>
                                        <p className="text-xs">{insight.message}</p>
                                    </div>
                                ))}
                                </div>
                            </Card>
                            <Card className="bg-teal-50 border border-teal-200">
                                <h3 className="text-xl font-semibold text-teal-800 mb-4 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    智慧再平衡建議
                                </h3>
                                {!isBalanced ? (
                                    <ul className="space-y-3">
                                        {suggestions.map((suggestion, index) => (
                                            <li key={index} className="flex items-start">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 mt-0.5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                                <span className="text-teal-900 text-sm">{suggestion}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <p className="text-green-900 text-sm font-medium">
                                            {suggestions[0]}
                                        </p>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
};

export default InvestmentTracking;