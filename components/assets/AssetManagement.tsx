import React, { useState, useEffect, useMemo } from 'react';
import { AssetAccount, Asset } from '../../types';
import Card from '../shared/Card';
import PageHeader from '../shared/PageHeader';
import EmptyState from '../shared/EmptyState';

interface AssetManagementProps {
  assetAccounts: AssetAccount[];
}

const AccountEmptyIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
);

// Define the keys that can be sorted
type SortableAssetKeys = 'code' | 'currentValueTWD' | 'profitLossTWD';

const ITEMS_PER_PAGE = 15;

const AssetManagement: React.FC<AssetManagementProps> = ({ assetAccounts }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortableAssetKeys; direction: 'ascending' | 'descending' }>({ key: 'currentValueTWD', direction: 'descending' });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (assetAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(assetAccounts[0].id);
      setCurrentPage(1);
    } else if (assetAccounts.length > 0 && !assetAccounts.find(a => a.id === selectedAccountId)) {
      setSelectedAccountId(assetAccounts[0].id);
      setCurrentPage(1);
    } else if (assetAccounts.length === 0) {
      setSelectedAccountId(null);
    }
  }, [assetAccounts, selectedAccountId]);
  
  const currentAccount = assetAccounts.find(acc => acc.id === selectedAccountId);
  
  const currentAccountTotalValue = useMemo(() => {
    if (!currentAccount || !currentAccount.assets) return 0;
    return currentAccount.assets.reduce((sum, asset) => sum + (asset.currentValueTWD || 0), 0);
  }, [currentAccount]);

  // Memoized sorting of assets
  const sortedAssets = useMemo(() => {
    setCurrentPage(1); // Reset page on sort
    const assetsToSort = currentAccount?.assets;
    if (!assetsToSort) return [];
    
    const sortableAssets = [...assetsToSort];
    
    sortableAssets.sort((a, b) => {
        // Fallback to 0 or empty string for potentially undefined values
        const aValue = a[sortConfig.key] ?? (sortConfig.key === 'code' ? '' : 0);
        const bValue = b[sortConfig.key] ?? (sortConfig.key === 'code' ? '' : 0);
        
        if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    return sortableAssets;
  }, [currentAccount, sortConfig]);

  // Paginated assets
  const paginatedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAssets, currentPage]);

  const totalPages = Math.ceil(sortedAssets.length / ITEMS_PER_PAGE);


  // Function to handle sort requests
  const requestSort = (key: SortableAssetKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Helper to render sort indicator
  const getSortIndicator = (key: SortableAssetKeys) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  return (
    <Card>
      <PageHeader title="資產總覽" subtitle="此頁面為您的資產總覽。如需新增、編輯或刪除資產，請前往「資料管理」頁面。" />
      
      {assetAccounts.length === 0 ? (
         <div className="mt-8">
            <EmptyState 
                Icon={AccountEmptyIcon}
                title="尚未建立任何資產帳戶"
                message="請先至「資料管理」頁面的「資產管理」分頁新增您的第一個帳戶，再來此處查看總覽。"
            />
         </div>
      ) : (
      <>
        <div className="mb-6">
          <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mb-2">選擇資產帳戶:</label>
          <select
            id="account-select"
            className="mt-1 block w-full md:w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm"
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {assetAccounts.map(account => (<option key={account.id} value={account.id}>{account.name}</option>))}
          </select>
        </div>

        {currentAccount ? (
          <div className="mt-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 p-4 bg-gray-50 rounded-lg border">
                <h3 className="text-2xl font-semibold text-gray-800">{currentAccount.name} 的資產</h3>
                <div className="text-right">
                    <p className="text-sm text-gray-600">帳戶總價值 (TWD)</p>
                    <p className="text-2xl font-bold text-blue-600">${currentAccountTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
            </div>
            {currentAccount.assets && currentAccount.assets.length > 0 ? (
              <>
              <div className="overflow-x-auto relative shadow-md sm:rounded-lg mt-6">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3 px-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('code')}>
                        代號/名稱{getSortIndicator('code')}
                      </th>
                      <th scope="col" className="py-3 px-6">單位</th>
                      <th scope="col" className="py-3 px-6">成本</th>
                      <th scope="col" className="py-3 px-6">幣別</th>
                      <th scope="col" className="py-3 px-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('currentValueTWD')}>
                        當前價值 (TWD){getSortIndicator('currentValueTWD')}
                      </th>
                      <th scope="col" className="py-3 px-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('profitLossTWD')}>
                        損益 (TWD){getSortIndicator('profitLossTWD')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssets.map((asset: Asset, index) => {
                      const profitLoss = asset.profitLossTWD || 0;
                      return (
                        <tr key={asset.id || index} className="bg-white border-b hover:bg-gray-50">
                          <td className="py-4 px-6 font-medium text-gray-900 whitespace-nowrap">{asset.code}</td>
                          <td className="py-4 px-6">{asset.units.toLocaleString()}</td>
                          <td className="py-4 px-6">{asset.cost.toLocaleString()}</td>
                          <td className="py-4 px-6">{asset.currency}</td>
                          <td className="py-4 px-6">{(asset.currentValueTWD || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className={`py-4 px-6 font-semibold ${profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
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
            ) : (<p className="text-gray-500 text-center py-8">此帳戶中沒有資產，快去「資料管理」新增吧！</p>)}
          </div>
        ) : (<p className="text-center text-gray-500 py-12">請選擇一個帳戶以查看其資產。</p>)}
      </>
      )}
    </Card>
  );
};

export default AssetManagement;