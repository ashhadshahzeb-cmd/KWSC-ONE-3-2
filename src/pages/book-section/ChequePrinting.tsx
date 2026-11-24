import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  Save,
  Settings,
  CreditCard,
  Calendar,
  User,
  Hash,
  DollarSign,
  CheckCircle2,
  RotateCcw,
  Eye,
  Banknote,
  Building2,
  FileText,
  X,
  Sliders,
  Sparkles,
  QrCode,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

// ─── Number to Words Converter (Pakistani Rupees Style) ──────────────────────
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function threeDigits(n: number): string {
  if (n === 0) return "";
  if (n < 100) return twoDigits(n);
  return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigits(n % 100) : "");
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  if (num < 0) return "Minus " + numberToWords(-num);

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lac = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  let result = "";
  if (crore) result += threeDigits(crore) + " Crore ";
  if (lac) result += twoDigits(lac) + " Lac ";
  if (thousand) result += twoDigits(thousand) + " Thousand ";
  if (remainder) result += threeDigits(remainder);

  return result.trim();
}

function amountToWords(amount: number): string {
  const intPart = Math.floor(amount);
  const words = numberToWords(intPart);
  return `Rupees ${words} Only`;
}

// ─── Bank Configurations ──────────────────────────────────────────────────
type BankTemplate = "hbl-real" | "ubl-real" | "hbl" | "meezan";

interface BankConfig {
  id: BankTemplate;
  name: string;
  fullName: string;
  logoCode: string;
  branchName: string;
  branchAddress: string;
  primaryColor: string;
  secondaryColor: string;
  barColor: string;
  bgTint: string;
  defaultIban: string;
  bankMicrCode: string;
  photoUrl?: string;
  isRealPhoto?: boolean;
  // Percentage coordinates for real photo overlay
  overlay?: {
    date: { right: string; top: string; gap: string; boxW: string; boxH: string };
    payee: { left: string; top: string; width: string };
    words: { left: string; top: string; width: string };
    figures: { left: string; top: string; width: string };
    bearer: { left: string; top: string; width: string };
  };
}

const BANK_CONFIGS: Record<BankTemplate, BankConfig> = {
  "hbl-real": {
    id: "hbl-real",
    name: "HBL (Real Leaf)",
    fullName: "HABIB BANK LIMITED",
    logoCode: "HBL",
    branchName: "KW&SC HEAD OFFICE / PASRUR BRANCH",
    branchAddress: "HABIB BANK LIMITED, PAKISTAN",
    primaryColor: "#006B3F",
    secondaryColor: "#004D2C",
    barColor: "#006B3F",
    bgTint: "#f2fbf6",
    defaultIban: "PK68 HABB 0019 4379 0095 1101",
    bankMicrCode: "0541943",
    photoUrl: "/hbl-real-cheque-template.jpg",
    isRealPhoto: true,
    overlay: {
      date: { right: "7.8%", top: "18.5%", gap: "1.5px", boxW: "4.7mm", boxH: "6.2mm" },
      payee: { left: "14%", top: "16.5%", width: "50%" },
      words: { left: "16%", top: "37%", width: "65%" },
      figures: { left: "54%", top: "72%", width: "23%" },
      bearer: { left: "57%", top: "40.5%", width: "13mm" },
    },
  },
  "ubl-real": {
    id: "ubl-real",
    name: "UBL (Real Leaf)",
    fullName: "UNITED BANK LIMITED",
    logoCode: "UBL",
    branchName: "UBL BLDG NOR. NAZIMABAD KARACHI",
    branchAddress: "SF-14/B, UBL BLDG NORTH NAZIMABAD, KARACHI",
    primaryColor: "#005BA6",
    secondaryColor: "#003E73",
    barColor: "#005BA6",
    bgTint: "#f0f7fd",
    defaultIban: "PK93 UNIL 0109 0003 3909 6662",
    bankMicrCode: "0860544",
    photoUrl: "/ubl-real-cheque-template.jpg",
    isRealPhoto: true,
    overlay: {
      date: { right: "5.5%", top: "12%", gap: "2.5px", boxW: "4.8mm", boxH: "5.8mm" },
      payee: { left: "17.5%", top: "23.5%", width: "63%" },
      words: { left: "20%", top: "35.5%", width: "74%" },
      figures: { left: "65%", top: "60.5%", width: "28%" },
      bearer: { left: "83%", top: "28%", width: "12mm" },
    },
  },
  hbl: {
    id: "hbl",
    name: "HBL (Vector)",
    fullName: "HABIB BANK LIMITED",
    logoCode: "HBL",
    branchName: "KW&SC HEAD OFFICE BRANCH KARACHI",
    branchAddress: "9TH MILE KARSAZ, SHAHRAH-E-FAISAL, KARACHI",
    primaryColor: "#006B3F",
    secondaryColor: "#004D2C",
    barColor: "#006B3F",
    bgTint: "#f2fbf6",
    defaultIban: "PK42 HABB 0001 2345 6789 0102",
    bankMicrCode: "0012004",
  },
  meezan: {
    id: "meezan",
    name: "Meezan Bank",
    fullName: "MEEZAN BANK LIMITED",
    logoCode: "MBL",
    branchName: "CIVIC CENTRE BRANCH KARACHI",
    branchAddress: "GROUND FLOOR, CIVIC CENTRE, GULSHAN-E-IQBAL, KARACHI",
    primaryColor: "#1B5E20",
    secondaryColor: "#2E7D32",
    barColor: "#1B5E20",
    bgTint: "#f1f8f3",
    defaultIban: "PK71 MEZN 0002 0109 0003 3909",
    bankMicrCode: "0209001",
  },
};

// ─── Calibration Settings ───────────────────────────────────────────────────
interface PrintCalibration {
  topOffset: number;
  leftOffset: number;
  scale: number;
  printMode: "leaf" | "full";
}

const DEFAULT_CALIBRATION: PrintCalibration = {
  topOffset: 0,
  leftOffset: 0,
  scale: 100,
  printMode: "full",
};

const STORAGE_CAL_KEY = "kwsc-cheque-calibration";
const STORAGE_HISTORY_KEY = "kwsc-cheque-history";

function loadCalibration(): PrintCalibration {
  try {
    const saved = localStorage.getItem(STORAGE_CAL_KEY);
    if (saved) return { ...DEFAULT_CALIBRATION, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_CALIBRATION;
}

function saveCalibration(cal: PrintCalibration) {
  try {
    localStorage.setItem(STORAGE_CAL_KEY, JSON.stringify(cal));
  } catch {}
}

export default function ChequePrinting() {
  const { user } = useAuth();
  const chequeRef = useRef<HTMLDivElement>(null);

  // Form State - Default to real HBL leaf matching user photo
  const [bank, setBank] = useState<BankTemplate>("hbl-real");
  const [accountTitle, setAccountTitle] = useState("KARACHI WATER & SEWERAGE CORPORATION");
  const [iban, setIban] = useState(BANK_CONFIGS["hbl-real"].defaultIban);
  const [payeeName, setPayeeName] = useState("");
  const [amountFigures, setAmountFigures] = useState("");
  const [amountWords, setAmountWords] = useState("");
  const [chequeDate, setChequeDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [chequeNumber, setChequeNumber] = useState("00000007");
  const [acPayeeOnly, setAcPayeeOnly] = useState(true);
  const [crossCheque, setCrossCheque] = useState(true);
  const [strikeBearer, setStrikeBearer] = useState(true);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [calibration, setCalibration] = useState<PrintCalibration>(loadCalibration);
  const [savedCheques, setSavedCheques] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const config = BANK_CONFIGS[bank];
  const isRealPhotoTemplate = config.isRealPhoto === true;
  const overlay = config.overlay || BANK_CONFIGS["hbl-real"].overlay!;

  // Auto-convert amount to words
  useEffect(() => {
    const num = parseFloat(amountFigures);
    if (!isNaN(num) && num > 0) {
      setAmountWords(amountToWords(num));
    } else {
      setAmountWords("");
    }
  }, [amountFigures]);

  // When bank changes, update default IBAN if needed
  const handleBankChange = (newBank: BankTemplate) => {
    setBank(newBank);
    setIban(BANK_CONFIGS[newBank].defaultIban);
    if (newBank === "hbl-real") {
      setChequeNumber("00000007");
    } else if (newBank === "ubl-real") {
      setChequeNumber("86438889");
    }
  };

  // Persist calibration changes
  useEffect(() => {
    saveCalibration(calibration);
  }, [calibration]);

  // Load saved cheques from localStorage and Supabase
  useEffect(() => {
    loadSavedCheques();
  }, []);

  const loadSavedCheques = async () => {
    let list: any[] = [];
    try {
      const local = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (local) list = JSON.parse(local);
    } catch {}

    try {
      const { data } = await (supabase as any)
        .from("cheque_prints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        list = data;
      }
    } catch {}

    setSavedCheques(list);
  };

  // Date digits: 8 characters [D, D, M, M, Y, Y, Y, Y]
  const dateParts = chequeDate.split("-");
  const yearStr = dateParts[0] || "2026";
  const monthStr = dateParts[1] || "01";
  const dayStr = dateParts[2] || "01";
  const dateDigits = `${dayStr}${monthStr}${yearStr}`.split("");

  // Format amount with commas
  const formatAmount = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    return num.toLocaleString("en-PK");
  };

  // Print handler
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Save cheque record
  const handleSave = async () => {
    if (!payeeName.trim() || !amountFigures) {
      toast.error("Please fill in Payee Name and Amount");
      return;
    }
    setIsSaving(true);

    const newRecord = {
      id: "chq_" + Date.now(),
      bank_name: bank,
      payee_name: payeeName.trim(),
      amount: parseFloat(amountFigures),
      amount_words: amountWords,
      cheque_date: chequeDate,
      cheque_number: chequeNumber.trim() || "N/A",
      account_title: accountTitle,
      iban: iban,
      ac_payee_only: acPayeeOnly,
      cross_cheque: crossCheque,
      created_at: new Date().toISOString(),
      created_by: user?.email || "Admin",
    };

    // Save to localStorage immediately
    try {
      const updated = [newRecord, ...savedCheques.slice(0, 29)];
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
      setSavedCheques(updated);
    } catch {}

    // Try Supabase (silent fallback if table doesn't exist)
    try {
      await (supabase as any).from("cheque_prints").insert({
        bank_name: newRecord.bank_name,
        payee_name: newRecord.payee_name,
        amount: newRecord.amount,
        amount_words: newRecord.amount_words,
        cheque_date: newRecord.cheque_date,
        cheque_number: newRecord.cheque_number,
        ac_payee_only: newRecord.ac_payee_only,
        cross_cheque: newRecord.cross_cheque,
        created_by: user?.id,
      });
    } catch {}

    toast.success("Cheque record saved successfully!");
    setIsSaving(false);
  };

  // Reset form
  const handleReset = () => {
    setPayeeName("");
    setAmountFigures("");
    setAmountWords("");
    const d = new Date();
    setChequeDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    toast.info("Form reset");
  };

  // Load a saved cheque
  const loadCheque = (cheque: any) => {
    if (cheque.bank_name && (BANK_CONFIGS as any)[cheque.bank_name]) {
      setBank(cheque.bank_name as BankTemplate);
    }
    setPayeeName(cheque.payee_name || "");
    setAmountFigures(String(cheque.amount || ""));
    setAmountWords(cheque.amount_words || "");
    setChequeDate(cheque.cheque_date || "");
    setChequeNumber(cheque.cheque_number !== "N/A" ? cheque.cheque_number : "00000007");
    if (cheque.account_title) setAccountTitle(cheque.account_title);
    if (cheque.iban) setIban(cheque.iban);
    setAcPayeeOnly(cheque.ac_payee_only ?? true);
    setCrossCheque(cheque.cross_cheque ?? true);
    setShowHistory(false);
    toast.success(`Loaded cheque for ${cheque.payee_name}`);
  };

  const isPreprintedMode = calibration.printMode === "leaf";

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-5 md:p-8 space-y-6">
      {/* ── Top Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#006B3F] text-white flex items-center justify-center shadow-md">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Pakistani Cheque Printing
              </h1>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold">
                100% Real Cheque Leaf
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Live WYSIWYG matching your authentic HBL / UBL Pakistani Cheque • Exact overlay & print alignment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="flex-1 sm:flex-initial gap-1.5 border-slate-300"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>History ({savedCheques.length})</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className={`flex-1 sm:flex-initial gap-1.5 ${
              showSettings ? "bg-emerald-50 border-emerald-400 text-[#006B3F]" : "border-slate-300"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Calibration</span>
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial bg-[#006B3F] hover:bg-[#006B3F]/90 text-white font-semibold gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Cheque</span>
          </Button>
        </div>
      </motion.div>

      {/* ── Calibration Settings Drawer ───────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-slate-50 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#006B3F]" />
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      Printer Alignment & Cheque Mode Settings
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowSettings(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                  {/* Mode Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Print Destination Mode
                    </Label>
                    <div className="flex rounded-lg p-1 bg-white border border-slate-200 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setCalibration((c) => ({ ...c, printMode: "full" }))}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          calibration.printMode === "full"
                            ? "bg-[#006B3F] text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Full Cheque (Paper)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalibration((c) => ({ ...c, printMode: "leaf" }))}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          calibration.printMode === "leaf"
                            ? "bg-[#006B3F] text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Physical Leaf (Pre-printed)
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {calibration.printMode === "leaf"
                        ? "Hides pre-printed bank borders & logos so only your data is printed on the real leaf."
                        : "Prints full cheque leaf graphics on normal white A4 sheet."}
                    </p>
                  </div>

                  {/* Top Offset */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Top Margin Offset (mm)
                      </Label>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {calibration.topOffset} mm
                      </span>
                    </div>
                    <Input
                      type="number"
                      step="0.5"
                      value={calibration.topOffset}
                      onChange={(e) =>
                        setCalibration((c) => ({ ...c, topOffset: parseFloat(e.target.value) || 0 }))
                      }
                      className="bg-white font-mono text-sm"
                      placeholder="0"
                    />
                    <p className="text-[11px] text-slate-500">Move text up (-) or down (+)</p>
                  </div>

                  {/* Left Offset */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Left Margin Offset (mm)
                      </Label>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {calibration.leftOffset} mm
                      </span>
                    </div>
                    <Input
                      type="number"
                      step="0.5"
                      value={calibration.leftOffset}
                      onChange={(e) =>
                        setCalibration((c) => ({ ...c, leftOffset: parseFloat(e.target.value) || 0 }))
                      }
                      className="bg-white font-mono text-sm"
                      placeholder="0"
                    />
                    <p className="text-[11px] text-slate-500">Move text left (-) or right (+)</p>
                  </div>

                  {/* Scale */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Print Scale Zoom (%)
                      </Label>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {calibration.scale}%
                      </span>
                    </div>
                    <Input
                      type="number"
                      min="70"
                      max="130"
                      step="1"
                      value={calibration.scale}
                      onChange={(e) =>
                        setCalibration((c) => ({
                          ...c,
                          scale: Math.max(50, Math.min(150, parseFloat(e.target.value) || 100)),
                        }))
                      }
                      className="bg-white font-mono text-sm"
                      placeholder="100"
                    />
                    <p className="text-[11px] text-slate-500">Standard 100% for 210mm x 93mm leaf</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved Cheques History Drawer ─────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#006B3F]" />
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      Recent Cheque Records
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {savedCheques.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    No cheque records saved yet. Fill in details and click "Save Record".
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
                    {savedCheques.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => loadCheque(item)}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all cursor-pointer group space-y-1.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <Badge
                            className={`text-[10px] font-bold ${
                              item.bank_name?.includes("hbl")
                                ? "bg-[#006B3F] text-white"
                                : item.bank_name?.includes("meezan")
                                ? "bg-emerald-700 text-white"
                                : "bg-blue-700 text-white"
                            }`}
                          >
                            {String(item.bank_name || "hbl").toUpperCase()}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.cheque_date}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-[#006B3F] truncate">
                          {item.payee_name}
                        </p>
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>Rs. {Number(item.amount || 0).toLocaleString("en-PK")}</span>
                          {item.cheque_number && item.cheque_number !== "N/A" && (
                            <span className="font-mono text-[11px] text-slate-400">
                              #{item.cheque_number}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Layout: Form (Left 5) & WYSIWYG Real Cheque Leaf (Right 7) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: 5 cols */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="bg-[#006B3F] text-white py-3.5 px-5 rounded-t-xl">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  Cheque Details
                </span>
                <span className="text-xs font-normal text-emerald-100">Habib Bank / Pakistani Format</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Bank Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Cheque Style & Bank
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["hbl-real", "ubl-real", "hbl", "meezan"] as BankTemplate[]).map((b) => {
                    const bConfig = BANK_CONFIGS[b];
                    const isSelected = bank === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => handleBankChange(b)}
                        className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        {b.includes("real") ? (
                          <div
                            className={`w-7 h-7 rounded-md text-white flex items-center justify-center mb-1 ${
                              b === "hbl-real" ? "bg-[#006B3F]" : "bg-blue-600"
                            }`}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        ) : (
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center font-black text-white text-[11px] mb-1"
                            style={{ backgroundColor: bConfig.primaryColor }}
                          >
                            {bConfig.logoCode}
                          </div>
                        )}
                        <div className="font-bold text-[11px] text-slate-800 leading-tight">
                          {bConfig.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account Title & IBAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">Account Title</Label>
                  <Input
                    value={accountTitle}
                    onChange={(e) => setAccountTitle(e.target.value)}
                    placeholder="KW&SC / Account Name"
                    className="font-semibold text-xs bg-white uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">IBAN / A/C No.</Label>
                  <Input
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="PK..."
                    className="font-mono text-xs bg-white"
                  />
                </div>
              </div>

              {/* Cheque Date & Cheque Leaf Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#006B3F]" /> Cheque Date
                  </Label>
                  <Input
                    type="date"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="font-medium bg-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#006B3F]" /> Cheque Leaf No.
                  </Label>
                  <Input
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="00000007"
                    className="font-mono text-xs bg-white"
                  />
                </div>
              </div>

              {/* Payee Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#006B3F]" /> Pay To (Payee Name)
                </Label>
                <Input
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. SHOAIB YOUSAF or M/S ABC TRADERS"
                  className="font-bold text-slate-900 bg-white uppercase tracking-wide text-sm"
                />
              </div>

              {/* Amount Figures */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[#006B3F]" /> Amount in Figures (PKR)
                  </Label>
                  {amountFigures && (
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Rs. {formatAmount(amountFigures)}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={amountFigures}
                  onChange={(e) => setAmountFigures(e.target.value)}
                  placeholder="e.g. 500000"
                  className="font-mono text-base font-bold bg-white"
                />
              </div>

              {/* Amount Words */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#006B3F]" /> Amount in Words (Auto-Generated)
                  </Label>
                  <span className="text-[10px] text-slate-400">Editable Override</span>
                </div>
                <textarea
                  rows={2}
                  value={amountWords}
                  onChange={(e) => setAmountWords(e.target.value)}
                  placeholder="Rupees Five Lac Only..."
                  className="w-full text-xs sm:text-sm font-medium p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-800"
                />
              </div>

              <Separator />

              {/* Toggles */}
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Cross Cheque ( // )</div>
                    <div className="text-[11px] text-slate-500">Two parallel lines on top-left</div>
                  </div>
                  <Switch checked={crossCheque} onCheckedChange={setCrossCheque} />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">A/C Payee Only</div>
                    <div className="text-[11px] text-slate-500">Restricts to account deposit</div>
                  </div>
                  <Switch
                    checked={acPayeeOnly}
                    onCheckedChange={(val) => {
                      setAcPayeeOnly(val);
                      if (val) setCrossCheque(true);
                    }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Strike Out "or bearer"</div>
                    <div className="text-[11px] text-slate-500">Cancels cash counter withdrawal</div>
                  </div>
                  <Switch checked={strikeBearer} onCheckedChange={setStrikeBearer} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <Button
                  onClick={handlePrint}
                  className="bg-[#006B3F] hover:bg-[#006B3F]/90 text-white font-bold gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button
                  onClick={handleSave}
                  variant="outline"
                  disabled={isSaving}
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Preview: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-200/90 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-100/90 border-b border-slate-200 py-3 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-700" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  {isRealPhotoTemplate
                    ? `Authentic Cheque Leaf — ${config.name}`
                    : `WYSIWYG Cheque Preview (${config.fullName})`}
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[11px] font-mono border-slate-300 bg-white text-slate-700"
              >
                Mode: {calibration.printMode === "leaf" ? "Physical Leaf Only" : "Full Cheque"}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 bg-slate-300/40 flex items-center justify-center overflow-x-auto min-h-[460px]">
              {/* ══════════════════════════════════════════════════════════════════
                  REAL CHEQUE TEMPLATE (210mm x 93mm Standard)
                  Uses the EXACT real photo background from user's attached photo!
              ══════════════════════════════════════════════════════════════════ */}
              {isRealPhotoTemplate ? (
                /* ── REAL PHOTO TEMPLATE (HBL / UBL) ── */
                <div
                  ref={chequeRef}
                  id="cheque-print-area"
                  className={`cheque-leaf select-none ${isPreprintedMode ? "print-mode-leaf" : "print-mode-full"}`}
                  style={{
                    width: "210mm",
                    height: "93mm",
                    minWidth: "210mm",
                    minHeight: "93mm",
                    backgroundImage: isPreprintedMode ? "none" : `url(${config.photoUrl})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    borderRadius: "4px",
                    position: "relative",
                    boxSizing: "border-box",
                    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
                    overflow: "hidden",
                  }}
                >
                  {/* Top-Left Crossing */}
                  {crossCheque && (
                    <div
                      id="crossing-mark"
                      style={{
                        position: "absolute",
                        top: "1mm",
                        left: "3mm",
                        width: "30mm",
                        height: "17mm",
                        borderLeft: "2.5px solid #0f172a",
                        borderRight: "2.5px solid #0f172a",
                        transform: "rotate(-32deg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 30,
                      }}
                    >
                      {acPayeeOnly && (
                        <span
                          style={{
                            fontSize: "7.5px",
                            fontWeight: 900,
                            color: "#0f172a",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                            fontFamily: "Arial, sans-serif",
                            backgroundColor: "rgba(255,255,255,0.75)",
                            padding: "0 2px",
                          }}
                        >
                          A/C PAYEE ONLY
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Overlaid Date Digits ── */}
                  <div
                    style={{
                      position: "absolute",
                      right: overlay.date.right,
                      top: overlay.date.top,
                      display: "flex",
                      gap: overlay.date.gap,
                      zIndex: 20,
                    }}
                  >
                    {dateDigits.map((char, index) => (
                      <div
                        key={index}
                        style={{
                          width: overlay.date.boxW,
                          height: overlay.date.boxH,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontWeight: 900,
                          color: "#0f172a",
                          fontFamily: "'Courier New', Courier, monospace",
                        }}
                      >
                        {char}
                      </div>
                    ))}
                  </div>

                  {/* ── Overlaid Payee Name ── */}
                  <div
                    style={{
                      position: "absolute",
                      left: overlay.payee.left,
                      top: overlay.payee.top,
                      width: overlay.payee.width,
                      zIndex: 20,
                    }}
                  >
                    <span
                      id="print-payee-name"
                      style={{
                        fontSize: "14px",
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                      }}
                    >
                      {payeeName ? `** ${payeeName} **` : ""}
                    </span>
                  </div>

                  {/* ── Bearer Strike Out Mark ── */}
                  {strikeBearer && (
                    <div
                      style={{
                        position: "absolute",
                        left: overlay.bearer.left,
                        top: overlay.bearer.top,
                        width: overlay.bearer.width,
                        height: "2px",
                        backgroundColor: "#dc2626",
                        zIndex: 25,
                      }}
                    />
                  )}

                  {/* ── Overlaid Amount in Words ── */}
                  <div
                    style={{
                      position: "absolute",
                      left: overlay.words.left,
                      top: overlay.words.top,
                      width: overlay.words.width,
                      zIndex: 20,
                    }}
                  >
                    <span
                      id="print-amount-words"
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: "0.3px",
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                      }}
                    >
                      {amountWords ? `** ${amountWords} **` : ""}
                    </span>
                  </div>

                  {/* ── Overlaid Amount in Figures ── */}
                  <div
                    style={{
                      position: "absolute",
                      left: overlay.figures.left,
                      top: overlay.figures.top,
                      width: overlay.figures.width,
                      textAlign: "center",
                      zIndex: 20,
                    }}
                  >
                    <span
                      id="print-amount-figures"
                      style={{
                        fontSize: "15px",
                        fontWeight: 900,
                        color: "#0f172a",
                        fontFamily: "'Courier New', Courier, monospace",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {amountFigures ? `= ${formatAmount(amountFigures)} /-` : ""}
                    </span>
                  </div>
                </div>
              ) : (
                /* ── CRISP VECTOR TEMPLATE (HBL / MEEZAN) ── */
                <div
                  ref={chequeRef}
                  id="cheque-print-area"
                  className={`cheque-leaf select-none ${isPreprintedMode ? "print-mode-leaf" : "print-mode-full"}`}
                  style={{
                    width: "210mm",
                    height: "93mm",
                    minWidth: "210mm",
                    minHeight: "93mm",
                    background: config.bgTint,
                    border: `1.5px solid ${config.primaryColor}`,
                    borderRadius: "4px",
                    padding: "0",
                    position: "relative",
                    boxSizing: "border-box",
                    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    className="cheque-decor"
                    style={{
                      height: "14mm",
                      borderBottom: `2.5px solid ${config.barColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 8mm",
                      backgroundColor: "#ffffff",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          padding: "2px 8px",
                          backgroundColor: config.primaryColor,
                          color: "#ffffff",
                          fontWeight: 900,
                          fontSize: "13px",
                          borderRadius: "3px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {config.name}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 900,
                            color: config.primaryColor,
                            lineHeight: "1.1",
                          }}
                        >
                          {config.fullName}
                        </div>
                        <div
                          style={{
                            fontSize: "7.5px",
                            fontWeight: 600,
                            color: "#475569",
                            letterSpacing: "0.2px",
                          }}
                        >
                          {config.branchName}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "4mm 8mm 2mm 8mm",
                      position: "relative",
                      height: "79mm",
                      boxSizing: "border-box",
                    }}
                  >
                    {crossCheque && (
                      <div
                        id="crossing-mark"
                        style={{
                          position: "absolute",
                          top: "-2mm",
                          left: "4mm",
                          width: "28mm",
                          height: "15mm",
                          borderLeft: "2px solid #0f172a",
                          borderRight: "2px solid #0f172a",
                          transform: "rotate(-30deg)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 20,
                        }}
                      >
                        {acPayeeOnly && (
                          <span
                            style={{
                              fontSize: "7.5px",
                              fontWeight: 900,
                              color: "#0f172a",
                              letterSpacing: "0.5px",
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                              fontFamily: "Arial, sans-serif",
                            }}
                          >
                            A/C PAYEE ONLY
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "3mm",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span
                          className="cheque-decor"
                          style={{
                            fontSize: "9.5px",
                            fontWeight: 800,
                            color: config.primaryColor,
                            letterSpacing: "0.5px",
                          }}
                        >
                          Date
                        </span>
                        <div style={{ display: "flex", gap: "1.5px" }}>
                          {dateDigits.map((char, index) => (
                            <div
                              key={index}
                              className="date-box"
                              style={{
                                width: "5mm",
                                height: "6mm",
                                border: `1px solid ${config.primaryColor}`,
                                borderRadius: "1.5px",
                                backgroundColor: "rgba(255, 255, 255, 0.95)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "#0f172a",
                                fontFamily: "'Courier New', Courier, monospace",
                              }}
                            >
                              {char}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "6px",
                        marginBottom: "3mm",
                      }}
                    >
                      <span
                        className="cheque-decor"
                        style={{
                          fontSize: "12px",
                          fontWeight: 900,
                          color: config.primaryColor,
                          letterSpacing: "0.5px",
                          width: "12mm",
                        }}
                      >
                        Pay
                      </span>
                      <div
                        style={{
                          flex: 1,
                          borderBottom: `1.2px solid ${config.primaryColor}`,
                          paddingBottom: "1px",
                          minHeight: "5.5mm",
                          display: "flex",
                          alignItems: "flex-end",
                        }}
                      >
                        <span
                          id="print-payee-name"
                          style={{
                            fontSize: "14px",
                            fontWeight: 800,
                            color: "#0f172a",
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                          }}
                        >
                          {payeeName ? `** ${payeeName} **` : ""}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "6px",
                        marginBottom: "2.5mm",
                      }}
                    >
                      <span
                        className="cheque-decor"
                        style={{
                          fontSize: "11px",
                          fontWeight: 900,
                          color: config.primaryColor,
                          letterSpacing: "0.5px",
                          width: "14mm",
                        }}
                      >
                        Rupees
                      </span>
                      <div
                        style={{
                          flex: 1,
                          borderBottom: `1.2px solid ${config.primaryColor}`,
                          paddingBottom: "1px",
                          minHeight: "5.5mm",
                          display: "flex",
                          alignItems: "flex-end",
                        }}
                      >
                        <span
                          id="print-amount-words"
                          style={{
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "#0f172a",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {amountWords ? `** ${amountWords} **` : ""}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        position: "absolute",
                        right: "60mm",
                        bottom: "14mm",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div
                        id="print-amount-figures-box"
                        style={{
                          border: `1.5px solid ${config.primaryColor}`,
                          borderRadius: "3px",
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="cheque-decor"
                          style={{
                            backgroundColor: config.primaryColor,
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: 900,
                            padding: "2.5mm 3.5mm",
                            letterSpacing: "0.5px",
                          }}
                        >
                          PKR
                        </div>
                        <div
                          style={{
                            padding: "2mm 4mm",
                            minWidth: "32mm",
                            textAlign: "right",
                          }}
                        >
                          <span
                            id="print-amount-figures"
                            style={{
                              fontSize: "14px",
                              fontWeight: 900,
                              color: "#0f172a",
                              fontFamily: "'Courier New', Courier, monospace",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {amountFigures ? `= ${formatAmount(amountFigures)} /-` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guidelines Banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 text-xs text-emerald-950 space-y-1.5 shadow-xs">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              Pakistani Standard Cheque Printing Tips:
            </div>
            <ul className="list-disc list-inside space-y-1 text-emerald-900/90">
              <li>
                <strong>HBL Real Cheque Leaf:</strong> Set by default with your exact uploaded HBL cheque photo!
              </li>
              <li>
                <strong>Printing on Real Cheque:</strong> Click <strong>Calibration</strong> &gt; set <strong>"Physical Leaf (Pre-printed)"</strong> so background image is hidden and only your typed text prints directly onto your real bank cheque.
              </li>
              <li>
                <strong>Browser Print Dialog:</strong> Press <strong>Ctrl + P</strong>, set <strong>Margins: None</strong>, and ensure <strong>Background graphics</strong> is checked.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Global Print Styles ────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          
          #cheque-print-area,
          #cheque-print-area * {
            visibility: visible !important;
          }

          #cheque-print-area {
            position: fixed !important;
            top: ${calibration.topOffset}mm !important;
            left: ${calibration.leftOffset}mm !important;
            width: 210mm !important;
            height: 93mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            transform: scale(${calibration.scale / 100}) !important;
            transform-origin: top left !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-mode-leaf {
            background: transparent !important;
            background-image: none !important;
            border: none !important;
          }
          .print-mode-leaf .cheque-decor {
            display: none !important;
            visibility: hidden !important;
          }
          .print-mode-leaf .date-box {
            border: none !important;
            background: transparent !important;
          }
          .print-mode-leaf #print-amount-figures-box {
            border: none !important;
            background: transparent !important;
          }
          .print-mode-leaf div[style*="borderBottom"] {
            border-bottom-color: transparent !important;
          }

          @page {
            size: 210mm 93mm;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}
