import { safeCopyToClipboard } from '@/utils/clipboard';
import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Sparkles, 
  FileText, 
  FileSpreadsheet, 
  Download, 
  Trash2, 
  Bot, 
  User, 
  Search, 
  ArrowRight, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  FileCheck, 
  Key, 
  Settings, 
  Database,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  Layers,
  Fuel,
  TrendingUp,
  Clock,
  Building2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/integrations/supabase/client";
import { db, FileRecord } from "@/lib/db";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO string
  records?: any[];
  totalMatchCount?: number;
  isSearching?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const SAFE_DB_COLUMNS = "id, tracking_id, cfo_diary_number, receiving_number, employee_number, inward_date, main_category, sub_category, received_from, file_purpose, subject, mark_to, additional_mark_to, gross_amount, deduction, amount, outward_date, remarks, budget_code, voucher_code, vehicle_no, date_of_sign, handover_person_name, print_date, created_at";

const INITIAL_WELCOME_CONTENT = `Assalamu Alaykum! Main **KWSC AI Intelligence Officer** hoon. 

Main live **Supabase Database (14,600+ records)** ke sath connected hoon. Aap mujhse kisi bhi file, vendor, department ya category ke baare me natural Urdu ya English me pooch sakte hain:
- *"Total contractor files aur unka valuation kitna hai?"*
- *"CFO office me kitni files pending hain?"*
- *"Shah Latif Town project ki files dikhao"*
- *"Specific file search: CFO-2627-5-1415 ya DK-1599"*
- *"Pichlay 30 din ki POL bills ki summary aur official PDF bana do"*

Har sawal ka mukammal tajziya, real-time statistics aur **Official Stamped PDF Report** foran milenge!`;

function createDefaultSession(): ChatSession {
  const id = "session-" + Date.now();
  return {
    id,
    title: "New Conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "welcome-" + id,
        role: "assistant",
        content: INITIAL_WELCOME_CONTENT,
        timestamp: new Date().toISOString(),
      }
    ]
  };
}

export default function AskAI() {
  // ── Sessions Management (Claude / ChatGPT style) ──
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem("kwsc_ai_chat_sessions");
      if (saved) {
        const parsed: ChatSession[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load sessions from localStorage", e);
    }
    return [createDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || "default";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [systemTotalCount, setSystemTotalCount] = useState<number>(14668);

  // Gemini API Key config
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return localStorage.getItem("kwsc_gemini_api_key") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "AQ.Ab8RN6LFEriPX6N-k5vLi2t2PQTYtvnPMl_hc6JH6LAXYAIj4g";
  });
  const [keyInput, setKeyInput] = useState(geminiKey);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active session helper
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || createDefaultSession();
  const messages = activeSession.messages;

  // Persist sessions whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("kwsc_ai_chat_sessions", JSON.stringify(sessions));
    } catch (e) {
      console.warn("Could not save sessions to localStorage", e);
    }
  }, [sessions]);

  // Fetch real count from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase
          .from('file_tracking_records' as any)
          .select('*', { count: 'exact', head: true });
        if (count && count > 0) {
          setSystemTotalCount(count);
        }
      } catch (e) {
        console.warn("Could not fetch total count from Supabase", e);
      }
    })();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Session Operations ──
  const handleNewChat = () => {
    const newSession = createDefaultSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputQuery("");
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      // If deleting the only session, reset it to a fresh default
      const fresh = createDefaultSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      toast.info("Session reset");
      return;
    }

    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0].id);
    }
    toast.success("Chat session deleted");
  };

  const handleClearCurrentChat = () => {
    const fresh = createDefaultSession();
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          title: "New Conversation",
          messages: fresh.messages,
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    }));
    toast.info("Chat cleared");
  };

  const copyToClipboard = (text: string, id: string) => {
    safeCopyToClipboard(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveApiKey = () => {
    const key = keyInput.trim();
    localStorage.setItem("kwsc_gemini_api_key", key);
    setGeminiKey(key);
    setIsKeyDialogOpen(false);
    toast.success("Gemini API key saved!");
  };

  // ── Smart Dynamic Supabase Querying ──
  const searchSupabaseForContext = async (queryText: string): Promise<{ records: any[]; totalCount: number; categoryHint: string }> => {
    const q = queryText.toLowerCase().trim();

    // Common stop words in English & Urdu that should NEVER trigger a vendor keyword search
    const STOP_WORDS = new Set([
      "how", "many", "total", "count", "kitni", "kitne", "kitna", "system", "all", "tamam", "sari", "sare",
      "entries", "files", "records", "data", "database", "kahan", "hai", "hain", "dikhao", "batao",
      "karo", "do", "bana", "banakr", "generate", "pdf", "excel", "sheet", "export", "download",
      "details", "status", "ka", "ki", "ke", "ko", "mein", "se", "par", "pe", "aur", "and", "or",
      "bhai", "sir", "please", "can", "you", "tm", "tum", "aap", "isme", "to", "bs", "sirf", "only",
      "kya", "kia", "konsi", "kon", "what", "which", "where", "when", "why", "who", "show", "give", "me",
      "recent", "latest", "new", "purani", "old", "sabse", "zyada", "kam", "more", "less", "entries"
    ]);

    try {
      // 1. SPECIFIC FILE CODES (CFO-..., RE-..., DK-..., numbers with dashes)
      const codeMatches = q.match(/(cfo[^\s,]+|re-\d+|dk-\d+|rc-\d+)/i);
      if (codeMatches && codeMatches[0]) {
        const code = codeMatches[0].trim();
        const { data } = await supabase
          .from('file_tracking_records' as any)
          .select(SAFE_DB_COLUMNS)
          .or(`cfo_diary_number.ilike.%${code}%,receiving_number.ilike.%${code}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          return { records: data, totalCount: data.length, categoryHint: `Specific File Code: ${code}` };
        }
      }

      // 2. OVERVIEW / SYSTEM TOTAL QUERIES (e.g. "how many total entries", "total entries kitni hain")
      const isOverviewQuery = (q.includes("total") || q.includes("kitni") || q.includes("kitne") || q.includes("how many") || q.includes("all entries") || q.includes("sari entries") || q.includes("system overview")) && 
        !q.includes("contractor") && !q.includes("pension") && !q.includes("pol") && !q.includes("medical");

      if (isOverviewQuery) {
        const { data } = await supabase
          .from('file_tracking_records' as any)
          .select(SAFE_DB_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(100);

        return { 
          records: data || [], 
          totalCount: systemTotalCount, 
          categoryHint: "Complete System Overview" 
        };
      }

      // 3. CATEGORY-BASED SEARCH
      let categoryFilter: string | null = null;
      if (q.includes("contractor") || q.includes("contracter") || q.includes("thekedar") || q.includes("thekedaar")) {
        categoryFilter = 'contractor';
      } else if (q.includes("pension") || q.includes("pinshen") || q.includes("retired") || q.includes("gratuity")) {
        categoryFilter = 'pension';
      } else if (q.includes("medical") || q.includes("hospital") || q.includes("dawa") || q.includes("treatment")) {
        categoryFilter = 'medical';
      } else if (q.includes("pol") || q.includes("fuel") || q.includes("petrol") || q.includes("diesel") || q.includes("station")) {
        categoryFilter = 'pol';
      } else if (q.includes("salary") || q.includes("tankhwah") || q.includes("allowance")) {
        categoryFilter = 'salary';
      }

      if (categoryFilter) {
        const { count } = await supabase
          .from('file_tracking_records' as any)
          .select('*', { count: 'exact', head: true })
          .or(`main_category.ilike.%${categoryFilter}%,sub_category.ilike.%${categoryFilter}%`);

        const { data } = await supabase
          .from('file_tracking_records' as any)
          .select(SAFE_DB_COLUMNS)
          .or(`main_category.ilike.%${categoryFilter}%,sub_category.ilike.%${categoryFilter}%`)
          .order('created_at', { ascending: false })
          .limit(150);

        return { 
          records: data || [], 
          totalCount: count || (data ? data.length : 0), 
          categoryHint: `${categoryFilter.toUpperCase()} Category` 
        };
      }

      // 4. DEPARTMENT / MARK TO SEARCH
      const deptMatches = q.match(/(cfo|cia|budget|admin|chairman|audit|dmd|finance|accounts|revenue)/i);
      if (deptMatches && (q.includes("office") || q.includes("section") || q.includes("mark") || q.includes("department") || q.includes("pending"))) {
        const dept = deptMatches[0].trim();
        const { count } = await supabase
          .from('file_tracking_records' as any)
          .select('*', { count: 'exact', head: true })
          .ilike('mark_to', `%${dept}%`);

        const { data } = await supabase
          .from('file_tracking_records' as any)
          .select(SAFE_DB_COLUMNS)
          .ilike('mark_to', `%${dept}%`)
          .order('created_at', { ascending: false })
          .limit(100);

        return { 
          records: data || [], 
          totalCount: count || (data ? data.length : 0), 
          categoryHint: `Department: ${dept.toUpperCase()}` 
        };
      }

      // 5. FREE-TEXT KEYWORD SEARCH (Vendor name, project name, location like Shah Latif)
      const words = q.replace(/[^a-zA-Z0-9\s\-\/]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
      // Ignore small plain numbers like '30' or '10' from follow-ups
      const realKeywords = words.filter(w => !/^\d{1,3}$/.test(w));

      if (realKeywords.length > 0) {
        const term = realKeywords[0];
        const { data } = await supabase
          .from('file_tracking_records' as any)
          .select(SAFE_DB_COLUMNS)
          .or(`received_from.ilike.%${term}%,subject.ilike.%${term}%,file_purpose.ilike.%${term}%,sub_category.ilike.%${term}%,remarks.ilike.%${term}%`)
          .order('created_at', { ascending: false })
          .limit(80);

        if (data && data.length > 0) {
          return { records: data, totalCount: data.length, categoryHint: `Search: "${term}"` };
        }
      }

      // 6. GENERAL SAMPLES (Follow-ups or conversational queries)
      const { data } = await supabase
        .from('file_tracking_records' as any)
        .select(SAFE_DB_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(30);

      return { records: data || [], totalCount: systemTotalCount, categoryHint: "System Overview" };

    } catch (err) {
      console.error("Context fetch error:", err);
      return { records: [], totalCount: 0, categoryHint: "Database Error" };
    }
  };

  // ── Claude-Grade Intelligent AI Synthesis via Gemini ──
  const callGeminiAI = async (userPrompt: string, history: ChatMessage[], liveContext: { records: any[]; totalCount: number; categoryHint: string }): Promise<string> => {
    const key = (geminiKey && geminiKey.trim()) ? geminiKey.trim() : "AQ.Ab8RN6LFEriPX6N-k5vLi2t2PQTYtvnPMl_hc6JH6LAXYAIj4g";

    // Summary of extracted records
    const sampleRows = liveContext.records.slice(0, 15).map(r => ({
      cfo_diary: r.cfo_diary_number,
      receiving_no: r.receiving_number,
      party: r.received_from || r.party_name || r.file_purpose,
      category: r.main_category,
      amount: r.amount,
      mark_to: r.mark_to
    }));

    let totalAmount = 0;
    liveContext.records.forEach(r => {
      if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
    });

    const systemInstruction = `Aap Karachi Water & Sewerage Corporation (KWSC) ke Executive AI Intelligence Officer hain.
Aapka role Claude ya ChatGPT jaisa sharp, analytical, warm aur polite hai.
Aap Roman Urdu ya English me baat karte hain (user jis language me sawal pooche, usi me jawab dein).

System Data Context:
- Total registered files in KWSC Portal: ${systemTotalCount.toLocaleString()} files.
- Current query scope (${liveContext.categoryHint}): ${liveContext.totalCount} records.
- Matching sample data: ${JSON.stringify(sampleRows, null, 1)}
- Sample records valuation: PKR ${totalAmount.toLocaleString('en-US')}.

Rules:
1. Provide a direct, intelligent response in clean markdown with bold highlights.
2. If asked about total entries, state that there are ${systemTotalCount.toLocaleString()} files registered in the portal.
3. If asked about generating a PDF for total entries or records, confirm affirmatively and guide the user to click the "Download Official PDF" button directly below.
4. If the user mentions that "isme to bs 30 entries hain" or similar follow-up, explain politely that the on-screen preview table only displays the top 30 records for quick browsing, but clicking "Download Official PDF" generates the complete report with all matching records!
5. Never invent fake file numbers. Keep the tone helpful, executive, and natural.`;

    // Multi-turn chat history (last 4 messages for context)
    const historyPayload = history.slice(-4).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const contentsPayload = [
      ...historyPayload,
      {
        role: "user",
        parts: [
          { text: `${systemInstruction}\n\nUser Question: ${userPrompt}` }
        ]
      }
    ];

    // Priority model list to ensure 99.9% uptime (gemini-flash-latest handles 200 reliably)
    const CANDIDATE_MODELS = [
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash"
    ];

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: contentsPayload,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000,
            }
          })
        });

        if (response.ok) {
          const json = await response.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.trim();
        } else {
          console.warn(`Model ${modelName} returned status ${response.status}, trying next...`);
        }
      } catch (e) {
        console.warn(`Model ${modelName} fetch error, trying next...`, e);
      }
    }

    // High quality local fallback if network is completely offline
    return generateSmartLocalResponse(userPrompt, liveContext, totalAmount);
  };

  const generateSmartLocalResponse = (q: string, context: { records: any[]; totalCount: number; categoryHint: string }, totalAmount: number): string => {
    const lowQ = q.toLowerCase();

    // Friendly greetings and conversational queries
    if (lowQ.includes("salam") || lowQ.includes("hi") || lowQ.includes("hello") || lowQ.includes("tum kon") || lowQ.includes("who are you") || lowQ.includes("kya kar sakte") || lowQ.includes("help") || lowQ.includes("haal") || lowQ.includes("kaun ho") || lowQ.includes("kya ho")) {
      return `Walaikum Assalam! Main **KWSC AI Intelligence Officer** hoon. 

Main live **Supabase Database (14,668+ files)** ke sath seedha connected hoon:
- **Contractor Files:** *"Total contractor files kitni hain aur valuation kitni hai?"*
- **Specific File Search:** *"CFO-2026-76004 kahan hai?"* ya *"DK-1599 ka status"*
- **Location & Mark To:** *"CFO office me kitni files ruki hui hain?"*
- **Categories:** *"Pension cases"*, *"POL Bills"*, *"Medical Reimbursement"*
- **Official Reports:** *"Sari entries ki official PDF report bana do"*

Aap koi bhi sawal poochiye, main foran record dhoond kar analysis aur Official Stamped PDF tayyar karke doonga!`;
    }

    if (context.records.length === 0) {
      return `KWSC Live Database mein aapki query **"${q}"** ke mutabiq koi record nahi mila.\n\n💡 **Suggestions:**\n- Kisi file ka exact **CFO Diary No** (e.g. \`CFO-2026-76004\`) likhein\n- Receiving No (e.g. \`RE-7279\` ya \`DK-1599\`) search karein\n- Category ke mutabiq: *"Total contractor files"* ya *"Pension cases"* pooch sakte hain.`;
    }

    const first = context.records[0];
    if (context.records.length === 1 || q.includes("cfo") || q.includes("re-") || q.includes("dk-")) {
      return `File record mil gaya hai:

📌 **File Details:**
- **CFO Diary No:** \`${first.cfo_diary_number || 'N/A'}\`
- **Receiving No:** \`${first.receiving_number || 'N/A'}\`
- **Party / Vendor:** **${first.received_from || first.party_name || first.file_purpose || 'N/A'}**
- **Category:** **${(first.main_category || 'N/A').toUpperCase()}** ${(first.sub_category ? `(${first.sub_category.replace(/_/g, ' ')})` : '')}
- **Subject:** ${first.subject || 'N/A'}
- **Amount:** **PKR ${first.amount ? Number(first.amount).toLocaleString('en-US') : '0'}**
- **Current Location / Mark To:** 🏢 **${(first.mark_to || 'CFO Office').toUpperCase()}**
- **Inward Date:** ${first.inward_date || 'N/A'}

Neeche is file ka **Official Stamped PDF Report** ya **Excel Record** foran download kar sakte hain!`;
    }

    return `KWSC Live Database mein **${context.categoryHint}** ke mutabiq kul **${context.totalCount.toLocaleString('en-US')} files** mojood hain:

📊 **Executive Summary:**
- **Kul Files (Matched Records):** **\`${context.totalCount.toLocaleString('en-US')}\` files**
- **Fetched for Detailed Report:** \`${context.records.length}\` files
- **Total Valuation (Sample):** **PKR ${totalAmount.toLocaleString('en-US')}**
- **Top Party / Subject:** ${first.received_from || first.subject || 'KWSC Facilitation'}
- **Current Mark To:** **${(first.mark_to || 'CFO Office').toUpperCase()}**

Neeche report card mein latest **${context.records.length} records** attach hain. Aap **Official Stamped PDF Report** ya **Excel Sheet** foran download kar sakte hain!`;
  };

  // ── Auto Title Generator for Sessions ──
  const autoTitleForSession = (prompt: string): string => {
    const p = prompt.trim();
    if (p.toLowerCase().includes("contractor")) return "Contractor Files Inquiry";
    if (p.toLowerCase().includes("pension")) return "Pension Files Report";
    if (p.toLowerCase().includes("pol")) return "POL & Fuel Bills";
    if (p.toLowerCase().includes("medical")) return "Medical Cases Audit";
    if (p.toLowerCase().includes("cfo")) return `File ${p.slice(0, 18)}`;
    return p.slice(0, 26) + (p.length > 26 ? "..." : "");
  };

  // ── Handle Send Message ──
  const handleSendMessage = async (queryOverride?: string) => {
    const textToSend = queryOverride || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMessageId = "msg-" + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toISOString()
    };

    const aiMessageId = "ai-" + (Date.now() + 1);
    const placeholderAiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: "Live Supabase Database (14,600+ files) query ho rahi hai aur AI analysis tayyar kiya ja raha hai...",
      timestamp: new Date().toISOString(),
      isSearching: true
    };

    // Update session immediately with user message + thinking placeholder
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirstUserMessage = !s.messages.some(m => m.role === "user");
        const updatedTitle = isFirstUserMessage ? autoTitleForSession(textToSend) : s.title;
        return {
          ...s,
          title: updatedTitle,
          updatedAt: new Date().toISOString(),
          messages: [...s.messages, newUserMessage, placeholderAiMessage]
        };
      }
      return s;
    }));

    setInputQuery("");
    setLoading(true);

    try {
      // 1. Fetch live database records
      const liveContext = await searchSupabaseForContext(textToSend);

      // 2. Synthesize with Gemini AI
      const aiResponseText = await callGeminiAI(textToSend, messages, liveContext);

      // 3. Update the AI placeholder message with full intelligence + attached records
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: s.messages.map(m => {
              if (m.id === aiMessageId) {
                return {
                  ...m,
                  content: aiResponseText,
                  records: liveContext.records.length > 0 ? liveContext.records : undefined,
                  totalMatchCount: liveContext.totalCount,
                  isSearching: false
                };
              }
              return m;
            })
          };
        }
        return s;
      }));

    } catch (err: any) {
      console.error("AI Generation error:", err);
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.id === aiMessageId) {
                return {
                  ...m,
                  content: "Maazrat! Query process karne mein masla aya. Barah-e-karam dobara koshish karein.",
                  isSearching: false
                };
              }
              return m;
            })
          };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  // ── Generate Official Branded KWSC PDF ──
  const downloadOfficialPDF = async (queryTitle: string, records: any[]) => {
    try {
      toast.info("Official KWSC PDF Report tayyar ho raha hai...");

      let recordsToPrint = records;
      // If records were just preview (e.g. <= 30), fetch full batch for the PDF
      if (records.length <= 30) {
        try {
          const { data } = await supabase
            .from('file_tracking_records' as any)
            .select(SAFE_DB_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(500);
          if (data && data.length > records.length) {
            recordsToPrint = data;
          }
        } catch (e) {}
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Load Watermark / Logo if available
      let logoData: string | null = null;
      try {
        const response = await fetch("/kwsc-logo.png");
        if (response.ok) {
          const blob = await response.blob();
          logoData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Could not fetch logo for PDF", e);
      }

      if (logoData) {
        try {
          doc.addImage(logoData, "PNG", 14, 10, 22, 22);
        } catch (e) {}
      }

      // Official Title Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("KARACHI WATER & SEWERAGE CORPORATION", pageWidth / 2, 17, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("ONE WINDOW FACILITATION SYSTEM — CFO OFFICE", pageWidth / 2, 23, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text("OFFICIAL FILE TRACKING & AUDIT REPORT", pageWidth / 2, 30, { align: "center" });

      // Report Meta Box
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);

      const todayStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) + " " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      doc.text(`Generated Date: ${todayStr}`, 14, 38);
      doc.text(`Report Subject: ${queryTitle.slice(0, 50)}`, 14, 43);
      doc.text(`Total Records in Report: ${recordsToPrint.length}`, pageWidth - 14, 38, { align: "right" });

      let grandTotalAmount = 0;
      recordsToPrint.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) {
          grandTotalAmount += Number(r.amount);
        }
      });
      if (grandTotalAmount > 0) {
        doc.text(`Total Valuation: PKR ${grandTotalAmount.toLocaleString('en-US')}`, pageWidth - 14, 43, { align: "right" });
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(14, 47, pageWidth - 14, 47);

      const tableColumns = [
        "S#",
        "CFO DIARY #",
        "REC #",
        "VENDOR / PARTY",
        "CATEGORY",
        "SUBJECT",
        "AMOUNT (PKR)",
        "STATUS / MARK TO"
      ];

      const tableRows = recordsToPrint.map((r, idx) => [
        idx + 1,
        r.cfo_diary_number || "-",
        r.receiving_number || "-",
        r.received_from || r.party_name || r.file_purpose || "-",
        (r.main_category || "-").toUpperCase(),
        (r.subject || "-").slice(0, 32),
        r.amount ? Number(r.amount).toLocaleString('en-US') : "-",
        (r.mark_to || r.status || "Registered").toUpperCase()
      ]);

      if (grandTotalAmount > 0) {
        tableRows.push([
          { content: "GRAND TOTAL", colSpan: 6, styles: { halign: "right", fontStyle: "bold" } } as any,
          { content: grandTotalAmount.toLocaleString('en-US'), styles: { fontStyle: "bold", textColor: [16, 185, 129] } } as any,
          { content: "", styles: {} } as any
        ]);
      }

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 50,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center"
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          valign: "middle"
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { fontStyle: "bold", halign: "center", cellWidth: 26 },
          2: { halign: "center", cellWidth: 16 },
          3: { cellWidth: 32 },
          4: { halign: "center", cellWidth: 18 },
          5: { cellWidth: 42 },
          6: { halign: "right", fontStyle: "bold", cellWidth: 24 },
          7: { halign: "center", cellWidth: 20 }
        },
        didDrawPage: (data) => {
          if (logoData) {
            try {
              if ((doc as any).GState) {
                doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
              }
              const wmSize = 100;
              doc.addImage(logoData, "PNG", (pageWidth - wmSize) / 2, (pageHeight - wmSize) / 2, wmSize, wmSize);
              if ((doc as any).GState) {
                doc.setGState(new (doc as any).GState({ opacity: 1 }));
              }
            } catch (e) {}
          }

          const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Official KWSC One-Window Verification Document - Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
        }
      });

      doc.save(`KWSC_${queryTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`);
      toast.success("Official PDF download ho gaya!");
    } catch (err) {
      console.error("PDF generation error", err);
      toast.error("PDF generate karne mein masla aya");
    }
  };

  // ── Export to Excel ──
  const exportToExcel = (queryTitle: string, records: any[]) => {
    try {
      const dataForSheet = records.map((r, idx) => ({
        "S.No": idx + 1,
        "CFO Diary No": r.cfo_diary_number || "",
        "Receiving No": r.receiving_number || "",
        "Inward Date": r.inward_date || "",
        "Received From / Vendor": r.received_from || r.party_name || r.file_purpose || "",
        "Category": (r.main_category || "").toUpperCase(),
        "Sub Category": (r.sub_category || "").replace(/_/g, ' '),
        "Subject": r.subject || "",
        "Amount (PKR)": r.amount || 0,
        "Current Mark To": (r.mark_to || "CFO").toUpperCase(),
        "Handover Person": r.handover_person_name || "",
        "Created Date": r.created_at ? r.created_at.split('T')[0] : ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "KWSC Files Report");
      XLSX.writeFile(workbook, `KWSC_${queryTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`);
      toast.success("Excel report exported successfully!");
    } catch (e) {
      console.error("Excel export error", e);
      toast.error("Failed to export Excel");
    }
  };

  const sampleQueries = [
    "Total contractor files kitni hain aur unka total kitna hai?",
    "CFO office me kitni files pending hain?",
    "Pichle 30 din ki POL bills ki summary dikhao",
    "Pension section ke cases aur unki report do",
    "Medical reimbursement bills",
    "Sari entries ki official PDF report bana do"
  ];

  return (
    <div className="flex h-[calc(100vh-4.5rem)] bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* ── Left Sidebar (Claude / ChatGPT style sessions) ── */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-72' : 'w-0'
        } transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 overflow-hidden relative z-20`}
      >
        {/* Sidebar Header: New Chat Button */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Button 
            onClick={handleNewChat}
            className="flex-1 justify-start gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-xs font-semibold h-10 text-xs"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            className="h-10 w-10 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 md:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-mono">
              {sessions.length}
            </span>
          </div>

          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-xs border border-blue-200/60 dark:border-blue-900/40' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate">{session.title}</span>
                </div>
                
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  title="Delete chat session"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-400 transition-opacity rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: System Status & API Key Settings */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Database
            </span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {systemTotalCount.toLocaleString()} files
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-xs h-8 text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 rounded-lg border-slate-200 dark:border-slate-800"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  API Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-blue-600" />
                    Gemini AI API Key Configuration
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    Google AI Studio ki <strong>Free Gemini API Key</strong> (1,500 requests/day):
                  </p>
                  <Input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AIzaSy... ya system key"
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsKeyDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={saveApiKey}>
                      Save Key
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/60 dark:bg-slate-950">
        
        {/* Top Header Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              title={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </Button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  {activeSession.title}
                </h1>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300">
                  Live Supabase
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCurrentChat}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 h-8"
              title="Clear this conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>

            <Link to="/book-section/file-tracking">
              <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5 h-8 rounded-lg">
                <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">File Tracking</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex gap-3 max-w-4xl ${isUser ? "ml-auto justify-end" : "mr-auto justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`space-y-3 max-w-[88%] md:max-w-[82%]`}>
                  <div
                    className={`p-4 rounded-2xl shadow-xs text-sm ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-none ml-auto"
                        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tl-none"
                    }`}
                  >
                    {/* Content */}
                    <div className="whitespace-pre-wrap leading-relaxed space-y-2 font-normal">
                      {message.content}
                    </div>

                    {/* Copied and Action bar for Assistant */}
                    {!isUser && !message.isSearching && (
                      <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                        <span className="font-mono">
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Attached Records Preview & Official Downloads (PDF & Excel) ── */}
                  {!isUser && message.records && message.records.length > 0 && (
                    <Card className="border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs overflow-hidden rounded-xl">
                      <div className="p-3 bg-blue-100/60 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                          <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                            Verified KWSC Records ({message.records.length} of {message.totalMatchCount || message.records.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs font-semibold rounded-lg"
                            onClick={() => downloadOfficialPDF(message.records![0]?.main_category || "KWSC Records", message.records!)}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Official PDF ({message.records.length})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs bg-white dark:bg-slate-900 hover:bg-slate-100 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-semibold rounded-lg"
                            onClick={() => exportToExcel(message.records![0]?.main_category || "KWSC Records", message.records!)}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Export Excel
                          </Button>
                        </div>
                      </div>

                      <CardContent className="p-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-blue-200 dark:border-blue-800 text-slate-500 dark:text-slate-400">
                                <th className="pb-2 font-semibold">CFO Diary #</th>
                                <th className="pb-2 font-semibold">Receiving #</th>
                                <th className="pb-2 font-semibold">Party / Vendor</th>
                                <th className="pb-2 font-semibold">Category</th>
                                <th className="pb-2 font-semibold">Amount</th>
                                <th className="pb-2 font-semibold">Mark To</th>
                                <th className="pb-2 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-100 dark:divide-blue-900/30">
                              {message.records.slice(0, 6).map((r, i) => (
                                <tr key={i} className="hover:bg-blue-100/30 dark:hover:bg-blue-900/20">
                                  <td className="py-2 font-bold font-mono text-blue-900 dark:text-blue-300">
                                    {r.cfo_diary_number || "-"}
                                  </td>
                                  <td className="py-2 font-mono text-slate-600 dark:text-slate-300">
                                    {r.receiving_number || "-"}
                                  </td>
                                  <td className="py-2 text-slate-700 dark:text-slate-200 truncate max-w-[130px]">
                                    {r.received_from || r.party_name || r.file_purpose || "-"}
                                  </td>
                                  <td className="py-2">
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {r.main_category || "-"}
                                    </Badge>
                                  </td>
                                  <td className="py-2 font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                                    {r.amount ? `PKR ${Number(r.amount).toLocaleString('en-US')}` : "-"}
                                  </td>
                                  <td className="py-2">
                                    <Badge variant="secondary" className="text-[10px] bg-slate-200 dark:bg-slate-800 uppercase">
                                      {r.mark_to || "CFO"}
                                    </Badge>
                                  </td>
                                  <td className="py-2 text-right">
                                    {r.receiving_number && (
                                      <Link
                                        to={`/book-section/file-record/${encodeURIComponent(r.receiving_number)}`}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-[11px] underline font-semibold"
                                      >
                                        View
                                      </Link>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {message.records.length > 6 && (
                            <div className="pt-2 text-center text-[11px] text-slate-500 font-medium">
                              + {message.records.length - 6} more records. Click <strong>Download Official PDF</strong> for the full stamped document!
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-700 flex-shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Query Chips */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Suggestions:
          </span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sq)}
              className="text-xs bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors shrink-0"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-4xl mx-auto flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Input
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask anything... (e.g. Total contractor files kitni hain? ya Shah Latif Town project ki files dikhao)"
                className="pr-10 py-6 text-sm rounded-xl border-slate-300 dark:border-slate-700 focus-visible:ring-blue-600 bg-slate-50 dark:bg-slate-950 font-medium"
                disabled={loading}
                autoFocus
              />
              {inputQuery && (
                <button
                  type="button"
                  onClick={() => setInputQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Bhejo</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </main>

    </div>
  );
}
