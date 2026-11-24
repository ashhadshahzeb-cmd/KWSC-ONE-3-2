import { safeCopyToClipboard } from '@/utils/clipboard';
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  QrCode,
  UserCheck,
  FileText,
  Building,
  Building2,
  FolderTree,
  MapPin,
  Home,
  Bell,
  Settings,
  Users,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  Tag,
  Hash,
  Truck,
  DollarSign,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  Lock,
  KeyRound
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { MobileMenu } from "@/components/MobileMenu";
import { toast } from "sonner";

const REQUIRED_TRACKING_PASSWORD = "gmqaBhK6@90";

const SECTION_LABELS: Record<string, string> = {
  cfo: "CFO Office",
  cia: "CIA",
  budget: "Budget Section",
  pension: "Pension Section",
  fund: "Fund Section",
  internal_audit_1: "Internal Audit-1",
  director_account: "Director Account",
  director_finance: "Director Finance",
  director_it: "Director IT",
  sub_cfo: "Asst. CFO",
  books: "Book Section",
  establishment: "Establishment",
  director_audit: "Director Audit",
  internal_audit_2: "Internal Audit-2",
  law_department: "Law Department",
  chro: "CHRO",
  md_office: "MD Office",
};

const getSectionName = (sec?: string | null) => {
  if (!sec) return "Pending Processing";
  const lower = sec.toLowerCase().trim();
  return SECTION_LABELS[lower] || sec.toUpperCase();
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatTime = (dateStr?: string | null) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function PublicTracking() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Authentication State with Session Persistence
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("kwsc_tracking_auth") === "true";
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const diaryNo = params.diaryNo || searchParams.get("diary") || "";
  const receivingNo = params["*"] || searchParams.get("receiving") || searchParams.get("code") || "";
  const genericQuery = searchParams.get("q") || "";

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput.trim() === REQUIRED_TRACKING_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
      try {
        sessionStorage.setItem("kwsc_tracking_auth", "true");
      } catch {}
      toast.success("Security verified! Loading file details...");
    } else {
      setPasswordError("Incorrect password. Please enter the correct password.");
    }
  };

  const fetchRecord = async () => {
    setLoading(true);
    try {
      const rawA = decodeURIComponent(diaryNo || "").trim();
      const rawB = decodeURIComponent(receivingNo || "").trim();
      const rawQ = decodeURIComponent(genericQuery || "").trim();

      const candidateSet = new Set<string>();
      [rawA, rawB, rawQ].forEach((v) => {
        if (!v) return;
        candidateSet.add(v);
        candidateSet.add(v.replace(/CF0-/gi, "CFO-"));
        candidateSet.add(v.replace(/CFO-/gi, "CF0-"));
        candidateSet.add(v.replace(/\s+/g, ""));
      });

      const candidates = Array.from(candidateSet).filter((t) => t.length > 0);

      let foundData: any = null;

      if (candidates.length > 0) {
        // 1. First attempt: Query Supabase
        try {
          const termsString = candidates.map((c) => `"${c}"`).join(",");
          const { data, error } = await supabase
            .from("file_tracking_records" as any)
            .select("*")
            .or(
              `cfo_diary_number.in.(${termsString}),receiving_number.in.(${termsString}),tracking_id.in.(${termsString})`
            )
            .order("created_at", { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            foundData = data[0];
          }
        } catch (dbErr) {
          console.warn("Supabase fetch failed, trying local DB fallback:", dbErr);
        }

        // 2. Fallback to local Dexie IndexedDB if offline or not in Supabase
        if (!foundData) {
          try {
            for (const cand of candidates) {
              const localRec =
                (await db.records.where("receiving_number").equals(cand).first()) ||
                (await db.records.where("cfo_diary_number").equals(cand).first()) ||
                (await db.records.where("tracking_id").equals(cand).first());
              if (localRec) {
                foundData = localRec;
                break;
              }
            }
          } catch (dexieErr) {
            console.warn("Dexie lookup failed:", dexieErr);
          }
        }
      }

      if (foundData) {
        // Collect document photos
        let docImages: string[] = [];
        if (Array.isArray(foundData.file_images) && foundData.file_images.length > 0) {
          docImages = foundData.file_images.filter(Boolean);
        } else if (foundData.file_image) {
          docImages = [foundData.file_image];
        }

        setRecord({
          cfo_diary_number: foundData.cfo_diary_number || diaryNo,
          receiving_number: foundData.receiving_number || receivingNo,
          tracking_id: foundData.tracking_id || "",
          subject: foundData.subject || "No Subject Provided",
          mainCategory: foundData.main_category || "",
          subCategory: foundData.sub_category || "",
          status: foundData.status || "In-Process",
          amount: Number(foundData.amount) || 0,
          gross_amount: Number(foundData.gross_amount) || 0,
          deduction: Number(foundData.deduction) || 0,
          forward_to: foundData.mark_to || "",
          additional_mark_to: foundData.additional_mark_to || "",
          handover_person_name: foundData.handover_person_name || "",
          file_purpose: foundData.file_purpose || "",
          received_from: foundData.received_from || "",
          vendor_number: foundData.vendor_number || "",
          remarks: foundData.remarks || "",
          registration_date: foundData.created_at || foundData.registration_date,
          outward_date: foundData.outward_date,
          print_date: foundData.print_date,
          inward_date: foundData.inward_date,
          date_of_sign: foundData.date_of_sign,
          department_number: foundData.employee_number || foundData.department_number || "",
          budget_code: foundData.budget_code || "",
          sub_budget_head: foundData.sub_budget_head || "",
          voucher_code: foundData.voucher_code || "",
          vehicle_no: foundData.vehicle_no || "",
          file_images: docImages,
          history: Array.isArray(foundData.history) ? foundData.history : [],
        });
      } else {
        setRecord(null);
      }
    } catch (err) {
      console.error("Error loading public record:", err);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchRecord();
  }, [diaryNo, receivingNo, genericQuery, isAuthenticated]);

  const handleCopyLink = () => {
    safeCopyToClipboard(window.location.href);
    setCopied(true);
    toast.success("Tracking link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const EXPO_OUT = [0.16, 1, 0.3, 1] as any;

  // ── Password Protection Lock Screen ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4 font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: EXPO_OUT }}
          className="w-full max-w-sm bg-white p-7 rounded-[2.5rem] shadow-2xl border border-slate-200/80 text-center relative overflow-hidden"
        >
          {/* Top blue glow line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

          {/* Security Icon */}
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner text-blue-600">
            <Lock className="w-8 h-8 text-blue-600 stroke-[2.2]" />
          </div>

          <h2 className="text-xl font-black text-slate-900 tracking-tight mb-1">
            Protected File Record
          </h2>
          <p className="text-xs font-semibold text-slate-500 mb-5">
            Enter authorized security password to access live file details
          </p>

          {/* Quick Info Pill */}
          {(diaryNo || receivingNo) && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 mb-5 font-mono text-[11px] font-bold text-slate-700 flex justify-around">
              {diaryNo && <span>Diary: <strong className="text-blue-700">{diaryNo}</strong></span>}
              {receivingNo && <span>Receiving: <strong className="text-emerald-700">{receivingNo}</strong></span>}
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter Password"
                value={passwordInput}
                autoFocus
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError("");
                }}
                className="w-full h-12 bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 pr-11 text-center font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:bg-white transition-all text-sm tracking-wide font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passwordError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200 animate-shake">
                {passwordError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black rounded-2xl uppercase tracking-wider text-xs shadow-lg shadow-blue-600/30 transition-all font-mono gap-2"
            >
              <KeyRound className="w-4 h-4" />
              Unlock Details
            </Button>
          </form>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 font-mono">
            KW&amp;SC Official File Tracking
          </p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500 font-mono">
          Fetching Live File Details...
        </p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Record Not Found</h2>
          <p className="text-sm font-medium text-slate-500 mb-4">
            Could not find file tracking record for:
          </p>
          <div className="bg-slate-100 rounded-xl p-3 mb-6 font-mono text-xs font-bold text-slate-700 break-all space-y-1">
            {diaryNo && <div>CFO Diary: <span className="text-blue-600">{diaryNo}</span></div>}
            {receivingNo && <div>Receiving No: <span className="text-emerald-600">{receivingNo}</span></div>}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/track")}
              className="flex-1 rounded-xl font-bold text-xs"
            >
              Search Again
            </Button>
            <Button
              onClick={fetchRecord}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const historyList = record.history || [];

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans pb-16 antialiased">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/track")}
              className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-black tracking-tight text-blue-900">
                  KW&SC
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  ONE-WINDOW
                </span>
              </div>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Tracking Token
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              title="Copy tracking link"
              className="w-9 h-9 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchRecord}
              title="Refresh status"
              className="w-9 h-9 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        
        {/* ── 1. Hero Ticket Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EXPO_OUT }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden"
        >
          {/* Accent top gradient stripe */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500" />

          <div className="flex items-center justify-between gap-2 mb-3 pt-1">
            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 text-[10px] font-black uppercase tracking-wider font-mono px-2.5 py-0.5 rounded-lg">
              Official Token Record
            </Badge>
            {record.tracking_id && (
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tight">
                {record.tracking_id}
              </span>
            )}
          </div>

          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-snug">
            {record.subject}
          </h1>

          {/* Quick Dual Badge (CFO Diary & Receiving) */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="bg-blue-50/80 rounded-2xl p-3 border border-blue-100">
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block font-mono">
                CFO Diary No
              </span>
              <p className="text-sm md:text-base font-black text-slate-900 font-mono mt-0.5 tracking-tight break-all">
                {record.cfo_diary_number || "—"}
              </p>
            </div>
            <div className="bg-emerald-50/80 rounded-2xl p-3 border border-emerald-100">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block font-mono">
                Receiving No
              </span>
              <p className="text-sm md:text-base font-black text-slate-900 font-mono mt-0.5 tracking-tight break-all">
                {record.receiving_number || "—"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── 2. Live Movement / Section Status ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: EXPO_OUT }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                Current Location &amp; Status
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Departmental Movement</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Currently Marked To
              </span>
              <p className="text-base font-black text-blue-700 tracking-tight font-mono mt-0.5">
                {getSectionName(record.forward_to)}
              </p>
              {record.additional_mark_to && (
                <p className="text-xs font-bold text-purple-700 mt-1 font-mono">
                  + Also Marked To: {getSectionName(record.additional_mark_to)}
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          {record.handover_person_name && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 font-mono">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Handover Person / Custodian: <strong className="text-slate-800">{record.handover_person_name}</strong></span>
            </div>
          )}
        </motion.div>

        {/* ── 3. Financial Amount Card (if Amount > 0) ── */}
        {(record.amount > 0 || record.gross_amount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EXPO_OUT }}
            className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-white shadow-lg shadow-emerald-700/10"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100 font-mono flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Net Verified Amount
              </span>
              <Badge className="bg-white/20 text-white hover:bg-white/20 border-none text-[10px] font-black uppercase font-mono">
                Verified
              </Badge>
            </div>
            <p className="text-2xl md:text-3xl font-black tracking-tight font-mono">
              PKR {record.amount.toLocaleString()}
            </p>

            {(record.gross_amount > 0 || record.deduction > 0) && (
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/20 text-xs font-mono">
                {record.gross_amount > 0 && (
                  <div>
                    <span className="text-white/70 text-[10px] block">Gross Amount:</span>
                    <strong className="text-white">PKR {record.gross_amount.toLocaleString()}</strong>
                  </div>
                )}
                {record.deduction > 0 && (
                  <div>
                    <span className="text-white/70 text-[10px] block">Deduction:</span>
                    <strong className="text-white">PKR {record.deduction.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── 4. Complete File Details Breakdown ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: EXPO_OUT }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              Complete File Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            {/* Category */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <FolderTree className="w-3 h-3 text-blue-500" /> Category
              </span>
              <p className="text-sm font-black text-slate-800 capitalize mt-0.5">
                {record.mainCategory ? record.mainCategory.replace(/_/g, " ") : "General"}
                {record.subCategory && ` / ${record.subCategory.replace(/_/g, " ")}`}
              </p>
            </div>

            {/* File Purpose */}
            {record.file_purpose && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Tag className="w-3 h-3 text-emerald-500" /> File Purpose
                </span>
                <p className="text-sm font-black text-slate-800 mt-0.5">
                  {record.file_purpose}
                </p>
              </div>
            )}

            {/* Received From / Vendor / Payee */}
            {record.received_from && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Users className="w-3 h-3 text-purple-500" /> Received From / Vendor / Payee
                </span>
                <p className="text-sm font-black text-purple-950 mt-0.5">
                  {record.received_from}
                  {record.vendor_number && (
                    <span className="text-xs font-bold text-purple-700 ml-2">
                      (Vendor #{record.vendor_number})
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Department / Employee No */}
            {record.department_number && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Building className="w-3 h-3 text-amber-500" /> Dept / Employee No
                </span>
                <p className="text-sm font-black text-slate-800 mt-0.5">
                  {record.department_number}
                </p>
              </div>
            )}

            {/* Budget Code */}
            {record.budget_code && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Hash className="w-3 h-3 text-blue-500" /> Budget Code
                </span>
                <p className="text-sm font-black text-slate-800 mt-0.5">
                  {record.budget_code}
                  {record.sub_budget_head && ` (${record.sub_budget_head})`}
                </p>
              </div>
            )}

            {/* Vehicle No */}
            {record.vehicle_no && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Truck className="w-3 h-3 text-orange-500" /> Vehicle No
                </span>
                <p className="text-sm font-black text-slate-800 mt-0.5">
                  {record.vehicle_no}
                </p>
              </div>
            )}

            {/* Voucher Code */}
            {record.voucher_code && (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <FileText className="w-3 h-3 text-teal-500" /> Voucher Code
                </span>
                <p className="text-sm font-black text-slate-800 mt-0.5">
                  {record.voucher_code}
                </p>
              </div>
            )}
          </div>

          {/* Remarks */}
          {record.remarks && (
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/60 text-xs font-mono">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                Remarks / Instructions
              </span>
              <p className="text-slate-800 font-medium whitespace-pre-wrap">
                {record.remarks}
              </p>
            </div>
          )}
        </motion.div>

        {/* ── 5. Important Dates Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: EXPO_OUT }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              Record Timeline Dates
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Inward Date</span>
              <p className="font-bold text-slate-900 mt-0.5">{formatDate(record.inward_date)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Outward Date</span>
              <p className="font-bold text-slate-900 mt-0.5">{formatDate(record.outward_date)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Date of Signature</span>
              <p className="font-bold text-slate-900 mt-0.5">{formatDate(record.date_of_sign)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Printed Date</span>
              <p className="font-bold text-slate-900 mt-0.5">{formatDate(record.print_date)}</p>
            </div>
          </div>
        </motion.div>

        {/* ── 6. Attached Document Images (Photos) ── */}
        {record.file_images && record.file_images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: EXPO_OUT }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                  <Eye className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                  Attached Document Images ({record.file_images.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 font-mono">Click to preview</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-1">
              {record.file_images.map((imgUrl: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setPreviewImage(imgUrl)}
                  className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                >
                  <img
                    src={imgUrl}
                    alt={`Attached Document ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                  </div>
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── 7. Activity & Movement Log ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: EXPO_OUT }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <History className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
              Activity &amp; Movement History
            </h3>
          </div>

          {historyList.length > 0 ? (
            <div className="space-y-3 font-mono">
              {historyList.map((step: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
                        {step.action || step.processed_by || "Movement"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatDate(step.date || step.timestamp)} {formatTime(step.date || step.timestamp)}
                      </span>
                    </div>

                    {(step.from || step.to) && (
                      <p className="text-[11px] font-bold text-blue-700 mt-1">
                        {step.from && <span>From: {getSectionName(step.from)} </span>}
                        {step.to && <span>&rarr; To: {getSectionName(step.to)}</span>}
                      </p>
                    )}

                    {step.remarks && (
                      <p className="text-xs text-slate-600 mt-1 italic">
                        "{step.remarks}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 font-mono text-xs">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
              File registered successfully with official verification.
            </div>
          )}
        </motion.div>

        {/* Action Button: Track another file */}
        <div className="pt-2 pb-6 text-center">
          <Button
            onClick={() => navigate("/track")}
            variant="outline"
            className="rounded-2xl border-slate-300 text-slate-700 font-bold text-xs px-6 py-2.5 hover:bg-white shadow-sm font-mono"
          >
            &larr; Track Another File
          </Button>
        </div>

      </main>

      {/* Full-Screen Image Lightbox Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Full Preview"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
