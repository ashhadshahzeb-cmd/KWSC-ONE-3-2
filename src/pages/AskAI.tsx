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
  FileCheck,
  Key,
  Settings,
  DollarSign,
  PieChart,
  Layers
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

Aap mujhse live system aur database ke baare mein sawalat pooch sakte hain:
- **Kul Files / Numbers:** *"Total contractor ki file kitni hain?"* ya *"Pension section mein kitni files hain?"*
- **Specific File Status:** *"CFO-2627-5-1436 kahan hai?"* ya *"Receiving 1045 ka record dikhao"*
- **Department / Section Status:** *"Internal audit mein kaun si files hain?"* ya *"CIA mein kitni files hain?"*
- **Vendor Bills:** *"EE /E&M/W/DK ke bills dikhao"* ya *"Security deposit files report"*

Main live database se 100% accurate statistics aur records nikaal kar **Official Stamped PDF Report** aur **Excel** bhi download ke liye tayyar kar doonga!`,
        timestamp: new Date(),
      }
    ];
  });

  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [totalDbRecords, setTotalDbRecords] = useState<number>(0);
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return localStorage.getItem("kwsc_gemini_api_key") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  });
  const [keyInput, setKeyInput] = useState(geminiKey);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // On mount, pre-load the total record count
  useEffect(() => {
    (async () => {
      try {
        const count = await db.records.count();
        setTotalDbRecords(count);
      } catch (e) {}
    })();
  }, []);

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
      content: `Chat clear kar di gayi hai. Aap koi bhi naya sawal pooch sakte hain!`,
      timestamp: new Date()
    };
    setMessages([welcome]);
    localStorage.removeItem("kwsc_ai_chat_history");
    toast.info("Chat history cleared");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveApiKey = () => {
    localStorage.setItem("kwsc_gemini_api_key", keyInput.trim());
    setGeminiKey(keyInput.trim());
    setIsKeyDialogOpen(false);
    toast.success("Gemini API key saved!");
  };

  // Helper to get ALL records from BOTH Dexie + Supabase, merged and deduplicated
  const getAllDatabaseRecords = async (): Promise<FileRecord[]> => {
    const recordMap = new Map<string, FileRecord>();

    // 1. Load ALL from local IndexedDB (Dexie) — works offline, instant
    try {
      const localRecords = await db.records.toArray();
      for (const r of localRecords) {
        if (r.deleted_locally) continue;
        const key = r.receiving_number || r.cfo_diary_number || r.id || `local-${Math.random()}`;
        recordMap.set(key, r);
      }
      console.log(`[Ask AI] Loaded ${localRecords.length} records from IndexedDB`);
    } catch (e) {
      console.warn("Dexie read error", e);
    }

    // 2. ALWAYS also try Supabase cloud (fetch ALL pages, not just one)
    try {
      let page = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;
      let cloudCount = 0;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('file_tracking_records' as any)
          .select('id, cfo_diary_number, receiving_number, tracking_id, inward_date, received_from, main_category, sub_category, subject, mark_to, amount, gross_amount, deduction, status, remarks, employee_number, emp_no, emp_name, party_name, voucher_code, vehicle_no, handover_person_name, file_purpose, registration_date, print_date, outward_date, created_at, history, vendor_number, budget_code, additional_mark_to')
          .range(from, to);

        if (error) {
          console.warn("Supabase fetch error on page", page, error.message);
          break;
        }
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const r of data as any[]) {
          const key = r.receiving_number || r.cfo_diary_number || r.id;
          if (key && !recordMap.has(key)) {
            recordMap.set(key, r);
          }
        }
        cloudCount += data.length;
        
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
          if (page > 20) break; // Safety: max 20,000 records
        }
      }
      if (cloudCount > 0) {
        console.log(`[Ask AI] Loaded ${cloudCount} records from Supabase cloud`);
      }
    } catch (e) {
      console.warn("Supabase fetch error", e);
    }

    const allRecords = Array.from(recordMap.values()).filter(r => r.status !== 'trashed');
    console.log(`[Ask AI] Total merged records (after dedup): ${allRecords.length}`);
    return allRecords;
  };

  // Intelligent Local Query Engine
  const processQueryLocally = async (rawQuery: string): Promise<{ text: string; records: FileRecord[]; title: string }> => {
    const allRecords = await getAllDatabaseRecords();
    setTotalDbRecords(allRecords.length);
    const q = rawQuery.toLowerCase().trim();

    // Helper: get main_category regardless of field name variations
    const getMainCat = (r: any) => ((r.main_category || r.mainCategory || "")).toLowerCase();
    const getSubCat = (r: any) => ((r.sub_category || r.subCategory || "")).toLowerCase();

    const isCountQuery = 
      q.includes("kitni") || 
      q.includes("kitne") || 
      q.includes("total") || 
      q.includes("kul") || 
      q.includes("count") || 
      q.includes("how many") || 
      q.includes("tadad") ||
      q.includes("summary");

    // 1. CONTRACTOR QUERY
    if (q.includes("contractor") || q.includes("thekedar") || q.includes("contingenc") || q.includes("security deposit")) {
      const filtered = allRecords.filter(r => {
        const main = getMainCat(r);
        const sub = getSubCat(r);
        const party = (r.party_name || r.received_from || "").toLowerCase();
        const subj = (r.subject || "").toLowerCase();
        return (
          main === "contractor" || 
          sub.includes("contractor") || 
          sub.includes("contingenc") || 
          sub.includes("security-deposit") ||
          subj.includes("contractor") ||
          party.includes("contractor")
        );
      });

      let totalAmount = 0;
      const deptBreakdown: Record<string, number> = {};
      const subBreakdown: Record<string, number> = {};

      filtered.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
        const dept = (r.mark_to || r.status || "CFO Office").toUpperCase();
        deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
        const subCat = (getSubCat(r) || "contractor bills").toUpperCase();
        subBreakdown[subCat] = (subBreakdown[subCat] || 0) + 1;
      });

      const topDepts = Object.entries(deptBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([dept, count]) => `• **${dept}:** ${count} files`)
        .join("\n");

      const topSubs = Object.entries(subBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([sub, count]) => `• **${sub}:** ${count} files`)
        .join("\n");

      const responseText = `KWSC database mein **Contractor** category ki kul **${filtered.length} files** mojood hain:

📊 **Statistics Khulasa:**
- **Kul Files (Total Count):** \`${filtered.length}\` files
- **Kul Raqam (Total Amount):** **PKR ${totalAmount.toLocaleString('en-US')}**

🏢 **Kahan Kahan Mojood Hain (Mark To):**
${topDepts}

📁 **Sub-Category Breakdown:**
${topSubs}

Aap neeche diye gaye button se tamam **${filtered.length} files** ka **Official Stamped PDF Report** ya **Excel Spreadsheet** download kar sakte hain!`;

      return { text: responseText, records: filtered, title: "Contractor Files Report" };
    }

    // 2. PENSION QUERY
    if (q.includes("pension") || q.includes("pinshen") || q.includes("retired")) {
      const filtered = allRecords.filter(r => {
        const main = getMainCat(r);
        const sub = getSubCat(r);
        const subj = (r.subject || "").toLowerCase();
        return main === "pension" || main.includes("employee") && sub.includes("pension") || sub.includes("pension") || subj.includes("pension") || sub.includes("gratuity");
      });

      let totalAmount = 0;
      const deptBreakdown: Record<string, number> = {};
      filtered.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
        const dept = (r.mark_to || r.status || "Pension Section").toUpperCase();
        deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
      });

      const depts = Object.entries(deptBreakdown)
        .slice(0, 5)
        .map(([dept, count]) => `• **${dept}:** ${count} files`)
        .join("\n");

      const responseText = `KWSC database mein **Pension** section ki kul **${filtered.length} files** mojood hain:

📊 **Statistics:**
- **Total Files:** \`${filtered.length}\` files
- **Total Amount:** **PKR ${totalAmount.toLocaleString('en-US')}**

🏢 **Current Location Breakdown:**
${depts || "• Pension Section"}

Neeche diye gaye button se tamam **${filtered.length} files** ka **Official PDF Report** ya **Excel** download karein!`;

      return { text: responseText, records: filtered, title: "Pension Files Report" };
    }

    // 3. MEDICAL QUERY
    if (q.includes("medical") || q.includes("ilaj") || q.includes("hospital")) {
      const filtered = allRecords.filter(r => {
        const main = getMainCat(r);
        const sub = getSubCat(r);
        const subj = (r.subject || "").toLowerCase();
        return main === "medical" || main.includes("employee") && sub.includes("medical") || sub.includes("medical") || subj.includes("medical");
      });

      let totalAmount = 0;
      filtered.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
      });

      const responseText = `KWSC database mein **Medical Reimbursement / Cases** ki kul **${filtered.length} files** mojood hain:

📊 **Statistics:**
- **Total Files:** \`${filtered.length}\` files
- **Total Medical Valuation:** **PKR ${totalAmount.toLocaleString('en-US')}**

Poori list dekhne aur print karne ke liye **Download PDF** par click karein.`;

      return { text: responseText, records: filtered, title: "Medical Cases Report" };
    }

    // 4. POL BILLS / FUEL
    if (q.includes("pol") || q.includes("fuel") || q.includes("petrol") || q.includes("diesel")) {
      const filtered = allRecords.filter(r => {
        const main = getMainCat(r);
        const sub = getSubCat(r);
        const subj = (r.subject || "").toLowerCase();
        return main.includes("pol") || sub.includes("pol") || subj.includes("fuel") || subj.includes("petrol");
      });

      let totalAmount = 0;
      filtered.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
      });

      const responseText = `KWSC database mein **POL Bills / Fuel** ki kul **${filtered.length} files** darj hain:

📊 **Statistics:**
- **Total Files:** \`${filtered.length}\` files
- **Total Amount:** **PKR ${totalAmount.toLocaleString('en-US')}**`;

      return { text: responseText, records: filtered, title: "POL Bills Report" };
    }

    // 5. OVERALL TOTAL FILES IN SYSTEM
    if (isCountQuery && (q.includes("tamam") || q.includes("all") || q.includes("system") || q.includes("portal") || q.split(/\s+/).length <= 4)) {
      let totalAmount = 0;
      const catCount: Record<string, number> = {};

      allRecords.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
        const cat = (getMainCat(r) || "other").toUpperCase();
        catCount[cat] = (catCount[cat] || 0) + 1;
      });

      const catList = Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([c, count]) => `• **${c}:** ${count} files`)
        .join("\n");

      const responseText = `KWSC One-Window Facilitation portal mein is waqt kul **${allRecords.length} files** darj hain:

📊 **System-Wide Overview:**
- **Kul Files (Total Records):** \`${allRecords.length}\` files
- **Kul Valuation (Total Amount):** **PKR ${totalAmount.toLocaleString('en-US')}**

📁 **Category-wise Breakdown:**
${catList}

Aap kisi bhi specific category ya file number ke baare mein mazeed tafseelat pooch sakte hain!`;

      return { text: responseText, records: allRecords.slice(0, 100), title: "KWSC All Files Summary" };
    }

    // 6. SPECIFIC CFO DIARY OR RECEIVING NUMBER OR VENDOR NAME LOOKUP
    // Extract tokens
    const cleanTokens = q
      .replace(/(file|files|kahan hai|kahan|hai|dikhao|batao|status|details|ka|ki|ke|ko|mein|se|report|de|bhai)/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length >= 2);

    let matchedRecords = allRecords.filter(r => {
      const cfo = (r.cfo_diary_number || "").toLowerCase();
      const rec = (r.receiving_number || "").toLowerCase();
      const party = (r.party_name || r.received_from || "").toLowerCase();
      const subj = (r.subject || "").toLowerCase();
      const markTo = (r.mark_to || "").toLowerCase();
      const emp = ((r as any).emp_name || "").toLowerCase();
      const empNo = ((r as any).emp_no || (r as any).employee_number || "").toLowerCase();
      const cat = getMainCat(r);
      const sub = getSubCat(r);

      return cleanTokens.some(tok => 
        cfo.includes(tok) || 
        rec.includes(tok) || 
        party.includes(tok) || 
        subj.includes(tok) || 
        markTo.includes(tok) ||
        emp.includes(tok) ||
        empNo.includes(tok) ||
        cat.includes(tok) ||
        sub.includes(tok)
      );
    });

    if (matchedRecords.length > 0) {
      // If exact 1 match or specific file inquiry
      if (matchedRecords.length === 1 || cleanTokens.some(t => t.startsWith("cfo") || t.startsWith("dk") || t.startsWith("rc") || /\d{3,}/.test(t))) {
        const f = matchedRecords[0];
        const fMainCat = getMainCat(f) || 'N/A';
        const fSubCat = getSubCat(f);
        const responseText = `File record mil gaya hai:

📌 **File Details:**
- **CFO Diary No:** \`${f.cfo_diary_number || 'N/A'}\`
- **Receiving No:** \`${f.receiving_number || 'N/A'}\`
- **Party / Vendor:** **${f.party_name || f.received_from || 'N/A'}**
- **Category:** ${fMainCat.toUpperCase()} ${fSubCat ? `(${fSubCat})` : ''}
- **Subject:** ${f.subject || 'N/A'}
- **Amount:** **PKR ${f.amount ? Number(f.amount).toLocaleString('en-US') : '0'}**
- **Current Location / Mark To:** 🏢 **${f.mark_to || f.status || 'CFO Office'}**
- **Date Registered:** ${f.registration_date || f.inward_date || (f as any).created_at || 'N/A'}

Aap is file ka **Official Stamped PDF Report** ya **Excel Record** foran download kar sakte hain!`;

        return { text: responseText, records: matchedRecords, title: `File ${f.cfo_diary_number || f.receiving_number}` };
      }

      // Multiple matched records
      let totalAmount = 0;
      matchedRecords.forEach(r => {
        if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
      });

      const responseText = `Aap ki query ke mutabiq database mein **${matchedRecords.length} records** mile hain:

📊 **Khulasa:**
- **Kul Files:** \`${matchedRecords.length}\`
- **Kul Raqam:** **PKR ${totalAmount.toLocaleString('en-US')}**
- **Sab se pehla record:** \`${matchedRecords[0].cfo_diary_number || matchedRecords[0].receiving_number}\` (${matchedRecords[0].party_name || matchedRecords[0].received_from})

Neeche table mein records mojood hain. Official document ke liye **Download PDF** ya **Export Excel** button use karein.`;

      return { text: responseText, records: matchedRecords, title: `Search Results (${rawQuery})` };
    }

    // 7. NO RECORDS FOUND
    return {
      text: `Aap ki query **"${rawQuery}"** ke mutabiq database mein koi record nahi mila.

💡 **Rehnumai (Tips):**
- Agar kisi specific file ko dhoond rahe hain to exact **CFO Diary Number** (maslan: \`CFO-2026-458296\`) ya **Receiving Number** (maslan: \`DK-1599\`) likhein.
- Category ke liye: *"Total contractor files kitni hain?"*, *"Pension files kitni hain?"*, ya *"Medical bills"*.
- Vendor ke liye: Vendor ka naam ya receiving department likhein.`,
      records: [],
      title: "Query Result"
    };
  };

  // Generate Official Branded KWSC PDF
  const downloadOfficialPDF = async (queryTitle: string, records: FileRecord[]) => {
    try {
      toast.info("Official KWSC PDF Report tayyar ho raha hai...");
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
      doc.text(`Total Records: ${records.length}`, pageWidth - 14, 38, { align: "right" });

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
        (r.main_category || (r as any).mainCategory || "-").toUpperCase(),
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
          4: { cellWidth: 22 },
          5: { cellWidth: 38 },
          6: { halign: "right", cellWidth: 22 },
          7: { cellWidth: 26 }
        },
        didDrawPage: (data) => {
          // Watermark in center of page
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

          // Footer
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

  // Export to Excel
  const exportToExcel = (queryTitle: string, records: FileRecord[]) => {
    try {
      const dataForSheet = records.map((r, idx) => ({
        "S.No": idx + 1,
        "CFO Diary No": r.cfo_diary_number || "",
        "Receiving No": r.receiving_number || "",
        "Inward Date": r.inward_date || "",
        "Received From / Vendor": r.received_from || r.party_name || "",
        "Category": ((r.main_category || (r as any).mainCategory || "")).toUpperCase(),
        "Sub Category": (r.sub_category || (r as any).subCategory || ""),
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
      XLSX.writeFile(workbook, `KWSC_${queryTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`);
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
      // Execute our comprehensive local intelligence engine first
      const result = await processQueryLocally(textToSend);

      // Update AI message with verified accurate data
      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          return {
            ...m,
            content: result.text,
            records: result.records.length > 0 ? result.records : undefined,
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
            content: "Maazrat! Query process karne mein masla aya hai. Barah-e-karam dobara koshish karein.",
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
    "Total contractor ki file kitni hain?",
    "Pension section mein kitni files hain?",
    "Medical reimbursement bills",
    "Internal audit mein kaun si files hain?",
    "Portal par kul files kitni hain?",
    "POL bills summary"
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
                {totalDbRecords > 0 ? `${totalDbRecords.toLocaleString()} Records Indexed` : 'Live Database Connected'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accurate File Counts &bull; Live Status &bull; Official Stamped PDF &bull; Excel Export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Dialog for Gemini API Key */}
          <Dialog open={isKeyDialogOpen} onOpenChange={setIsKeyDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  Gemini API Key Configuration
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  Aap Google AI Studio (aistudio.google.com) se apni <strong>100% Free Gemini API Key</strong> yahan paste kar sakte hain.
                </p>
                <Input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="font-mono text-xs"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsKeyDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-blue-600 text-white" onClick={saveApiKey}>
                    Save Key
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Chat</span>
          </Button>

          <Link to="/book-section/file-tracking">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">File Tracking</span>
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

            <div className={`space-y-3 max-w-[85%] md:max-w-[82%]`}>
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
                  <div className="px-4 py-2.5 bg-blue-100/60 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Live Verified Database Records ({message.records.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-1.5 shadow-sm"
                        onClick={() => downloadOfficialPDF(message.records![0]?.main_category || "KWSC Records", message.records!)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Official PDF ({message.records.length})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-white dark:bg-slate-900 hover:bg-slate-100 border-emerald-300 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"
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
                            <th className="pb-2 font-semibold">Amount</th>
                            <th className="pb-2 font-semibold">Mark To</th>
                            <th className="pb-2 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100 dark:divide-blue-900/30">
                          {message.records.slice(0, 6).map((r, i) => (
                            <tr key={i} className="hover:bg-blue-100/30 dark:hover:bg-blue-900/20">
                              <td className="py-2 font-bold text-blue-900 dark:text-blue-300">
                                {r.cfo_diary_number || "-"}
                              </td>
                              <td className="py-2 text-slate-600 dark:text-slate-300">
                                {r.receiving_number || "-"}
                              </td>
                              <td className="py-2 text-slate-700 dark:text-slate-200 truncate max-w-[130px]">
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
                      {message.records.length > 6 && (
                        <p className="text-[11px] text-slate-500 mt-2 text-center">
                          +{message.records.length - 6} aur files report mein shamil hain. Tamam {message.records.length} files dekhne ke liye upar <strong>Download Official PDF</strong> ya <strong>Export Excel</strong> click karein.
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
          <HelpCircle className="w-3.5 h-3.5" /> Quick queries:
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
              placeholder="Sawal poochein... (e.g. Total contractor ki file kitni hain? ya CFO-2026-458296 kahan hai?)"
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
