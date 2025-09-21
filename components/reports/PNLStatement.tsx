import React, { useState, useMemo } from 'react';
import { AssetAccount, Asset } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';

interface PNLData extends Asset {
    pnlPercentage: number;
    accountName?: string;
}

type SortableKeys = 'code' | 'profitLossTWD' | 'pnlPercentage' | 'currentValueTWD' | 'costTWD' | 'accountName' | 'accountType';

interface PNLStatementProps {
    assetAccounts: AssetAccount[];
    onBack: () => void;
}

const PNLStatement: React.FC<PNLStatementProps> = ({ assetAccounts, onBack }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'asc' | 'desc' }>({ key: 'profitLossTWD', direction: 'desc' });

    const { pnlData, totalValue, totalCost, totalPNL, overallROI, bestPerformer, topGainer } = useMemo(() => {
        const investmentAssets = assetAccounts
            .flatMap(acc => (acc.assets || []).map(asset => ({...asset, accountName: acc.name})))
            .filter(asset => asset.accountType === '股票' || asset.accountType === 'ETF' || asset.accountType === '美元資產');

        if (investmentAssets.length === 0) {
            return { pnlData: [], totalValue: 0, totalCost: 0, totalPNL: 0, overallROI: 0, bestPerformer: null, topGainer: null };
        }

        const processedData: PNLData[] = investmentAssets.map(asset => {
            const cost = asset.costTWD || 0;
            const pnl = asset.profitLossTWD || 0;
            const pnlPercentage = cost > 0 ? (pnl / cost) * 100 : 0;
            return { ...asset, pnlPercentage };
        });
        
        const bestPerformer = [...processedData].sort((a, b) => (b.profitLossTWD || 0) - (a.profitLossTWD || 0))[0];
        const topGainer = [...processedData].sort((a, b) => b.pnlPercentage - a.pnlPercentage)[0];

        const totalValue = processedData.reduce((sum, a) => sum + (a.currentValueTWD || 0), 0);
        const totalCost = processedData.reduce((sum, a) => sum + (a.costTWD || 0), 0);
        const totalPNL = totalValue - totalCost;
        const overallROI = totalCost > 0 ? (totalPNL / totalCost) * 100 : 0;

        return { pnlData: processedData, totalValue, totalCost, totalPNL, overallROI, bestPerformer, topGainer };
    }, [assetAccounts]);

    const sortedData = useMemo(() => {
        return [...pnlData].sort((a, b) => {
            const valA = a[sortConfig.key] || (sortConfig.key === 'code' ? '' : 0);
            const valB = b[sortConfig.key] || (sortConfig.key === 'code' ? '' : 0);

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [pnlData, sortConfig]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    const headers: { key: SortableKeys; label: string; className?: string }[] = [
        { key: 'code', label: '資產代號' },
        { key: 'accountType', label: '類型' },
        { key: 'accountName', label: '帳戶' },
        { key: 'costTWD', label: '總成本 (TWD)', className: 'text-right' },
        { key: 'currentValueTWD', label: '現值 (TWD)', className: 'text-right' },
        { key: 'profitLossTWD', label: '損益 (TWD)', className: 'text-right' },
        { key: 'pnlPercentage', label: '損益 (%)', className: 'text-right' },
    ];

    return (
        <Card>
            <div className="flex justify-between items-start mb-6">
                <PageHeader title="詳細投資損益表" subtitle="此為您目前所有投資項目的總損益。注意：因缺乏歷史數據，尚不支援依日期範圍篩選。" />
                <button onClick={onBack} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 font-medium h-fit whitespace-nowrap shadow-sm transition-colors">
                    ← 返回總覽
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className={`p-4 rounded-lg text-center shadow-sm ${totalPNL >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className={`text-sm font-semibold ${totalPNL >= 0 ? 'text-green-800' : 'text-red-800'}`}>總損益 (TWD)</h3>
                    <p className={`text-2xl font-bold ${totalPNL >= 0 ? 'text-green-900' : 'text-red-900'}`}>{totalPNL.toLocaleString(undefined, { maximumFractionDigits: 0, signDisplay: 'always' })}</p>
                </div>
                <div className={`p-4 rounded-lg text-center shadow-sm ${overallROI >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className={`text-sm font-semibold ${overallROI >= 0 ? 'text-green-800' : 'text-red-800'}`}>總投資回報率 (ROI)</h3>
                    <p className={`text-2xl font-bold ${overallROI >= 0 ? 'text-green-900' : 'text-red-900'}`}>{overallROI.toFixed(2)}%</p>
                </div>
                 <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-sm">
                    <h3 className="text-sm font-semibold text-blue-800">最佳貢獻 (依金額)</h3>
                    {bestPerformer ? (
                       <>
                         <p className="text-xl font-bold text-blue-900 truncate">{bestPerformer.code}</p>
                         <p className="text-sm font-medium text-green-600">+{ (bestPerformer.profitLossTWD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) } 元</p>
                       </>
                    ) : <p className="text-gray-500 pt-2">-</p>}
                </div>
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-center shadow-sm">
                    <h3 className="text-sm font-semibold text-indigo-800">最高回報 (依 ROI)</h3>
                     {topGainer ? (
                       <>
                         <p className="text-xl font-bold text-indigo-900 truncate">{topGainer.code}</p>
                         <p className="text-sm font-medium text-green-600">+{topGainer.pnlPercentage.toFixed(2)}%</p>
                       </>
                    ) : <p className="text-gray-500 pt-2">-</p>}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            {headers.map(header => (
                                <th
                                    key={header.key}
                                    scope="col"
                                    className={`py-3 px-6 cursor-pointer hover:bg-gray-200 transition-colors ${header.className || ''}`}
                                    onClick={() => requestSort(header.key)}
                                >
                                    {header.label} {getSortIndicator(header.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((asset, index) => {
                            const pnl = asset.profitLossTWD || 0;
                            const isProfit = pnl >= 0;
                            return (
                                <tr key={asset.id || index} className="bg-white border-b hover:bg-gray-50">
                                    <td className="py-4 px-6 font-medium text-gray-900">{asset.code}</td>
                                    <td className="py-4 px-6 text-gray-600">{asset.accountType}</td>
                                    <td className="py-4 px-6 text-gray-600">{asset.accountName}</td>
                                    <td className="py-4 px-6 text-right">{(asset.costTWD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
                     <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                        <tr className="font-bold text-gray-800">
                            <td className="py-3 px-6" colSpan={3}>總計</td>
                            <td className="py-3 px-6 text-right">{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="py-3 px-6 text-right">{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className={`py-3 px-6 text-right ${totalPNL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalPNL.toLocaleString(undefined, { maximumFractionDigits: 0, signDisplay: 'always' })}
                            </td>
                            <td className={`py-3 px-6 text-right ${overallROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {overallROI.toFixed(2)}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
                 {sortedData.length === 0 && <p className="text-center text-gray-500 py-8">無投資項目可供分析。</p>}
            </div>
        </Card>
    );
};

export default PNLStatement;