import React, { useState, useMemo } from 'react';
import { CashflowRecord } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import EmptyState from '../shared/EmptyState';

const CashflowEmptyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const ITEMS_PER_PAGE = 25;

const CashflowManagement: React.FC<{ cashflowRecords: CashflowRecord[] }> = ({ cashflowRecords }) => {
    type SortKey = keyof CashflowRecord;
    type SortDirection = 'ascending' | 'descending';

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    
    const currentMonth = new Date().toISOString().slice(0, 7);

    const currentMonthSummary = useMemo(() => {
        const records = cashflowRecords.filter(r => r.date.startsWith(currentMonth));
        const income = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
        const expense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
        const net = income - expense;
        return { income, expense, net };
    }, [cashflowRecords, currentMonth]);
    
    const sortedRecords = useMemo(() => {
        setCurrentPage(1); // Reset to first page on sort
        if (cashflowRecords.length === 0) return [];
        let sortableItems = [...cashflowRecords];
        sortableItems.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aVal > bVal) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
        return sortableItems;
    }, [cashflowRecords, sortConfig]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedRecords, currentPage]);

    const totalPages = Math.ceil(sortedRecords.length / ITEMS_PER_PAGE);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const headers: { key: SortKey; label: string }[] = [
        { key: 'date', label: '日期' },
        { key: 'type', label: '類型' },
        { key: 'category', label: '類別' },
        { key: 'amount', label: '金額' },
        { key: 'currency', label: '幣別' },
        { key: 'accountName', label: '帳戶' },
        { key: 'description', label: '說明' },
    ];

    return (
        <Card>
            <PageHeader title="收支管理 & 帳本" subtitle="此頁面為您的收支記錄。如需新增、編輯或刪除記錄，請前往「資料管理」頁面。" />
            
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">本月 ({currentMonth}) 財務快照</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm font-medium text-green-600">總收入</p>
                        <p className="text-2xl font-bold text-green-700">${currentMonthSummary.income.toLocaleString()}</p>
                    </div>
                     <div>
                        <p className="text-sm font-medium text-red-600">總支出</p>
                        <p className="text-2xl font-bold text-red-700">${currentMonthSummary.expense.toLocaleString()}</p>
                    </div>
                     <div>
                        <p className="text-sm font-medium text-blue-600">淨儲蓄</p>
                        <p className={`text-2xl font-bold ${currentMonthSummary.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>${currentMonthSummary.net.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                {cashflowRecords.length > 0 ? (
                    <>
                    <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    {headers.map(({ key, label }) => (
                                        <th key={key} scope="col" className="py-3 px-6 cursor-pointer" onClick={() => requestSort(key)}>
                                            {label}
                                            {sortConfig.key === key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRecords.map(record => (
                                    <tr key={record.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="py-4 px-6">{record.date}</td>
                                        <td className={`py-4 px-6 font-medium ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{record.type === 'income' ? '收入' : '支出'}</td>
                                        <td className="py-4 px-6">{record.category}</td>
                                        <td className="py-4 px-6">{record.amount.toLocaleString()}</td>
                                        <td className="py-4 px-6">{record.currency || 'TWD'}</td>
                                        <td className="py-4 px-6 text-gray-600">{record.accountName || 'N/A'}</td>
                                        <td className="py-4 px-6 max-w-xs truncate" title={record.description || 'N/A'}>{record.description || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                            上一頁
                          </button>
                          <span className="text-sm text-gray-700">第 {currentPage} 頁 / 共 {totalPages} 頁</span>
                          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                            下一頁
                          </button>
                        </div>
                      )}
                    </>
                ) : (
                    <EmptyState 
                        Icon={CashflowEmptyIcon}
                        title="目前沒有收支記錄"
                        message="請前往「資料管理」頁面的「收支管理」分頁，開始記錄您的第一筆收入或支出。"
                    />
                )}
            </div>
        </Card>
    );
};

export default CashflowManagement;