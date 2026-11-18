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
  ShieldCheck,
  Building,
  HelpCircle,
  Copy,
  Check,
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/integrations/supabase/client";
import { db, FileRecord } from "@/lib/db";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  records?: FileRecord[];
  isSearching?: boolean;
}

export default function AskAI() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("kwsc_ai_chat_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [
      {
        id: "welcome-1",
        role: "assistant",
        content: `Assalamu Alaykum! Main **KWSC AI Assistant** hoon. 

Aap mujhse live system aur database ke baare mein kuch bhi pooch sakte hain:
- Kisi file ka status: *"CFO-2627-5-1436 kahan hai?"* ya *"Receiving 1045 ka record dikhao"*
- Vendor / Contractor files: *"M/S Al-Rehman ke bills dikhao"*
- Category wise files: *"Medical cases summary"* ya *"Pension section ki files"*
- Mark to status: *"Internal Audit mein kitni files hain?"*

Mujhe file number ya vendor name batayein, main live record nikaal kar **Official Branded PDF** aur **Excel** bhi download ke liye tayyar kar doonga!`,
        timestamp: new Date(),
      }
    ];
  });

  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("kwsc_ai_chat_history", JSON.stringify(messages));
    } catch (e) {
      console.warn("Could not save chat history to local storage", e);
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const clearChat = () => {
    const welcome: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: `Chat clear kar di gayi hai. Aap koi bhi nayi file ya inquiry pooch sakte hain!`,
      timestamp: new Date()
    };
    setMessages([welcome]);
    localStorage.removeItem("kwsc_ai_chat_history");
    toast.info("Chat history cleared");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Response copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Live Database Fetcher (Supabase primary + Dexie IndexedDB fallback)
  const searchFilesDatabase = async (query: string): Promise<FileRecord[]> => {
    const cleanQ = query.trim().toLowerCase();
    let records: FileRecord[] = [];

    // 1. Try querying local IndexedDB first for fastest response
    try {
      const allLocal = await db.records.toArray();
      if (allLocal && allLocal.length > 0) {
        records = allLocal.filter(r => {
          const cfo = (r.cfo_diary_number || "").toLowerCase();
          const rec = (r.receiving_number || "").toLowerCase();
          const party = (r.party_name || "").toLowerCase();
          const from = (r.received_from || "").toLowerCase();
          const subject = (r.subject || "").toLowerCase();
          const emp = (r.emp_name || "").toLowerCase();
          const empNo = (r.emp_no || "").toLowerCase();
          const category = (r.main_category || "").toLowerCase();
          const subCategory = (r.sub_category || "").toLowerCase();
          const markTo = (r.mark_to || "").toLowerCase();
          const vendorNo = ((r as any).vendor_number || "").toLowerCase();

          // Token matching
          const tokens = cleanQ.split(/\s+/).filter(t => t.length > 1 && !["kahan", "hai", "files", "file", "ka", "ki", "ke", "dikhao", "batao", "status", "report", "show", "me", "find"].includes(t));
          
          if (tokens.length === 0) {
            return cfo.includes(cleanQ) || rec.includes(cleanQ) || party.includes(cleanQ) || from.includes(cleanQ);
          }

          return tokens.some(tok => 
            cfo.includes(tok) || 
            rec.includes(tok) || 
            party.includes(tok) || 
            from.includes(tok) || 
            subject.includes(tok) || 
            emp.includes(tok) || 
            empNo.includes(tok) || 
            category.includes(tok) || 
            subCategory.includes(tok) ||
            markTo.includes(tok) ||
            vendorNo.includes(tok)
          );
        });
      }
    } catch (e) {
      console.warn("Dexie search error", e);
    }

    // 2. Try Supabase cloud search if Supabase is connected
    try {
      // Search by diary number or receiving number or received_from
      const { data: cloudData, error } = await supabase
        .from('file_tracking')
        .select('*')
        .or(`cfo_diary_number.ilike.%${cleanQ}%,receiving_number.ilike.%${cleanQ}%,received_from.ilike.%${cleanQ}%,party_name.ilike.%${cleanQ}%,subject.ilike.%${cleanQ}%`)
        .limit(25);

      if (!error && cloudData && cloudData.length > 0) {
        // Merge cloud results with local results avoiding duplicates
        const existingIds = new Set(records.map(r => r.cfo_diary_number || r.receiving_number));
        for (const item of cloudData as any[]) {
          const key = item.cfo_diary_number || item.receiving_number;
          if (!existingIds.has(key)) {
            records.push(item);
          }
        }
      }
    } catch (e) {
      // Supabase might be offline or paused, local fallback already captured
    }

    return records.slice(0, 30);
  };

  // Generate Official Branded KWSC PDF
  const downloadOfficialPDF = async (queryTitle: string, records: FileRecord[]) => {
    try {
      toast.info("Generating Official KWSC PDF Report...");
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

      // Add Header Logo
      if (logoData) {
        try {
          doc.addImage(logoData, "PNG", 14, 10, 22, 22);
        } catch (e) {}
      }

      // Official Title Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("KARACHI WATER & SEWERAGE CORPORATION", pageWidth / 2, 17, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("ONE WINDOW FACILITATION SYSTEM — CFO OFFICE", pageWidth / 2, 23, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138); // blue-900
      doc.text("FILE TRACKING INTELLIGENCE REPORT", pageWidth / 2, 30, { align: "center" });

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
      doc.text(`Query / Parameter: ${queryTitle.slice(0, 45)}`, 14, 43);
      doc.text(`Total Records Found: ${records.length}`, pageWidth - 14, 38, { align: "right" });

      let grandTotalAmount = 0;
      records.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) {
          grandTotalAmount += Number(r.amount);
        }
      });
      if (grandTotalAmount > 0) {
        doc.text(`Total Valuation: PKR ${grandTotalAmount.toLocaleString('en-US')}`, pageWidth - 14, 43, { align: "right" });
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(14, 47, pageWidth - 14, 47);

      // AutoTable
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

      const tableRows = records.map((r, idx) => [
        idx + 1,
        r.cfo_diary_number || "-",
        r.receiving_number || "-",
        r.party_name || r.received_from || "-",
        r.main_category || "-",
        (r.subject || "-").slice(0, 32),
        r.amount ? Number(r.amount).toLocaleString('en-US') : "-",
        r.mark_to || r.status || "Registered"
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
          fillColor: [30, 41, 59], // slate-800
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
          4: { cellWidth: 22 },
          5: { cellWidth: 38 },
          6: { halign: "right", cellWidth: 22 },
          7: { cellWidth: 26 }
        },
        didDrawPage: (data) => {
          // Watermark on center of page
          if (logoData) {
            try {
              if ((doc as any).GState) {
                doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
              }
              const wmSize = 100;
              doc.addImage(logoData, "PNG", (pageWidth - wmSize) / 2, (pageHeight - wmSize) / 2, wmSize, wmSize);
              if ((doc as any).GState) {
                doc.setGState(new (doc as any).GState({ opacity: 1 }));
              }
            } catch (e) {}
          }

          // Footer
          const pageCount = (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : 1;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Official KWSC One-Window Verification Document - Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
        }
      });

      doc.save(`KWSC_AI_Report_${Date.now()}.pdf`);
      toast.success("Official PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation error", err);
      toast.error("Failed to generate PDF");
    }
  };

  // Export to Excel
  const exportToExcel = (queryTitle: string, records: FileRecord[]) => {
    try {
      const dataForSheet = records.map((r, idx) => ({
        "S.No": idx + 1,
        "CFO Diary No": r.cfo_diary_number || "",
        "Receiving No": r.receiving_number || "",
        "Inward Date": r.inward_date || "",
        "Received From / Vendor": r.received_from || r.party_name || "",
        "Category": r.main_category || "",
        "Sub Category": r.sub_category || "",
        "Subject": r.subject || "",
        "Amount (PKR)": r.amount || 0,
        "Current Status": r.status || "",
        "Mark To Department": r.mark_to || "",
        "Handover Person": r.handover_person_name || "",
        "Registration Date": r.registration_date || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "KWSC Files Report");
      XLSX.writeFile(workbook, `KWSC_Files_${Date.now()}.xlsx`);
      toast.success("Excel report exported successfully!");
    } catch (e) {
      console.error("Excel export error", e);
      toast.error("Failed to export Excel");
    }
  };

  // Main Handle Send
  const handleSendMessage = async (queryOverride?: string) => {
    const textToSend = queryOverride || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMessageId = Date.now().toString();
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date()
    };

    const aiMessageId = (Date.now() + 1).toString();
    const initialAiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: "Database search ho raha hai...",
      timestamp: new Date(),
      isSearching: true
    };

    setMessages(prev => [...prev, newUserMessage, initialAiMessage]);
    setInputQuery("");
    setLoading(true);

    try {
      // 1. Fetch matching database records
      const matchingRecords = await searchFilesDatabase(textToSend);

      // 2. Prepare Gemini Prompt or intelligent response generator
      const geminiApiKey = localStorage.getItem("kwsc_gemini_api_key") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";

      let finalContent = "";

      if (geminiApiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

          const prompt = `You are the official KWSC (Karachi Water & Sewerage Corporation) One-Window Facilitation AI Assistant.
The user asked: "${textToSend}"

Here is the live database search result from KWSC records:
${matchingRecords.length === 0 ? "No records found matching this query in the database." : JSON.stringify(matchingRecords.map(r => ({
  cfo_diary_number: r.cfo_diary_number,
  receiving_number: r.receiving_number,
  party_name: r.party_name || r.received_from,
  category: r.main_category,
  sub_category: r.sub_category,
  subject: r.subject,
  amount: r.amount,
  status: r.status,
  mark_to: r.mark_to,
  inward_date: r.inward_date
})))}

Instructions:
1. Answer clearly, professionally, and politely in Urdu/Roman Urdu with English terms.
2. If matching records exist:
   - Provide the specific file location, department mark to, and current status.
   - List key details (CFO Diary No, Receiving No, Vendor/Party Name, Subject, Amount in PKR).
   - Tell the user that they can also click the Download PDF or Export Excel button below for official stamped report.
3. If no matching records exist, explain that no record matched the query in the live database, and suggest checking the exact CFO diary or Receiving number.
4. Keep the response concise, formatted with clear markdown bolding and bullet points.`;

          const result = await model.generateContent(prompt);
          finalContent = result.response.text();
        } catch (aiErr) {
          console.warn("Gemini API call failed, generating direct structured response", aiErr);
        }
      }

      // If Gemini response wasn't produced or no key, construct high quality direct summary
      if (!finalContent) {
        if (matchingRecords.length > 0) {
          const first = matchingRecords[0];
          finalContent = `Main ne database se **${matchingRecords.length} record(s)** dhoond liye hain:

📌 **Sab se relevant file:**
- **CFO Diary No:** \`${first.cfo_diary_number || 'N/A'}\`
- **Receiving No:** \`${first.receiving_number || 'N/A'}\`
- **Party / Vendor:** ${first.party_name || first.received_from || 'N/A'}
- **Category:** ${first.main_category || 'N/A'} ${first.sub_category ? `(${first.sub_category})` : ''}
- **Subject:** ${first.subject || 'N/A'}
- **Amount:** PKR ${first.amount ? Number(first.amount).toLocaleString('en-US') : '0'}
- **Current Status / Mark To:** 🏢 **${first.mark_to || first.status || 'In Process'}**

Aap neeche diye gaye button par click karke is ka **Official Stamped PDF Report** ya **Excel Spreadsheet** download kar sakte hain!`;
        } else {
          finalContent = `Aap ki query "${textToSend}" ke mutabiq database mein koi record nahi mila.

💡 **Tips:**
- Barah-e-karam exact **CFO Diary Number** (maslan: \`CFO-2627-5-1436\`) ya **Receiving Number** check karein.
- Vendor ka naam ya Category (maslan: Pension, Medical, Contractor) likh kar search karein.`;
        }
      }

      // Update AI message
      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          return {
            ...m,
            content: finalContent,
            records: matchingRecords.length > 0 ? matchingRecords : undefined,
            isSearching: false
          };
        }
        return m;
      }));

    } catch (err: any) {
      console.error("Chat error", err);
      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          return {
            ...m,
            content: "Maazrat! Query process karne mein masla pesh aya hai. Barah-e-karam dobara koshish karein.",
            isSearching: false
          };
        }
        return m;
      }));
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "CFO-2627-5-1436 kahan hai?",
    "Pension section ki files dikhao",
    "Medical reimbursement bills",
    "Internal audit mein kaun si files hain?",
    "Contractor bills status",
    "Contingency files report"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-50 dark:bg-slate-950">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">KWSC AI Assistant</h1>
              <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300">
                Live Supabase Connected
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instant File Tracking &bull; Official Stamped PDF Reports &bull; Excel Export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </Button>
          <Link to="/book-section/file-tracking">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-600" />
              File Tracking Page
            </Button>
          </Link>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 max-w-4xl ${message.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-600 flex-shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`space-y-3 max-w-[85%] md:max-w-[78%]`}>
              <div
                className={`p-4 rounded-2xl shadow-sm text-sm ${
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none ml-auto"
                    : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-tl-none"
                }`}
              >
                {/* Content */}
                <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                  {message.content}
                </div>

                {/* Copied and Action bar for Assistant */}
                {message.role === "assistant" && !message.isSearching && (
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                    <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
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

              {/* Records Attachment Card if query returned data */}
              {message.records && message.records.length > 0 && (
                <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-blue-100/60 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Live Verified Records ({message.records.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow-sm"
                        onClick={() => downloadOfficialPDF(message.records![0]?.cfo_diary_number || "KWSC Report", message.records!)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-white dark:bg-slate-900 hover:bg-slate-100 border-emerald-300 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"
                        onClick={() => exportToExcel(message.records![0]?.cfo_diary_number || "KWSC Records", message.records!)}
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
                            <th className="pb-2 font-semibold">Amount</th>
                            <th className="pb-2 font-semibold">Mark To</th>
                            <th className="pb-2 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100 dark:divide-blue-900/30">
                          {message.records.slice(0, 5).map((r, i) => (
                            <tr key={i} className="hover:bg-blue-100/30 dark:hover:bg-blue-900/20">
                              <td className="py-2 font-bold text-blue-900 dark:text-blue-300">
                                {r.cfo_diary_number || "-"}
                              </td>
                              <td className="py-2 text-slate-600 dark:text-slate-300">
                                {r.receiving_number || "-"}
                              </td>
                              <td className="py-2 text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                                {r.party_name || r.received_from || "-"}
                              </td>
                              <td className="py-2 font-medium text-emerald-600 dark:text-emerald-400">
                                {r.amount ? `PKR ${Number(r.amount).toLocaleString('en-US')}` : "-"}
                              </td>
                              <td className="py-2">
                                <Badge variant="secondary" className="text-[10px] bg-slate-200 dark:bg-slate-800">
                                  {r.mark_to || r.status || "Registered"}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">
                                {r.receiving_number && (
                                  <Link
                                    to={`/book-section/file-record/${encodeURIComponent(r.receiving_number)}`}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-[11px] underline font-medium"
                                  >
                                    View
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {message.records.length > 5 && (
                        <p className="text-[11px] text-slate-500 mt-2 text-center">
                          +{message.records.length - 5} aur records report mein shamil hain. Poora record dekhne ke liye PDF download karein.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-white shadow-sm mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-xs font-medium text-slate-400 flex items-center gap-1 flex-shrink-0">
          <HelpCircle className="w-3.5 h-3.5" /> Example queries:
        </span>
        {sampleQueries.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(sq)}
            className="text-xs bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors flex-shrink-0"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
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
              placeholder="Sawal poochein... (e.g. CFO-2627-5-1436 kahan hai? ya Vendor XYZ ke bills)"
              className="pr-10 py-6 text-sm rounded-xl border-slate-300 dark:border-slate-700 focus-visible:ring-blue-600 bg-slate-50 dark:bg-slate-950"
              disabled={loading}
              autoFocus
            />
            {inputQuery && (
              <button
                type="button"
                onClick={() => setInputQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <Button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 shadow-md shadow-blue-500/20"
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
    </div>
  );
}
