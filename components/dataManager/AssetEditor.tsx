import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AssetAccount, Asset, NotificationType } from '../../types';

interface AssetEditorProps {
    userId: string;
    db: firebase.firestore.Firestore;
    assetAccounts: AssetAccount[];
    setNotification: (notification: NotificationType) => void;
    appId: string;
}

const AssetEditor: React.FC<AssetEditorProps> = ({ userId, db, assetAccounts, setNotification, appId }) => {
    const [accountName, setAccountName] = useState('');
    const [managingAccountId, setManagingAccountId] = useState('');
    
    const initialAssetForm: Omit<Asset, 'id' | 'currentValueTWD' | 'costTWD' | 'profitLossTWD'> & { id?: string } = { code: '', accountType: '股票', units: 0, cost: 0, currentValue: 0, currency: 'TWD' };
    const [assetFormData, setAssetFormData] = useState(initialAssetForm);
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

    useEffect(() => {
        if (!managingAccountId && assetAccounts.length > 0) {
            setManagingAccountId(assetAccounts[0].id);
        }
    }, [assetAccounts, managingAccountId]);

    const handleAddAccount = async () => {
        if (!accountName.trim()) return;
        await db.collection(`artifacts/${appId}/users/${userId}/assetAccounts`).add({ name: accountName, assets: [] });
        setAccountName('');
        setNotification({ message: '帳戶新增成功！', type: 'success', show: true });
    };

    const handleDeleteAccount = async (id: string) => {
        if (window.confirm('您確定嗎？這將會刪除該帳戶及其中的所有資產。')) {
            if (id === managingAccountId) setManagingAccountId('');
            await db.doc(`artifacts/${appId}/users/${userId}/assetAccounts/${id}`).delete();
            setNotification({ message: '帳戶已刪除。', type: 'success', show: true });
        }
    };

    const handleAssetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentAccount = assetAccounts.find(a => a.id === managingAccountId);
        if (!currentAccount) return;

        const parsedUnits = Number(assetFormData.units) || 0;
        const parsedCost = Number(assetFormData.cost) || 0;
        const parsedCurrentValue = Number(assetFormData.currentValue) || 0;

        let finalAssetData: Omit<Asset, 'id'>;

        switch (assetFormData.accountType) {
            case '現金':
                finalAssetData = { ...assetFormData, units: 1, cost: parsedCurrentValue, currentValue: parsedCurrentValue };
                break;
            case '不動產':
            case '美元資產':
                finalAssetData = { ...assetFormData, units: 1, cost: parsedCost, currentValue: parsedCurrentValue };
                break;
            default:
                finalAssetData = { ...assetFormData, units: parsedUnits, cost: parsedCost, currentValue: parsedCurrentValue };
                break;
        }
        
        const { id, ...dataToSave } = finalAssetData as unknown as Asset;

        let updatedAssets;
        if (editingAssetId) {
            updatedAssets = (currentAccount.assets || []).map(asset => 
                asset.id === editingAssetId ? { ...asset, ...dataToSave } : asset
            );
        } else {
            const newAsset = { ...dataToSave, id: Date.now().toString() };
            updatedAssets = [...(currentAccount.assets || []), newAsset];
        }

        await db.doc(`artifacts/${appId}/users/${userId}/assetAccounts/${managingAccountId}`).update({ assets: updatedAssets });
        setAssetFormData(initialAssetForm);
        setEditingAssetId(null);
        setNotification({ message: `資產${editingAssetId ? '更新' : '新增'}成功！`, type: 'success', show: true });
    };

    const handleFetchPrices = async () => {
         setNotification({ message: '正在模擬抓取最新市價...', type: 'info', show: true });
         for (const account of assetAccounts) {
             if (!account.assets || account.assets.length === 0) continue;
             const updatedAssets = (account.assets).map(asset => {
                  if (asset.accountType === '股票' || asset.accountType === 'ETF') {
                     const changePercent = (Math.random() - 0.45) * 0.1;
                     const newCurrentValue = parseFloat(String(asset.currentValue)) * (1 + changePercent);
                     return { ...asset, currentValue: newCurrentValue };
                  }
                  return asset;
             });
             await db.doc(`artifacts/${appId}/users/${userId}/assetAccounts/${account.id}`).update({ assets: updatedAssets });
         }
        setNotification({ message: '所有投資標的市價已更新！', type: 'success', show: true });
    };
    
    const handleEditAsset = (asset: Asset) => {
        setAssetFormData(asset);
        setEditingAssetId(asset.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteAsset = async (assetId: string) => {
        const currentAccount = assetAccounts.find(a => a.id === managingAccountId);
        if (!currentAccount) return;
        const updatedAssets = currentAccount.assets.filter(a => a.id !== assetId);
        await db.doc(`artifacts/${appId}/users/${userId}/assetAccounts/${managingAccountId}`).update({ assets: updatedAssets });
        setNotification({ message: '資產已刪除。', type: 'success', show: true });
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as Asset['accountType'];
        const isUsdAsset = newType === '美元資產';
        setAssetFormData({ ...initialAssetForm, accountType: newType, currency: isUsdAsset ? 'USD' : 'TWD' });
    };

    const renderAssetFormFields = () => {
        const commonClasses = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500";
        const renderField = (id: string, label: string, type: string, placeholder: string, value: string | number, name: keyof Asset) => (
            <div>
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input id={id} name={name} type={type} placeholder={placeholder} value={value}
                       onChange={e => setAssetFormData({...assetFormData, [name]: e.target.value})}
                       className={commonClasses} required />
            </div>
        );

        switch (assetFormData.accountType) {
            case '股票':
            case 'ETF':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("asset-code", "股票/ETF 代號*", "text", "例如: 2330, 0050, AAPL", assetFormData.code, "code")}
                        {renderField("asset-units", "持有股數/單位數*", "number", "例如: 1000 (股) or 2 (張)", assetFormData.units, "units")}
                        {renderField("asset-cost", "平均買入成本 (每股)*", "number", "例如: 650.5", assetFormData.cost, "cost")}
                        {renderField("asset-currentValue", "目前市價 (每股)*", "number", "例如: 680", assetFormData.currentValue, "currentValue")}
                    </div>
                );
            case '現金':
                 return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("asset-code", "現金項目名稱*", "text", "例如: 台幣活存、緊急備用金", assetFormData.code, "code")}
                        {renderField("asset-currentValue", "現金總額*", "number", "例如: 500000", assetFormData.currentValue, "currentValue")}
                    </div>
                );
            case '不動產':
                 return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("asset-code", "房產地址/名稱*", "text", "例如: 台北市信義區的房子", assetFormData.code, "code")}
                        {renderField("asset-cost", "購入總成本*", "number", "例如: 30000000", assetFormData.cost, "cost")}
                        {renderField("asset-currentValue", "目前估計市價*", "number", "例如: 45000000", assetFormData.currentValue, "currentValue")}
                    </div>
                );
            case '美元資產':
                 return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderField("asset-code", "資產名稱*", "text", "例如: 美元定存, 美元計價基金", assetFormData.code, "code")}
                        {renderField("asset-cost", "投入成本 (USD)*", "number", "例如: 10000", assetFormData.cost, "cost")}
                        {renderField("asset-currentValue", "目前價值 (USD)*", "number", "例如: 10500", assetFormData.currentValue, "currentValue")}
                    </div>
                );
            default:
                return null;
        }
    };
    
    const currentAssets = assetAccounts.find(a => a.id === managingAccountId)?.assets || [];

    return (
        <div className="space-y-6">
            <div className="p-6 border rounded-lg bg-gray-50 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">1. 管理資產帳戶</h3>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="新帳戶名稱 (例如: 富邦證券)" className="p-2 border rounded-md shadow-sm flex-grow" />
                    <button onClick={handleAddAccount} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 shadow-sm transition-colors">新增帳戶</button>
                </div>
                {assetAccounts.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-gray-600">現有帳戶:</p>
                        {assetAccounts.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center p-2 bg-white rounded-md border group">
                                <span className="text-gray-800">{acc.name}</span>
                                <button onClick={() => handleDeleteAccount(acc.id)} className="text-red-500 hover:text-red-700 text-sm opacity-50 group-hover:opacity-100 transition-opacity">刪除</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="p-6 border rounded-lg bg-white shadow-sm">
                 <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">2. 管理帳戶內的資產</h3>
                    <button onClick={handleFetchPrices} className="bg-blue-500 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-600 shadow-sm transition-colors w-full sm:w-auto">模擬獲取最新市價</button>
                 </div>
                <div className="mb-6">
                    <label htmlFor="managing-account-select" className="block text-sm font-medium text-gray-700 mb-1">選擇要管理的帳戶:</label>
                    <select id="managing-account-select" value={managingAccountId} onChange={e => setManagingAccountId(e.target.value)} className="w-full p-2 border rounded-md shadow-sm bg-white" disabled={assetAccounts.length === 0}>
                        <option value="">{assetAccounts.length > 0 ? "— 請選擇 —" : "請先新增一個帳戶"}</option>
                        {assetAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                </div>

                {managingAccountId && (
                    <>
                        <form onSubmit={handleAssetSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50 space-y-4">
                             <h4 className="font-semibold text-gray-700">{editingAssetId ? '編輯資產' : '新增資產'}</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="asset-type" className="block text-sm font-medium text-gray-700 mb-1">資產類型*</label>
                                    <select id="asset-type" value={assetFormData.accountType} onChange={handleTypeChange} className="w-full p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                                        <option value="股票">股票 (Stock)</option>
                                        <option value="ETF">ETF</option>
                                        <option value="現金">現金 (Cash)</option>
                                        <option value="不動產">不動產 (Real Estate)</option>
                                        <option value="美元資產">其他美元計價資產</option>
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="asset-currency" className="block text-sm font-medium text-gray-700 mb-1">幣別*</label>
                                    <select id="asset-currency" name="currency" value={assetFormData.currency} disabled={assetFormData.accountType === '美元資產'}
                                            onChange={e => setAssetFormData({...assetFormData, currency: e.target.value as any})}
                                            className="w-full p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100">
                                        <option value="TWD">TWD</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                            </div>
                            
                            {renderAssetFormFields()}
                           
                           <div className="col-span-full flex justify-end space-x-3 pt-2">
                               {editingAssetId && <button type="button" onClick={() => { setEditingAssetId(null); setAssetFormData(initialAssetForm); }} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 font-medium">取消編輯</button>}
                               <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium shadow-sm">{editingAssetId ? '更新資產' : '新增資產'}</button>
                           </div>
                        </form>

                        <h4 className="text-md font-medium mb-3 text-gray-700">帳戶資產列表</h4>
                        <div className="overflow-x-auto shadow-md rounded-lg">
                           <table className="min-w-full text-sm text-left text-gray-500">
                               <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                   <tr>
                                       <th scope="col" className="px-4 py-3">代號/名稱</th>
                                       <th scope="col" className="px-4 py-3">類型</th>
                                       <th scope="col" className="px-4 py-3 text-right">單位</th>
                                       <th scope="col" className="px-4 py-3 text-right">成本</th>
                                       <th scope="col" className="px-4 py-3 text-right">現價</th>
                                       <th scope="col" className="px-4 py-3">幣別</th>
                                       <th scope="col" className="px-4 py-3 text-center">操作</th>
                                   </tr>
                               </thead>
                               <tbody>
                                    {currentAssets.map(asset => (
                                        <tr key={asset.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                           <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{asset.code}</td>
                                           <td className="px-4 py-2">{asset.accountType}</td>
                                           <td className="px-4 py-2 text-right">{asset.units.toLocaleString()}</td>
                                           <td className="px-4 py-2 text-right">{asset.cost.toLocaleString()}</td>
                                           <td className="px-4 py-2 text-right">{asset.currentValue.toLocaleString()}</td>
                                           <td className="px-4 py-2">{asset.currency}</td>
                                           <td className="px-4 py-2 text-center">
                                               <button onClick={() => handleEditAsset(asset)} className="font-medium text-indigo-600 hover:text-indigo-900 mr-4">編輯</button>
                                               <button onClick={() => handleDeleteAsset(asset.id)} className="font-medium text-red-600 hover:text-red-900">刪除</button>
                                           </td>
                                        </tr>
                                    ))}
                               </tbody>
                           </table>
                           {currentAssets.length === 0 && <p className="text-center text-gray-500 py-6 bg-white">此帳戶尚無資產。</p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AssetEditor;
