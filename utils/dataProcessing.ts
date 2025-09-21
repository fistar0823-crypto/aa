import { AssetAccount, Asset, CashflowRecord } from '../types';
import { ASSET_TYPE_COLORS } from '../constants';

export const processAssetAccounts = (accounts: AssetAccount[], usdToTwdRate: number): AssetAccount[] => {
  return accounts.map(account => ({
    ...account,
    assets: (account.assets || []).map(asset => {
      const value = parseFloat(String(asset.currentValue)) || 0;
      const cost = parseFloat(String(asset.cost)) || 0;
      const units = parseFloat(String(asset.units)) || 0;
      const rate = asset.currency === 'USD' ? usdToTwdRate : 1;
      
      const currentValueTWD = value * units * rate;
      const costTWD = cost * units * rate;
      const profitLossTWD = currentValueTWD - costTWD;

      return { ...asset, currentValueTWD, costTWD, profitLossTWD };
    })
  }));
};

interface AssetSummary {
    total: number;
    breakdown: {
        type: string;
        value: number;
        color: string;
    }[];
    totalUsdAssetsInTwd: number;
}

export const calculateAssetSummary = (assetAccounts: AssetAccount[]): AssetSummary => {
    let total = 0;
    let totalUsdAssetsInTwd = 0;
    const breakdownMap: { [key: string]: { value: number; color: string } } = {
        '現金': { value: 0, color: ASSET_TYPE_COLORS['現金'] },
        'ETF': { value: 0, color: ASSET_TYPE_COLORS['ETF'] },
        '股票': { value: 0, color: ASSET_TYPE_COLORS['股票'] },
        '不動產': { value: 0, color: ASSET_TYPE_COLORS['不動產'] },
        '美元資產': { value: 0, color: ASSET_TYPE_COLORS['美元資產'] }
    };

    assetAccounts.forEach(account => {
        (account.assets || []).forEach((asset: Asset) => {
            const valueInTWD = asset.currentValueTWD || 0;
            total += valueInTWD;
            if (breakdownMap[asset.accountType]) {
                breakdownMap[asset.accountType].value += valueInTWD;
            }
            if (asset.currency === 'USD') {
                totalUsdAssetsInTwd += valueInTWD;
            }
        });
    });

    const breakdown = Object.keys(breakdownMap)
        .filter(key => breakdownMap[key].value > 0)
        .map(key => ({
            type: key,
            value: breakdownMap[key].value,
            color: breakdownMap[key].color
        }));

    return { total, breakdown, totalUsdAssetsInTwd };
};


// --- Financial Health Score Calculation ---
interface HealthScoreResult {
    score: number;
    feedback: string[];
    level: '優良' | '中等' | '待加強';
    levelColor: 'text-green-500' | 'text-yellow-500' | 'text-red-500';
}

export const calculateHealthScore = (assetAccounts: AssetAccount[], cashflowRecords: CashflowRecord[]): HealthScoreResult => {
    const { total, breakdown } = calculateAssetSummary(assetAccounts);
    if (total === 0) {
        return { score: 0, feedback: ['請先新增您的資產以進行評分。'], level: '待加強', levelColor: 'text-red-500' };
    }

    let score = 0;
    const feedback: string[] = [];

    // 1. Emergency Fund (Max 40 points)
    const expenseRecords = cashflowRecords.filter(r => r.type === 'expense');
    const months = new Map<string, number>();
    expenseRecords.forEach(record => {
        const monthKey = record.date.slice(0, 7);
        months.set(monthKey, (months.get(monthKey) || 0) + record.amount);
    });
    const totalExpenseOverMonths = Array.from(months.values()).reduce((sum, amount) => sum + amount, 0);
    const averageMonthlyExpense = months.size > 0 ? totalExpenseOverMonths / months.size : 0;
    const totalCash = breakdown.find(b => b.type === '現金')?.value || 0;
    const cashMonths = averageMonthlyExpense > 0 ? totalCash / averageMonthlyExpense : 0;

    if (averageMonthlyExpense === 0) {
        score += 10;
        feedback.push('尚無支出數據，無法評估緊急備用金。');
    } else if (cashMonths >= 3 && cashMonths <= 6) {
        score += 40;
        feedback.push(`緊急備用金充足 (${cashMonths.toFixed(1)}個月)，財務基礎穩固。`);
    } else if (cashMonths > 6) {
        score += 25;
        feedback.push(`現金持有稍多 (${cashMonths.toFixed(1)}個月)，可考慮將部分資金用於投資。`);
    } else if (cashMonths >= 1) {
        score += 15;
        feedback.push(`緊急備用金 (${cashMonths.toFixed(1)}個月) 略顯不足，建議提升至3-6個月。`);
    } else {
        score += 5;
        feedback.push(`緊急備用金嚴重不足 (${cashMonths.toFixed(1)}個月)，請優先儲蓄！`);
    }

    // 2. Investment Diversification (Max 30 points)
    const allInvestmentAssets = assetAccounts.flatMap(acc => acc.assets || []).filter(asset => ['股票', 'ETF'].includes(asset.accountType));
    const totalInvestmentValue = allInvestmentAssets.reduce((sum, asset) => sum + (asset.currentValueTWD || 0), 0);
    const topAsset = totalInvestmentValue > 0 ? [...allInvestmentAssets].sort((a, b) => (b.currentValueTWD ?? 0) - (a.currentValueTWD ?? 0))[0] : null;
    const concentration = totalInvestmentValue > 0 && topAsset ? ((topAsset.currentValueTWD ?? 0) / totalInvestmentValue) * 100 : 0;
    
    if (concentration > 50) {
        score += 5;
        feedback.push(`投資過度集中於「${topAsset?.code}」(${concentration.toFixed(1)}%)，風險極高。`);
    } else if (concentration > 30) {
        score += 15;
        feedback.push(`單一資產佔比較高 (${concentration.toFixed(1)}%)，建議分散投資。`);
    } else {
        score += 30;
        feedback.push(`投資組合分散良好，最大持股佔比為 ${concentration.toFixed(1)}%。`);
    }
    
    // 3. Risk Profile (Max 30 points)
    const stockValue = breakdown.find(b => b.type === '股票')?.value || 0;
    const stockPercentage = total > 0 ? (stockValue / total) * 100 : 0;
    
    if (stockPercentage > 60) {
        score += 5;
        feedback.push(`個股佔總資產 ${stockPercentage.toFixed(1)}%，風險配置過於激進。`);
    } else if (stockPercentage > 35) {
        score += 15;
        feedback.push(`個股佔比 ${stockPercentage.toFixed(1)}% 偏高，請留意風險。`);
    } else {
        score += 30;
        feedback.push(`個股風險控制良好，佔總資產 ${stockPercentage.toFixed(1)}%。`);
    }
    
    score = Math.round(score);
    let level: HealthScoreResult['level'];
    let levelColor: HealthScoreResult['levelColor'];
    
    if (score >= 80) {
        level = '優良';
        levelColor = 'text-green-500';
    } else if (score >= 50) {
        level = '中等';
        levelColor = 'text-yellow-500';
    } else {
        level = '待加強';
        levelColor = 'text-red-500';
    }

    return { score, feedback, level, levelColor };
};