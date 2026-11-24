import { safeCopyToClipboard } from '@/utils/clipboard';
// src/pages/book-section/LinkedFileTracking.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Link2,
  FileText,
  Search,
  RefreshCw,
  Printer,
  Copy,
  Check,
  Eye,
  Building2,
  Calendar,
  Coins,
  User,
  ArrowRight,
  Layers,
  Network,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
  Clock,
  FolderTree,
  FileCheck2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LinkedGroup {
  parentDiary: string;
  parentRecord: any;
  childRecords: any[];
  allRecords: any[];
  totalAmount: number;
}

// Helper to extract image(s) from record or its history
const extractRecordImages = (rec: any): string[] => {
  if (!rec) return [];
  if (Array.isArray(rec.file_images) && rec.file_images.length > 0) {
    return rec.file_images.filter(Boolean);
  }
  if (typeof rec.file_image === 'string' && rec.file_image.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rec.file_image);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
    } catch {}
  }
  if (Array.isArray(rec.history) && rec.history.length > 0) {
    for (const h of [...rec.history].reverse()) {
      if (Array.isArray(h?.file_images) && h.file_images.length > 0) {
        return h.file_images.filter(Boolean);
      }
      if (typeof h?.file_image === 'string' && h.file_image.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(h.file_image);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
        } catch {}
      }
      if (h?.file_image && typeof h.file_image === 'string') {
        return [h.file_image];
      }
    }
  }
  if (rec.file_image && typeof rec.file_image === 'string') {
    return [rec.file_image];
  }
  return [];
};

export default function LinkedFileTracking() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>([]);
  const [expandedGroupDiaries, setExpandedGroupDiaries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Full Details & Picture Modal State
  const [selectedRecordForModal, setSelectedRecordForModal] = useState<any | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [isFullScreenPhoto, setIsFullScreenPhoto] = useState(false);

  useEffect(() => {
    loadAllLinkedRecords();
  }, []);

  const loadAllLinkedRecords = async () => {
    setLoading(true);
    try {
      const { data: children, error: err1 } = await (supabase
        .from('file_tracking_records' as any)
        .select('*')
        .not('parent_diary_number', 'is', null)
        .order('created_at', { ascending: false }) as any);
      if (err1) throw err1;

      if (!children || children.length === 0) {
        setLinkedGroups([]);
        setInitialLoading(false);
        setLoading(false);
        return;
      }

      const parentDiaries = Array.from(
        new Set(children.map((c: any) => c.parent_diary_number).filter(Boolean))
      ) as string[];

      let parents: any[] = [];
      if (parentDiaries.length > 0) {
        const { data: parentData, error: err2 } = await (supabase
          .from('file_tracking_records' as any)
          .select('*')
          .in('cfo_diary_number', parentDiaries) as any);
        if (!err2 && parentData) {
          parents = parentData;
        }
      }

      const grandParentDiaries = Array.from(
        new Set(parents.map((p: any) => p.parent_diary_number).filter(Boolean))
      ) as string[];
      let grandParents: any[] = [];
      if (grandParentDiaries.length > 0) {
        const { data: gpData } = await (supabase
          .from('file_tracking_records' as any)
          .select('*')
          .in('cfo_diary_number', grandParentDiaries) as any);
        if (gpData) grandParents = gpData;
      }

      const allRecords = [...grandParents, ...parents, ...children];
      const groups = buildLinkedGroups(allRecords);
      setLinkedGroups(groups);

      // Auto-expand all groups by default
      const defaultExpanded = new Set<string>();
      groups.forEach(g => defaultExpanded.add(g.parentDiary));
      setExpandedGroupDiaries(defaultExpanded);
    } catch (e: any) {
      console.error('Failed to load linked records:', e);
      toast.error('Failed to load linked records from database');
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  };

  const buildLinkedGroups = (records: any[]): LinkedGroup[] => {
    const uniqueMap = new Map<string, any>();
    records.forEach(r => uniqueMap.set(r.id, r));
    const unique = Array.from(uniqueMap.values());

    const diarySet = new Set(unique.map(r => r.cfo_diary_number));
    const roots: any[] = [];
    const childMap = new Map<string, any[]>();

    unique.forEach(r => {
      if (!r.parent_diary_number || !diarySet.has(r.parent_diary_number)) {
        roots.push(r);
      }
      if (r.parent_diary_number) {
        const existing = childMap.get(r.parent_diary_number) || [];
        existing.push(r);
        childMap.set(r.parent_diary_number, existing);
      }
    });

    const groups: LinkedGroup[] = [];
    const visited = new Set<string>();

    const collectChain = (record: any, chain: any[]) => {
      if (visited.has(record.id)) return;
      visited.add(record.id);
      chain.push(record);
      const kids = childMap.get(record.cfo_diary_number) || [];
      kids.sort((a, b) => (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()));
      kids.forEach(kid => collectChain(kid, chain));
    };

    roots.forEach(root => {
      const chain: any[] = [];
      collectChain(root, chain);
      if (chain.length > 0) {
        const totalAmount = chain.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const childrenOnly = chain.filter(r => r.id !== root.id);
        groups.push({
          parentDiary: root.cfo_diary_number,
          parentRecord: root,
          childRecords: childrenOnly,
          allRecords: chain,
          totalAmount
        });
      }
    });

    unique.forEach(r => {
      if (!visited.has(r.id)) {
        groups.push({
          parentDiary: r.parent_diary_number || r.cfo_diary_number,
          parentRecord: r,
          childRecords: [],
          allRecords: [r],
          totalAmount: Number(r.amount) || 0
        });
        visited.add(r.id);
      }
    });

    return groups;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadAllLinkedRecords();
      return;
    }

    setLoading(true);
    try {
      const q = searchQuery.trim();
      const { data, error } = await (supabase
        .from('file_tracking_records' as any)
        .select('*')
        .or(`cfo_diary_number.ilike.%${q}%,parent_diary_number.ilike.%${q}%,receiving_number.ilike.%${q}%,subject.ilike.%${q}%,received_from.ilike.%${q}%`) as any);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No records matched your search query');
        setLinkedGroups([]);
        setLoading(false);
        return;
      }

      const relatedDiariesSet = new Set<string>();
      data.forEach((r: any) => {
        if (r.parent_diary_number) relatedDiariesSet.add(r.parent_diary_number);
        if (r.cfo_diary_number) relatedDiariesSet.add(r.cfo_diary_number);
      });

      const relatedDiaries = Array.from(relatedDiariesSet);
      let allRecords = [...data];

      if (relatedDiaries.length > 0) {
        const { data: parents } = await (supabase
          .from('file_tracking_records' as any)
          .select('*')
          .in('cfo_diary_number', relatedDiaries) as any);

        const { data: children } = await (supabase
          .from('file_tracking_records' as any)
          .select('*')
          .in('parent_diary_number', relatedDiaries) as any);

        allRecords = [...allRecords, ...(parents || []), ...(children || [])];
      }

      const groups = buildLinkedGroups(allRecords);
      setLinkedGroups(groups);

      const searchExpanded = new Set<string>();
      groups.forEach(g => searchExpanded.add(g.parentDiary));
      setExpandedGroupDiaries(searchExpanded);

      toast.success(`Found ${groups.length} linked chain(s)`);
    } catch (e: any) {
      console.error('Search failed:', e);
      toast.error(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpand = (diaryNumber: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroupDiaries(prev => {
      const next = new Set(prev);
      if (next.has(diaryNumber)) next.delete(diaryNumber);
      else next.add(diaryNumber);
      return next;
    });
  };

  const openFileDetailsModal = (record: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedRecordForModal(record);
    setActiveImageIndex(0);
    setImageZoom(1);
    setImageRotation(0);
    setIsFullScreenPhoto(false);
  };

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    safeCopyToClipboard(text);
    setCopiedId(id);
    toast.success(`Copied: ${text}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) return '—';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(Number(amount));
  };

  const filteredGroups = useMemo(() => {
    if (selectedCategory === 'all') return linkedGroups;
    return linkedGroups.filter(group =>
      group.allRecords.some(r =>
        (r.main_category || '').toLowerCase() === selectedCategory.toLowerCase()
      )
    );
  }, [linkedGroups, selectedCategory]);

  const stats = useMemo(() => {
    const totalGroups = linkedGroups.length;
    let totalFiles = 0;
    let parentCount = 0;
    let childCount = 0;
    let totalFinancialVolume = 0;

    linkedGroups.forEach(g => {
      totalFiles += g.allRecords.length;
      totalFinancialVolume += g.totalAmount;
      g.allRecords.forEach(r => {
        if (!r.parent_diary_number) parentCount++;
        else childCount++;
      });
    });

    return {
      totalGroups,
      totalFiles,
      parentCount,
      childCount,
      totalFinancialVolume
    };
  }, [linkedGroups]);

  const modalImages = useMemo(() => {
    return extractRecordImages(selectedRecordForModal);
  }, [selectedRecordForModal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 p-4 md:p-8 space-y-7 pb-20"
    >
      {/* ── Top Header Section with Staggered Motion ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <motion.span
                whileHover={{ rotate: 15, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="p-3 bg-blue-700 text-white rounded-2xl shadow-sm flex items-center justify-center"
              >
                <FolderTree className="w-6 h-6" />
              </motion.span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Linked Files & Multi-Part Tracking
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    KW&SC Finance
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Click on any parent card to view connected child files, or click any file to view its full picture and complete record.
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAllLinkedRecords}
                disabled={loading}
                className="h-10 px-4 gap-2 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
                Refresh
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-10 px-4 gap-2 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                Print
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="sm"
                onClick={() => navigate('/book-section/file-tracking')}
                className="h-10 px-4 gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-medium shadow-xs transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Open File Tracking
              </Button>
            </motion.div>
          </div>
        </div>

        {/* ── Metric Summary Bar with Micro Hover Animations ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
          {[
            {
              label: 'Parent File Cards',
              value: stats.totalGroups,
              sub: 'Main Origin Files',
              icon: <Layers className="w-4 h-4 text-blue-700" />,
              color: 'text-slate-900 dark:text-white'
            },
            {
              label: 'Connected Parts',
              value: stats.childCount,
              sub: 'Child Note Sheets Linked',
              icon: <Link2 className="w-4 h-4 text-emerald-600" />,
              color: 'text-emerald-600 dark:text-emerald-400'
            },
            {
              label: 'Total Documents',
              value: stats.totalFiles,
              sub: 'Parent + Child Files',
              icon: <FileCheck2 className="w-4 h-4 text-blue-600" />,
              color: 'text-blue-700 dark:text-blue-400'
            },
            {
              label: 'Network State',
              value: 'Synchronized',
              sub: 'Live Supabase Database',
              icon: <Network className="w-4 h-4 text-purple-600" />,
              color: 'text-purple-700 dark:text-purple-400 text-sm font-bold mt-2',
              pulse: true
            },
            {
              label: 'Total Financial Value',
              value: formatAmount(stats.totalFinancialVolume),
              sub: 'Cumulative PKR',
              icon: <Coins className="w-4 h-4 text-amber-600" />,
              color: 'text-slate-900 dark:text-white text-lg font-black',
              colSpan: true
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              className={`bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700/60 transition-shadow hover:shadow-xs ${
                item.colSpan ? 'col-span-2 sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <span>{item.label}</span>
                {item.icon}
              </div>
              <div className={item.color || 'text-2xl font-black text-slate-900 dark:text-white mt-1'}>
                {item.pulse ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    {item.value}
                  </span>
                ) : (
                  item.value
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.sub}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Search & Filter Controls ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by CFO Diary Number (e.g. 10024, 10025), Receiving #, or Subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-11 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-all focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); loadAllLinkedRecords(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="h-11 px-5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Search className="w-4 h-4 mr-1.5" />
                Search
              </Button>
            </motion.div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { id: 'all', label: 'All' },
                { id: 'employee', label: 'Employee' },
                { id: 'contractor', label: 'Contractor' },
                { id: 'pol', label: 'POL' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Quick Toggle All Expand / Collapse */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (expandedGroupDiaries.size > 0) {
                  setExpandedGroupDiaries(new Set());
                } else {
                  const allSet = new Set<string>();
                  filteredGroups.forEach(g => allSet.add(g.parentDiary));
                  setExpandedGroupDiaries(allSet);
                }
              }}
              className="h-11 px-4 text-xs font-medium rounded-xl border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              {expandedGroupDiaries.size > 0 ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1.5 text-slate-500" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1.5 text-slate-500" />
                  Expand All
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Loading State ── */}
      {(initialLoading || loading) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-3"
        >
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Loading Linked File Records...
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Retrieving documents and resolving parent-child linkages from KW&SC database.
          </p>
        </motion.div>
      )}

      {/* ── Empty State ── */}
      {!initialLoading && !loading && filteredGroups.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-16 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Link2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No Linked File Records Found
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No records found matching "${searchQuery}". Please check the diary number or clear filters.`
                : 'No connected files currently exist. When creating a file in File Tracking, choose "Link to Note Sheet" to connect them together.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Main Cards Grid with Smooth Staggered Animation ── */}
      {!initialLoading && !loading && filteredGroups.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {filteredGroups.map((group, groupIndex) => {
            const parent = group.parentRecord;
            const isExpanded = expandedGroupDiaries.has(group.parentDiary);
            const childCount = group.childRecords.length;
            const parentImages = extractRecordImages(parent);

            return (
              <motion.div
                key={group.parentDiary}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: groupIndex * 0.08 }}
                whileHover={{ y: -2 }}
                className="transition-all duration-200"
              >
                <Card className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-shadow">
                  {/* ── Parent File Header Card ── */}
                  <div
                    onClick={() => openFileDetailsModal(parent)}
                    className="p-6 cursor-pointer bg-gradient-to-r from-blue-50/50 via-white to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 hover:bg-blue-50/70 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                      {/* Left: Thumbnail Preview + Identifiers + Title */}
                      <div className="flex items-start gap-4">
                        {/* Document Scan Thumbnail or Icon */}
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          onClick={(e) => openFileDetailsModal(parent, e)}
                          className="relative w-16 h-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 group/thumb shadow-xs"
                          title="Click to view full picture"
                        >
                          {parentImages.length > 0 ? (
                            <>
                              <img
                                src={parentImages[0]}
                                alt="Scan"
                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="w-5 h-5" />
                              </div>
                              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                                {parentImages.length}P
                              </span>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                              <FileText className="w-7 h-7 text-blue-600 mb-0.5" />
                              <span className="text-[9px] font-bold text-slate-500">Note Sheet</span>
                            </div>
                          )}
                        </motion.div>

                        {/* File Info */}
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-blue-700 text-white shadow-xs">
                              <FileCheck2 className="w-3.5 h-3.5" />
                              Part 1 (Root File)
                            </span>

                            {/* CFO Diary Number Pill with Copy */}
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                                {parent.cfo_diary_number}
                              </span>
                              <button
                                onClick={(e) => copyToClipboard(parent.cfo_diary_number, parent.id, e)}
                                className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                                title="Copy CFO Diary Number"
                              >
                                {copiedId === parent.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            <Badge variant="outline" className="text-xs font-mono font-medium">
                              Rec: {parent.receiving_number || '—'}
                            </Badge>

                            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize text-xs">
                              {parent.main_category || 'General'}
                            </Badge>
                          </div>

                          {/* Subject */}
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white hover:text-blue-700 transition-colors">
                            {parent.subject || 'No Subject'}
                          </h3>

                          {/* Subtitle / Details */}
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              Mark To: <strong className="text-slate-700 dark:text-slate-300 uppercase">{parent.mark_to || '—'}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              From: <strong className="text-slate-700 dark:text-slate-300">{parent.received_from || '—'}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Inward: {formatDate(parent.inward_date || parent.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Financial Amount + Expand Children Button + View Full Detail Button */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="text-left lg:text-right">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Total Chain Amount
                          </span>
                          <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                            {formatAmount(group.totalAmount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Expand Child Files Button */}
                          {childCount > 0 ? (
                            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                              <Button
                                variant={isExpanded ? 'secondary' : 'default'}
                                size="sm"
                                onClick={(e) => toggleGroupExpand(group.parentDiary, e)}
                                className={`h-9 px-3.5 gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isExpanded
                                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                }`}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>
                                  {childCount} Connected {childCount === 1 ? 'Part' : 'Parts'}
                                </span>
                                <motion.span
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </motion.span>
                              </Button>
                            </motion.div>
                          ) : (
                            <span className="text-xs text-slate-400 italic px-2">No child parts yet</span>
                          )}

                          {/* View Full Dossier / Picture Button */}
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => openFileDetailsModal(parent, e)}
                              className="h-9 px-3.5 gap-1.5 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              View Picture & Details
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Framer Motion AnimatePresence Collapsible Child Section ── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && childCount > 0 && (
                      <motion.div
                        key="child-drawer"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60"
                      >
                        <div className="p-5 space-y-3.5">
                          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 pb-1">
                            <span className="flex items-center gap-1.5">
                              <FolderTree className="w-4 h-4 text-emerald-600" />
                              Connected Continuation Sheets ({childCount} Sub-Files Linked to {parent.cfo_diary_number})
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                              Click on any child file card below to open its picture & details
                            </span>
                          </div>

                          <div className="space-y-3 pl-2 sm:pl-6 border-l-2 border-emerald-400 dark:border-emerald-600 ml-3">
                            {group.childRecords.map((child, cIndex) => {
                              const childImages = extractRecordImages(child);
                              const partNumber = cIndex + 2;

                              return (
                                <motion.div
                                  key={child.id}
                                  initial={{ opacity: 0, x: -15 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.25, delay: cIndex * 0.05 }}
                                  whileHover={{ x: 4, transition: { duration: 0.15 } }}
                                  onClick={() => openFileDetailsModal(child)}
                                  className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-xs transition-all duration-150 relative group"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    {/* Left: Thumbnail & Identifiers */}
                                    <div className="flex items-start gap-3.5">
                                      <motion.div
                                        whileHover={{ scale: 1.08 }}
                                        className="w-14 h-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs"
                                      >
                                        {childImages.length > 0 ? (
                                          <img
                                            src={childImages[0]}
                                            alt="Scan"
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <FileText className="w-6 h-6 text-emerald-600" />
                                        )}
                                      </motion.div>

                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-2xs">
                                            Part {partNumber}
                                          </span>

                                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                              {child.cfo_diary_number}
                                            </span>
                                            <button
                                              onClick={(e) => copyToClipboard(child.cfo_diary_number, child.id, e)}
                                              className="text-slate-400 hover:text-emerald-600 p-0.5 cursor-pointer"
                                              title="Copy Diary #"
                                            >
                                              {copiedId === child.id ? (
                                                <Check className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                            </button>
                                          </div>

                                          <Badge variant="outline" className="text-[11px] font-mono border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300">
                                            Linked to Parent: {child.parent_diary_number}
                                          </Badge>

                                          {childImages.length > 0 && (
                                            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                                              <ImageIcon className="w-3 h-3" />
                                              {childImages.length} Image{childImages.length > 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>

                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 transition-colors">
                                          {child.subject || 'Continuation Part'}
                                        </h4>

                                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                          <span>Rec: <strong className="font-mono text-slate-700 dark:text-slate-300">{child.receiving_number || '—'}</strong></span>
                                          <span>•</span>
                                          <span>Marked: <strong className="uppercase text-slate-700 dark:text-slate-300">{child.mark_to || '—'}</strong></span>
                                          <span>•</span>
                                          <span>Date: {formatDate(child.inward_date || child.created_at)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: Amount & Quick View Action */}
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                        {formatAmount(child.amount)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => openFileDetailsModal(child, e)}
                                        className="h-7 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-semibold gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        View Picture & Details
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Comprehensive Full Picture & Details Modal ── */}
      <Dialog
        open={Boolean(selectedRecordForModal)}
        onOpenChange={(open) => !open && setSelectedRecordForModal(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
          {selectedRecordForModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Modal Top Header */}
              <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        !selectedRecordForModal.parent_diary_number
                          ? 'bg-blue-700 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {!selectedRecordForModal.parent_diary_number
                        ? 'Part 1 - Root Parent Record'
                        : 'Child Continuation Note Sheet'}
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      ID: {selectedRecordForModal.tracking_id || selectedRecordForModal.id?.slice(0, 8)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedRecordForModal.cfo_diary_number, 'modal-copy')}
                      className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Diary #
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      className="h-8 px-3 text-xs gap-1.5 rounded-lg cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Record
                    </Button>
                  </div>
                </div>

                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white mt-3 font-mono">
                  {selectedRecordForModal.cfo_diary_number}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                  Subject: {selectedRecordForModal.subject || 'Official KW&SC Document Record'}
                </DialogDescription>
              </DialogHeader>

              {/* Linked Relationship Alert Banner */}
              {selectedRecordForModal.parent_diary_number ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 bg-emerald-600 text-white rounded-lg">
                      <Link2 className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                        Linked Child File (Continuation Part)
                      </div>
                      <div className="text-sm text-emerald-800 dark:text-emerald-400">
                        This file is connected to Parent Note Sheet: <strong className="font-mono font-bold">{selectedRecordForModal.parent_diary_number}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                    This is the Root / Origin File (Part 1). Any continuation note sheets reference this diary number.
                  </span>
                </div>
              )}

              {/* ── Document Pictures / Scans Section with Framer Zoom & Preview ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Attached Document Photos / Scans ({modalImages.length})
                  </h4>

                  {modalImages.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))}
                        className="h-7 w-7 p-0 cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setImageZoom(z => Math.min(3, z + 0.25))}
                        className="h-7 w-7 p-0 cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setImageRotation(r => (r + 90) % 360)}
                        className="h-7 w-7 p-0 cursor-pointer"
                        title="Rotate Image"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsFullScreenPhoto(!isFullScreenPhoto)}
                        className="h-7 w-7 p-0 cursor-pointer"
                        title="Toggle Big View"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {modalImages.length > 0 ? (
                  <div className="space-y-3">
                    {/* Main Image Viewer */}
                    <div className={`relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800 transition-all ${
                      isFullScreenPhoto ? 'min-h-[500px]' : 'min-h-[300px] max-h-[420px]'
                    }`}>
                      <motion.img
                        key={`${activeImageIndex}-${imageRotation}-${imageZoom}`}
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        src={modalImages[activeImageIndex]}
                        alt={`Scan Page ${activeImageIndex + 1}`}
                        style={{
                          transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                          transition: 'transform 0.2s ease-in-out'
                        }}
                        className="max-h-[400px] max-w-full object-contain rounded-md"
                      />

                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-2">
                        <span>Page {activeImageIndex + 1} of {modalImages.length}</span>
                        <span>•</span>
                        <span>{Math.round(imageZoom * 100)}%</span>
                      </div>

                      <a
                        href={modalImages[activeImageIndex]}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 bg-black/70 text-white hover:bg-black text-xs px-2.5 py-1 rounded-md backdrop-blur-xs flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Full Image
                      </a>
                    </div>

                    {/* Image Thumbnails Strip if multiple pages */}
                    {modalImages.length > 1 && (
                      <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        {modalImages.map((img, idx) => (
                          <motion.button
                            key={idx}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setActiveImageIndex(idx);
                              setImageZoom(1);
                              setImageRotation(0);
                            }}
                            className={`w-14 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                              activeImageIndex === idx
                                ? 'border-blue-600 scale-105 shadow-sm'
                                : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center space-y-2">
                    <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No Scanned Pictures Attached
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      This file was registered without scanned note sheet images. You can upload images anytime by editing this file in File Tracking.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Complete Entered Details Grid ── */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  All Entered File Information
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Tracking Code</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {selectedRecordForModal.tracking_id || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">CFO Diary Number</span>
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400 text-sm">
                      {selectedRecordForModal.cfo_diary_number}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Receiving Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {selectedRecordForModal.receiving_number || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Financial Amount (Net)</span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                      {formatAmount(selectedRecordForModal.amount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Gross Amount</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatAmount(selectedRecordForModal.gross_amount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Deductions</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatAmount(selectedRecordForModal.deduction)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Category</span>
                    <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.main_category || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Sub Category</span>
                    <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.sub_category || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Marked To</span>
                    <span className="uppercase font-bold text-slate-900 dark:text-white">
                      {selectedRecordForModal.mark_to || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Received From</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.received_from || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Handover Person</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.handover_person_name || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Date of Sign</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedRecordForModal.date_of_sign)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Inward Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedRecordForModal.inward_date)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Outward Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(selectedRecordForModal.outward_date)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Budget Code</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.budget_code || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">DDO Code</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.ddo_code || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Sub Budget Head</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.sub_budget_head || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Vendor / Employee #</span>
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedRecordForModal.vendor_number || selectedRecordForModal.employee_number || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Registration Timestamp</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(selectedRecordForModal.created_at)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-medium">Parent Diary Ref</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {selectedRecordForModal.parent_diary_number || 'None (Root Parent)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedRecordForModal.remarks && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Official Remarks / Comments</span>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                    {selectedRecordForModal.remarks}
                  </div>
                </div>
              )}

              {/* History Timeline if present */}
              {Array.isArray(selectedRecordForModal.history) && selectedRecordForModal.history.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Activity & Audit Trail ({selectedRecordForModal.history.length} Events)
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedRecordForModal.history.map((hist: any, hIdx: number) => (
                      <div
                        key={hIdx}
                        className="text-xs p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-blue-700 dark:text-blue-400 uppercase">{hist.action || 'ENTRY'}</strong>
                          <span className="text-slate-500 ml-2">by {hist.user || hist.userName || 'System'}</span>
                          {hist.remarks && <p className="text-slate-400 mt-0.5">{hist.remarks}</p>}
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatDate(hist.date || hist.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigate('/book-section/file-tracking');
                    setSelectedRecordForModal(null);
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Main File Tracking
                </Button>

                <Button
                  onClick={() => setSelectedRecordForModal(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-semibold px-6 cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
