import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, Save, RotateCcw, Loader2, Search, Plus, Trash2, Building2, UserCheck, RefreshCw, Eye, IdCard, HardHat, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomField {
  id: string;
  name: string;
  value: string;
}

interface CompanyField {
  id: string;
  name: string;
}

export type VendorRole = "contractor" | "employee";

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_role?: VendorRole | string;
  employee_no?: string | null;
  vendor_number?: string | null;
  email: string | null;
  phone_no: string;
  cnic_no: string;
  ntn_no: string | null;
  companies: CompanyField[];
  custom_fields: CustomField[];
  created_at?: string;
}

const LOCAL_VENDORS_KEY = 'kwsc_local_vendors_directory';

function getStoredLocalVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(LOCAL_VENDORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredLocalVendors(vendors: Vendor[]) {
  try {
    localStorage.setItem(LOCAL_VENDORS_KEY, JSON.stringify(vendors));
  } catch (e) {
    console.error("Failed to save local vendors:", e);
  }
}

export default function VendorCreation() {
  // Role Selection State
  const [vendorRole, setVendorRole] = useState<VendorRole>("contractor");

  // Form States
  const [vendorName, setVendorName] = useState("");
  const [vendorNumber, setVendorNumber] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [cnicNo, setCnicNo] = useState("");
  const [ntnNo, setNtnNo] = useState("");
  
  const [companies, setCompanies] = useState<CompanyField[]>([{ id: Date.now().toString(), name: "" }]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Vendor Table List State
  const [vendorsList, setVendorsList] = useState<Vendor[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [tableFilter, setTableFilter] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper to extract role from record (either column or custom_fields)
  const getVendorRole = (v: any): VendorRole => {
    if (v.vendor_role === "employee" || v.vendor_role === "contractor") return v.vendor_role;
    if (Array.isArray(v.custom_fields)) {
      const match = v.custom_fields.find((f: any) => 
        (f.name || "").toLowerCase().replace(/[\s_-]/g, "") === "vendorrole" ||
        (f.name || "").toLowerCase() === "role"
      );
      if (match?.value === "employee" || match?.value === "contractor") return match.value;
    }
    // If employee_no is present and no cnic, assume employee
    if (v.employee_no && (!v.cnic_no || v.cnic_no.trim() === "")) return "employee";
    return "contractor";
  };

  // Helper to extract employee number from record (either column or custom_fields)
  const getEmployeeNo = (v: any): string => {
    if (v.employee_no) return String(v.employee_no);
    if (Array.isArray(v.custom_fields)) {
      const match = v.custom_fields.find((f: any) => 
        (f.name || "").toLowerCase().replace(/[\s_-]/g, "") === "employeeno" ||
        (f.name || "").toLowerCase().includes("employee")
      );
      if (match?.value) return match.value;
    }
    return "";
  };

  // Helper to extract vendor number from record (either column or custom_fields)
  const getVendorNumber = (v: any): string => {
    if (v.vendor_number) return String(v.vendor_number);
    if (Array.isArray(v.custom_fields)) {
      const match = v.custom_fields.find((f: any) => {
        const n = (f.name || "").toLowerCase().replace(/[\s_-]/g, "");
        return n === "vendornumber" || n === "vendorno" || n === "vendorid";
      });
      if (match?.value) return match.value;
    }
    return "";
  };

  // Fetch vendors from database (with offline cache fallback & merge)
  const fetchVendors = async () => {
    setIsLoadingList(true);
    const localVendors = getStoredLocalVendors();
    if (localVendors.length > 0) {
      setVendorsList(localVendors);
    }

    try {
      const { data, error } = await supabase
        .from('vendors' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const remoteList = (data as Vendor[]) || [];
      
      // Merge remote and any locally created ones that haven't synced
      const mergedMap = new Map<string, Vendor>();
      remoteList.forEach(v => mergedMap.set(v.id || v.cnic_no || v.phone_no, v));
      localVendors.forEach(v => {
        const key = v.id || v.cnic_no || v.phone_no;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, v);
        }
      });
      const finalMerged = Array.from(mergedMap.values());
      setVendorsList(finalMerged);
      saveStoredLocalVendors(finalMerged);
    } catch (err: any) {
      console.warn("Supabase load vendors failed, using local offline directory:", err);
      if (localVendors.length > 0) {
        setVendorsList(localVendors);
      }
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleReset = (silent = false) => {
    setVendorRole("contractor");
    setVendorName("");
    setVendorNumber("");
    setEmployeeNo("");
    setEmail("");
    setPhoneNo("");
    setCnicNo("");
    setNtnNo("");
    setCompanies([{ id: Date.now().toString(), name: "" }]);
    setCustomFields([]);
    setSearchQuery("");
    setErrors({});
    if (!silent) toast.info("Form reset successfully.");
  };

  const addCompanyField = () => {
    setCompanies([...companies, { id: Date.now().toString(), name: "" }]);
  };

  const removeCompanyField = (id: string) => {
    if (companies.length === 1) {
      setCompanies([{ id: Date.now().toString(), name: "" }]);
      return;
    }
    setCompanies(companies.filter(c => c.id !== id));
  };

  const updateCompanyField = (id: string, newName: string) => {
    setCompanies(companies.map(c => 
      c.id === id ? { ...c, name: newName } : c
    ));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: Date.now().toString(), name: "", value: "" }]);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(field => field.id !== id));
  };

  const updateCustomField = (id: string, key: "name" | "value", newValue: string) => {
    setCustomFields(customFields.map(field => 
      field.id === id ? { ...field, [key]: newValue } : field
    ));
  };

  const handleSelectVendorForEdit = (v: any) => {
    const role = getVendorRole(v);
    setVendorRole(role);
    setVendorName(v.vendor_name || "");
    setVendorNumber(getVendorNumber(v));
    setEmployeeNo(getEmployeeNo(v));
    setEmail(v.email || "");
    setPhoneNo(v.phone_no || "");
    setCnicNo(v.cnic_no || "");
    setNtnNo(v.ntn_no || "");

    const parsedCompanies = Array.isArray(v.companies) && v.companies.length > 0
      ? v.companies
      : [{ id: Date.now().toString(), name: "" }];
    
    // Filter out internal fields from custom_fields so user sees them in dedicated inputs
    const parsedCustom = (Array.isArray(v.custom_fields) ? v.custom_fields : []).filter((f: any) => {
      const normalized = (f.name || "").toLowerCase().replace(/[\s_-]/g, "");
      return normalized !== "employeeno" && normalized !== "vendorrole" && normalized !== "vendornumber" && normalized !== "vendorno" && normalized !== "vendorid";
    });

    setCompanies(parsedCompanies);
    setCustomFields(parsedCustom);
    setErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Loaded ${role}: ${v.vendor_name}`);
  };

  const handleSave = async () => {
    // Validation based on role
    const newErrors: Record<string, string> = {};
    if (!vendorName.trim()) newErrors.vendorName = "Name is required";
    if (!phoneNo.trim()) newErrors.phoneNo = "Phone No is required";

    if (vendorRole === "contractor") {
      if (!cnicNo.trim()) newErrors.cnicNo = "CNIC No is required for Contractor";
    } else {
      // Employee role: employee number is required, CNIC is optional
      if (!employeeNo.trim()) newErrors.employeeNo = "Employee No is required for Employee";
    }
    
    // Validate custom fields
    let hasCustomFieldErrors = false;
    customFields.forEach(field => {
      if (!field.name.trim()) hasCustomFieldErrors = true;
    });

    if (hasCustomFieldErrors) {
      toast.error("Please provide names for all custom extra fields.");
      return;
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(`${Object.keys(newErrors).length} required field(s) incomplete!`);
      return;
    }
    setErrors({});

    setIsSaving(true);
    try {
      // Find existing vendor:
      // If contractor -> match by CNIC or Phone No
      // If employee -> match by employee_no (via custom_fields/column) or Phone No
      let existingVendor: any = null;

      try {
        if (vendorRole === "contractor" && cnicNo.trim()) {
          const { data } = await supabase
            .from('vendors' as any)
            .select('id')
            .or(`cnic_no.eq.${cnicNo.trim()},phone_no.eq.${phoneNo.trim()}`)
            .maybeSingle();
          existingVendor = data;
        } else {
          // Employee search by phone first
          const { data } = await supabase
            .from('vendors' as any)
            .select('id, custom_fields')
            .eq('phone_no', phoneNo.trim())
            .maybeSingle();
          existingVendor = data;

          // If not found by phone, check loaded vendors list for matching employee_no
          if (!existingVendor && employeeNo.trim()) {
            const matched = vendorsList.find(v => getEmployeeNo(v).toLowerCase() === employeeNo.trim().toLowerCase());
            if (matched) existingVendor = { id: matched.id };
          }
        }
      } catch (checkErr) {
        console.warn("Supabase check existing vendor failed, checking local list:", checkErr);
        const matched = vendorsList.find(v => 
          (cnicNo.trim() && v.cnic_no === cnicNo.trim()) ||
          (phoneNo.trim() && v.phone_no === phoneNo.trim()) ||
          (employeeNo.trim() && getEmployeeNo(v).toLowerCase() === employeeNo.trim().toLowerCase())
        );
        if (matched) existingVendor = { id: matched.id };
      }

      const cleanedCompanies = companies.filter(c => c.name.trim() !== "");
      let cleanedCustom = customFields.filter(f => f.name.trim() !== "");

      // Embed vendor_role, employee_no and vendor_number into custom_fields for robust fallback
      cleanedCustom = [
        ...cleanedCustom.filter(f => {
          const n = (f.name || "").toLowerCase().replace(/[\s_-]/g, "");
          return n !== "employeeno" && n !== "vendorrole" && n !== "vendornumber" && n !== "vendorno" && n !== "vendorid";
        }),
        { id: 'role_field', name: 'Vendor Role', value: vendorRole }
      ];

      if (employeeNo.trim()) {
        cleanedCustom.push({ id: 'emp_field', name: 'Employee No', value: employeeNo.trim() });
      }

      if (vendorNumber.trim()) {
        cleanedCustom.push({ id: 'vendor_no_field', name: 'Vendor Number', value: vendorNumber.trim() });
      }

      const basePayload: any = {
        vendor_name: vendorName.trim(),
        email: email.trim() || null,
        phone_no: phoneNo.trim(),
        cnic_no: cnicNo.trim() || (vendorRole === "employee" ? `EMP-${employeeNo.trim()}` : ""),
        ntn_no: ntnNo.trim() || null,
        companies: cleanedCompanies.length > 0 ? cleanedCompanies : companies,
        custom_fields: cleanedCustom
      };

      const payloadWithCols: any = {
        ...basePayload,
        employee_no: employeeNo.trim() || null,
        vendor_number: vendorNumber.trim() || null
      };

      // Save locally to offline cache immediately
      const savedVendorObject: Vendor = {
        id: existingVendor?.id || ('local_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
        ...payloadWithCols,
        vendor_role: vendorRole,
        created_at: new Date().toISOString()
      };

      const currentLocal = getStoredLocalVendors();
      const updatedLocal = [
        savedVendorObject,
        ...currentLocal.filter(v => v.id !== savedVendorObject.id && v.cnic_no !== savedVendorObject.cnic_no && v.phone_no !== savedVendorObject.phone_no)
      ];
      saveStoredLocalVendors(updatedLocal);
      setVendorsList(updatedLocal);

      // Attempt Supabase cloud sync
      let cloudSynced = false;
      try {
        let error: any = null;

        if (existingVendor && !existingVendor.id?.startsWith('local_')) {
          // Try update with all columns
          let res = await supabase
            .from('vendors' as any)
            .update(payloadWithCols)
            .eq('id', existingVendor.id);

          if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('vendor_number') || res.error.message?.includes('employee_no'))) {
            // Column(s) may not exist, fallback to basePayload (persisted in custom_fields JSON)
            res = await supabase
              .from('vendors' as any)
              .update(basePayload)
              .eq('id', existingVendor.id);
          }
          error = res.error;
        } else {
          // Try insert with all columns
          let res = await supabase
            .from('vendors' as any)
            .insert([payloadWithCols]);

          if (res.error && (res.error.code === 'PGRST204' || res.error.message?.includes('vendor_number') || res.error.message?.includes('employee_no'))) {
            // Column(s) may not exist, fallback to basePayload (persisted in custom_fields JSON)
            res = await supabase
              .from('vendors' as any)
              .insert([basePayload]);
          }
          error = res.error;
        }

        if (!error) {
          cloudSynced = true;
        }
      } catch (cloudErr) {
        console.warn("Cloud save failed (network/Supabase offline), saved locally:", cloudErr);
      }

      toast.success(
        cloudSynced
          ? `${vendorRole === "employee" ? "Employee" : "Contractor"} saved successfully to database!`
          : `${vendorRole === "employee" ? "Employee" : "Contractor"} saved locally (offline mode)!`
      );
      handleReset(true);
      fetchVendors();
    } catch (err: any) {
      toast.error("Error saving vendor: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) {
      toast.warning("Please enter Name, CNIC, Employee No, Vendor No, NTN or Phone to search!");
      return;
    }

    setIsSearching(true);
    
    try {
      const query = searchQuery.trim();
      
      // First check local list for matching employee_no, vendor_number or name
      const localMatch = vendorsList.find(v => 
        (v.vendor_name || "").toLowerCase().includes(query.toLowerCase()) ||
        getEmployeeNo(v).toLowerCase().includes(query.toLowerCase()) ||
        getVendorNumber(v).toLowerCase().includes(query.toLowerCase()) ||
        (v.cnic_no || "").includes(query) ||
        (v.phone_no || "").includes(query)
      );

      if (localMatch) {
        handleSelectVendorForEdit(localMatch);
        toast.success("Record found in database!");
        return;
      }

      const { data, error } = await supabase
        .from('vendors' as any)
        .select('*')
        .or(`cnic_no.like.%${query}%,phone_no.like.%${query}%,ntn_no.like.%${query}%,vendor_name.like.%${query}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        handleSelectVendorForEdit(data as Vendor);
        toast.success("Record found in database!");
      } else {
        toast.error("No record found with that information.");
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredVendors = vendorsList.filter(v => {
    if (!tableFilter.trim()) return true;
    const q = tableFilter.toLowerCase();
    const emp = getEmployeeNo(v).toLowerCase();
    const vNo = getVendorNumber(v).toLowerCase();
    const role = getVendorRole(v).toLowerCase();
    return (
      role.includes(q) ||
      (v.vendor_name || "").toLowerCase().includes(q) ||
      emp.includes(q) ||
      vNo.includes(q) ||
      (v.cnic_no || "").toLowerCase().includes(q) ||
      (v.phone_no || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q) ||
      (v.ntn_no || "").toLowerCase().includes(q) ||
      (Array.isArray(v.companies) && v.companies.some(c => (c.name || "").toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold italic tracking-tight text-white/90">Vendor Creation & Directory</h1>
          <p className="text-sm text-muted-foreground italic">Register new contractors (by CNIC) or employees (by Employee No) into the One-Window database</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleReset()} className="gap-2 border-primary/20 hover:bg-primary/5">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save {vendorRole === "employee" ? "Employee" : "Contractor"}
          </Button>
        </div>
      </div>

      {/* Main Form & Search Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="glass-card overflow-hidden border-none shadow-2xl bg-white/5 backdrop-blur-md">
            <div className="h-1 bg-gradient-to-r from-primary via-indigo-500 to-primary" />
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2 font-bold italic text-white/80">
                  <Users className="w-5 h-5 text-primary" />
                  Vendor Classification & Details
                </CardTitle>

                {/* Role Switcher: Contractor vs Employee */}
                <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/10 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVendorRole("contractor");
                      setErrors(prev => {
                        const { employeeNo, ...rest } = prev;
                        return rest;
                      });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      vendorRole === "contractor"
                        ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    <HardHat className="w-3.5 h-3.5" /> Contractor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVendorRole("employee");
                      setErrors(prev => {
                        const { cnicNo, ...rest } = prev;
                        return rest;
                      });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      vendorRole === "employee"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    <IdCard className="w-3.5 h-3.5" /> Employee
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <Label htmlFor="vendorName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                  {vendorRole === "employee" ? "Employee Name" : "Contractor / Vendor Name"} <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="vendorName"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={vendorRole === "employee" ? "Enter employee full name" : "Enter contractor name"}
                  className={`bg-white/5 border-white/10 text-white${errors.vendorName ? ' border-red-500' : ''}`}
                />
                {errors.vendorName && <p className="text-xs text-red-400 mt-1">{errors.vendorName}</p>}
              </div>

              {/* Conditional Routing: Employee No vs CNIC No */}
              {vendorRole === "employee" ? (
                <div className="space-y-2">
                  <Label htmlFor="employeeNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-blue-400" /> Employee No <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="employeeNo"
                    value={employeeNo}
                    onChange={(e) => setEmployeeNo(e.target.value)}
                    placeholder="Enter Employee No (e.g. EMP-1042)"
                    className={`bg-white/5 border-white/10 text-white font-mono${errors.employeeNo ? ' border-red-500' : ''}`}
                  />
                  {errors.employeeNo ? (
                    <p className="text-xs text-red-400 mt-1">{errors.employeeNo}</p>
                  ) : (
                    <p className="text-[11px] text-blue-400/80">Entry will be registered & routed using Employee Number</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="cnicNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5 text-teal-400" /> CNIC No <span className="text-red-400">*</span>
                  </Label>
                  <Input 
                    id="cnicNo" 
                    value={cnicNo} 
                    onChange={(e) => setCnicNo(e.target.value)} 
                    className={`bg-white/5 border-white/10 text-white font-mono${errors.cnicNo ? ' border-red-500' : ''}`} 
                    placeholder="42101-1234567-1" 
                  />
                  {errors.cnicNo ? (
                    <p className="text-xs text-red-400 mt-1">{errors.cnicNo}</p>
                  ) : (
                    <p className="text-[11px] text-teal-400/80">Contractor entry requires CNIC Number</p>
                  )}
                </div>
              )}

              {/* Secondary fields */}
              {vendorRole === "employee" ? (
                <div className="space-y-2">
                  <Label htmlFor="cnicNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                    CNIC No <span className="text-muted-foreground text-[10px] lowercase">(optional for employee)</span>
                  </Label>
                  <Input 
                    id="cnicNo" 
                    value={cnicNo} 
                    onChange={(e) => setCnicNo(e.target.value)} 
                    className="bg-white/5 border-white/10 text-white font-mono" 
                    placeholder="42101-1234567-1" 
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="employeeNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                    Employee No <span className="text-muted-foreground text-[10px] lowercase">(optional)</span>
                  </Label>
                  <Input
                    id="employeeNo"
                    value={employeeNo}
                    onChange={(e) => setEmployeeNo(e.target.value)}
                    placeholder="e.g. EMP-1042"
                    className="bg-white/5 border-white/10 text-white font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phoneNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Phone No <span className="text-red-400">*</span></Label>
                <Input 
                  id="phoneNo" 
                  value={phoneNo} 
                  onChange={(e) => setPhoneNo(e.target.value)} 
                  className={`bg-white/5 border-white/10 text-white font-mono${errors.phoneNo ? ' border-red-500' : ''}`} 
                  placeholder="0300-1234567" 
                />
                {errors.phoneNo && <p className="text-xs text-red-400 mt-1">{errors.phoneNo}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="bg-white/5 border-white/10 text-white" 
                  placeholder="vendor@example.com" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ntnNo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">NTN No</Label>
                <Input 
                  id="ntnNo" 
                  value={ntnNo} 
                  onChange={(e) => setNtnNo(e.target.value)} 
                  className="bg-white/5 border-white/10 text-white font-mono" 
                  placeholder="1234567-8" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendorNumber" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Vendor Number
                  <span className="text-muted-foreground text-[10px] lowercase">(optional / ERP vendor ID)</span>
                </Label>
                <Input 
                  id="vendorNumber" 
                  value={vendorNumber} 
                  onChange={(e) => setVendorNumber(e.target.value)} 
                  className="bg-white/5 border-white/10 text-white font-mono" 
                  placeholder="e.g. V-1048 or VN-2026" 
                />
                <p className="text-[11px] text-muted-foreground">Auto-populates into File Tracking & payments</p>
              </div>

              {/* Company / Dept Section */}
              <div className="md:col-span-2 space-y-4 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {vendorRole === "employee" ? "Department / Posting Offices" : "Company / Organization Names"}
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={addCompanyField}
                    className="h-6 text-[10px] gap-1 hover:text-primary hover:bg-primary/10 text-muted-foreground"
                  >
                    <Plus className="w-3 h-3" /> Add Another
                  </Button>
                </div>
                {companies.map((company, index) => (
                  <div key={company.id} className="flex items-center gap-2">
                    <Input
                      value={company.name}
                      onChange={(e) => updateCompanyField(company.id, e.target.value)}
                      placeholder={vendorRole === "employee" ? `Department / Section ${index + 1}` : `Company ${index + 1} (e.g. ABC Traders LLC)`}
                      className="bg-white/5 border-white/10 text-white flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompanyField(company.id)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Custom Fields Section */}
          <Card className="glass-card overflow-hidden border-none shadow-2xl bg-white/5 backdrop-blur-md">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 font-bold italic text-white/80">
                <Plus className="w-5 h-5 text-emerald-400" />
                Extra Information
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addCustomField}
                className="gap-2 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <Plus className="w-4 h-4" /> Add Field
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {customFields.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm italic border border-dashed border-white/10 rounded-xl">
                  No extra fields added. Click "Add Field" to add custom information.
                </div>
              ) : (
                <div className="space-y-4">
                  {customFields.map((field) => (
                    <div key={field.id} className="flex flex-col md:flex-row gap-4 items-start md:items-end p-4 bg-black/20 rounded-xl border border-white/5 relative group">
                      <div className="space-y-2 flex-1 w-full">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Field Name</Label>
                        <Input 
                          value={field.name}
                          onChange={(e) => updateCustomField(field.id, 'name', e.target.value)}
                          placeholder="e.g. Designation, Scale, Sales Tax No"
                          className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/30"
                        />
                      </div>
                      <div className="space-y-2 flex-1 w-full">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Value</Label>
                        <Input 
                          value={field.value}
                          onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                          placeholder="Enter value"
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomField(field.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 shrink-0 md:mb-0 mb-4 absolute right-2 top-2 md:relative md:right-0 md:top-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Search Column */}
        <div className="space-y-6">
          <Card className="glass-card overflow-hidden border-none shadow-inner bg-gradient-to-b from-primary/10 to-transparent border-t border-primary/10">
            <CardHeader>
              <CardTitle className="text-xs font-black text-primary/80 tracking-[0.2em] italic uppercase">SEARCH DIRECTORY</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                 <Input 
                   placeholder="Enter Name, Emp No, CNIC..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-black/40 border-primary/20 text-white placeholder:text-muted-foreground/40 font-mono text-xs" 
                   onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                 />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-[0.3em] h-10 shadow-lg"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Search className="w-3.5 h-3.5 mr-2" />} Execute
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card border-none bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>Total Registered</span>
              <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 font-mono">
                {vendorsList.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-center">
                <div className="font-bold text-teal-400">{vendorsList.filter(v => getVendorRole(v) === "contractor").length}</div>
                <div className="text-[10px] text-muted-foreground">Contractors</div>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <div className="font-bold text-blue-400">{vendorsList.filter(v => getVendorRole(v) === "employee").length}</div>
                <div className="text-[10px] text-muted-foreground">Employees</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-1">
              Select <strong>Contractor</strong> to validate by CNIC, or <strong>Employee</strong> to create and route entry by Employee Number.
            </p>
          </Card>
        </div>
      </div>

      {/* Vendor Records Table */}
      <Card className="glass-card overflow-hidden border-none shadow-2xl bg-white/5 backdrop-blur-md">
        <div className="h-1 bg-gradient-to-r from-teal-500 via-primary to-indigo-500" />
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 font-bold italic text-white/90">
              <UserCheck className="w-5 h-5 text-teal-400" />
              Registered Vendors & Employees Directory
            </CardTitle>
            <p className="text-xs text-muted-foreground">All contractors and employees registered in the database</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by name, Emp No, CNIC, role..."
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="bg-black/30 border-white/10 text-white placeholder:text-muted-foreground/40 text-xs w-64 h-8"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVendors}
              disabled={isLoadingList}
              className="h-8 gap-1 border-white/10 text-xs"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin text-teal-400' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/40">
                <TableRow className="border-b border-white/10 hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">#</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Role</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-amber-400">Vendor No</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Employee No</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">CNIC No</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Phone No</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Email</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">Company / Dept</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70">NTN No</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-white/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingList ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Loading directory from database...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground text-sm italic">
                      {tableFilter ? "No records match your search." : "No records registered yet. Fill the form above to add one."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((vendor, index) => {
                    const role = getVendorRole(vendor);
                    const empNo = getEmployeeNo(vendor);
                    const vNo = getVendorNumber(vendor);
                    return (
                      <TableRow key={vendor.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          {role === "employee" ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] font-bold uppercase">
                              Employee
                            </Badge>
                          ) : (
                            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 text-[10px] font-bold uppercase">
                              Contractor
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-sm text-white">
                          <div className="flex items-center gap-2">
                            {role === "employee" ? (
                              <IdCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            ) : (
                              <HardHat className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                            )}
                            <span>{vendor.vendor_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-amber-400">
                          {vNo ? (
                            <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/30">
                              {vNo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">---</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-blue-400">
                          {empNo || "---"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-teal-400">
                          {vendor.cnic_no && !vendor.cnic_no.startsWith("EMP-") ? vendor.cnic_no : "---"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {vendor.phone_no || "---"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {vendor.email || "---"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {Array.isArray(vendor.companies) && vendor.companies.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {vendor.companies.filter(c => c.name).map((c, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/80">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">---</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {vendor.ntn_no || "---"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectVendorForEdit(vendor)}
                            className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-3 h-3" /> Edit / View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
