import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { AssetAccount, CashflowRecord, Budget, Goal, ChatMessage } from '../../types';

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    assetAccounts: AssetAccount[];
    cashflowRecords: CashflowRecord[];
    budgets: Budget[];
    goals: Goal[];
}

const SimpleMarkdown: React.FC<{ text: string }> = ({ text }) => {
    // Splits text by **bold** tags, preserving the delimiters for processing.
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Renders the content between the asterisks as bold.
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                }
                // Renders normal text parts.
                return part;
            })}
        </>
    );
};


const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, assetAccounts, cashflowRecords, budgets, goals }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when chat opens and provide a dynamic welcome message
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            if (messages.length === 0) {
                const totalAssets = assetAccounts.reduce((sum, acc) => sum + (acc.assets || []).reduce((s, asset) => s + (asset.currentValueTWD || 0), 0), 0);
                let welcomeMessage = '你好！我是您的個人財務助理 Navi。請問有什麼可以為您服務的嗎？';
                
                if (totalAssets > 0) {
                    welcomeMessage = `你好！我是 Navi。我注意到您目前的總資產約為 **$${totalAssets.toLocaleString(undefined, {maximumFractionDigits: 0})}**。\n\n您可以問我：\n* "分析我的資產配置"\n* "我上個月的開銷如何？"\n* "給我一些儲蓄建議"`;
                } else {
                    welcomeMessage = '你好！我是您的個人財務助理 Navi。很高興為您服務！\n\n您可以從記錄您的第一筆資產或收支開始，然後向我提問以獲得財務建議。';
                }
                
                setMessages([{ role: 'model', content: welcomeMessage }]);
            }
        }
    }, [isOpen, messages.length, assetAccounts]);
    
    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const summarizeFinancialData = (): string => {
        const totalAssets = assetAccounts.reduce((sum, acc) => sum + (acc.assets || []).reduce((s, asset) => s + (asset.currentValueTWD || 0), 0), 0);
        
        const assetBreakdown = assetAccounts.flatMap(acc => acc.assets || []).reduce((acc: {[key: string]: number}, asset) => {
            const value = asset.currentValueTWD || 0;
            acc[asset.accountType] = (acc[asset.accountType] || 0) + value;
            return acc;
        }, {});

        const now = new Date();
        const lastMonthKey = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);
        const lastMonthRecords = cashflowRecords.filter(r => r.date.startsWith(lastMonthKey));
        const lastMonthIncome = lastMonthRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
        const lastMonthExpense = lastMonthRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);

        const goalsSummary = {
            count: goals.length,
            completed: goals.filter(g => (g.currentAmount || 0) >= g.targetAmount).length,
        };

        const summary = {
            totalAssets: totalAssets.toFixed(0),
            assetBreakdown: Object.fromEntries(Object.entries(assetBreakdown).map(([k, v]) => [k, v.toFixed(0)])),
            lastMonthSummary: {
                income: lastMonthIncome.toFixed(0),
                expense: lastMonthExpense.toFixed(0),
                netSavings: (lastMonthIncome - lastMonthExpense).toFixed(0),
            },
            goalsSummary,
        };
        return JSON.stringify(summary);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        if (!process.env.API_KEY) {
            setTimeout(() => {
                const simulatedResponse: ChatMessage = { role: 'model', content: 'AI 助理未設定 API 金鑰，目前無法使用。' };
                setMessages(prev => [...prev, simulatedResponse]);
                setIsLoading(false);
            }, 500);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const financialContext = summarizeFinancialData();
            const systemInstruction = `You are 'Navi', a helpful and insightful personal finance assistant for the 'Personal Finance Navigator' app. You must respond in Traditional Chinese (繁體中文). Analyze the user's financial data to provide personalized, actionable advice. Be encouraging and clear. **Structure your responses for maximum readability**:
- Use **bold text** to highlight key terms and numbers.
- Use bullet points (*) for lists or steps.
- Keep paragraphs short and focused.
Here is the user's current financial data summary: \n${financialContext}`;
            
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: input,
              config: {
                systemInstruction: systemInstruction,
              }
            });

            const aiResponse: ChatMessage = { role: 'model', content: response.text };
            setMessages(prev => [...prev, aiResponse]);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            const errorMessage: ChatMessage = { role: 'model', content: '抱歉，我現在無法回答。請稍後再試。' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-full max-w-md h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-300 ease-in-out transform origin-bottom-right">
            <header className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-2xl shadow-md">
                <h3 className="text-lg font-bold">AI 財務助理</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Close chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>
            
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-sm px-4 py-2 rounded-2xl shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                <div className="text-sm whitespace-pre-wrap"><SimpleMarkdown text={msg.content} /></div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-xs md:max-w-sm px-4 py-2 rounded-2xl shadow bg-gray-200 text-gray-800">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
                <div className="flex items-center space-x-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="請在這裡輸入您的問題..."
                        className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                        autoComplete="off"
                    />
                    <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow" disabled={isLoading || !input.trim()}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AIAssistant;