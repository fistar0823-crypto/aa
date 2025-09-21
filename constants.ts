// Buffett's recommended portfolio allocation target
export const BUFFETT_TARGET = {
  etf: 0.9,
  cash: 0.1
};

// Default categories for income and expenses
export const DEFAULT_CATEGORIES = {
  income: ['薪水', '獎金', '投資收益', '副業收入', '其他收入'],
  expense: ['餐飲', '交通', '居住', '娛樂', '教育', '醫療', '購物', '通訊', '保險', '其他支出']
};

// Color mapping for asset types in charts
export const ASSET_TYPE_COLORS: { [key: string]: string } = {
  '現金': '#4CAF50', // Green
  'ETF': '#2196F3', // Blue
  '股票': '#FFC107', // Amber
  '不動產': '#9C27B0', // Purple
  '美元資產': '#FF5722' // Deep Orange
};
