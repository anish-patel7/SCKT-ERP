// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Copy,
  Power,
  Trash2,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Briefcase,
  X,
  CheckCircle2,
  ArrowLeft,
  Star,
  Layers,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatServiceError } from "@/lib/master-codes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

import {
  useParties,
  useCreateParty,
  useUpdateParty,
  useSetPartyStatus,
  useSubPartiesByPartyId,
  useCreateSubParty,
  useUpdateSubParty,
  useSetSubPartyStatus,
  useSetSubPartyAsDefault,
} from "@/hooks/useParties";
import {
  validateGSTIN,
  validatePAN,
  validateMobile,
  validatePIN,
  validateEmail,
  LOCATION_TYPES,
} from "@/lib/party-store";
import type { Database } from "@/integrations/supabase/types";

type Party = any; // Database["public"]["Tables"]["parties"]["Row"];
type SubParty = any; // Database["public"]["Tables"]["party_sub_parties"]["Row"];
type PartyType = "Purchase Party" | "Sell Party" | "Job Party";

const PARTY_TYPES: PartyType[] = ["Purchase Party", "Sell Party", "Job Party"];

export function PartyMasterView() {
  // State declarations first
  const [activeTab, setActiveTab] = useState<PartyType>("Purchase Party");
  const [selectedParentParty, setSelectedParentParty] = useState<Party | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState<string>("all");
  const [subLocationFilter, setSubLocationFilter] = useState<string>("all");
  const [subDefaultFilter, setSubDefaultFilter] = useState<string>("all");
  const [partyFormOpen, setPartyFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyFormData, setPartyFormData] = useState<Partial<any>>({});
  const [partyErrors, setPartyErrors] = useState<Partial<Record<string, string>>>({});
  const [partyDuplicateMatch, setPartyDuplicateMatch] = useState<any | null>(null);
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [editingSubParty, setEditingSubParty] = useState<any | null>(null);
  const [subFormData, setSubFormData] = useState<Partial<any>>({});
  const [subErrors, setSubErrors] = useState<Partial<Record<string, string>>>({});
  const [subExactCodeError, setSubExactCodeError] = useState<string | null>(null);
  const [subFuzzyMatch, setSubFuzzyMatch] = useState<SubParty | null>(null);
  const [viewingParty, setViewingParty] = useState<Party | null>(null);
  const [viewingSubParty, setViewingSubParty] = useState<SubParty | null>(null);
  const [deactivatingParty, setDeactivatingParty] = useState<Party | null>(null);
  const [deactivatingSubParty, setDeactivatingSubParty] = useState<SubParty | null>(null);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState<string | null>(null);
  const [deletingSubParty, setDeletingSubParty] = useState<SubParty | null>(null);

  // Query hooks for parties and sub-parties
  const { data: allParties = [], isLoading: partiesLoading } = useParties();
  const { data: currentPartySubParties = [] } = useSubPartiesByPartyId(
    selectedParentParty?.id || "",
  );

  // Mutation hooks - using dummy IDs for now
  const createPartyMutation = useCreateParty();
  const updatePartyMutation = useUpdateParty(editingParty?.id || "dummy");
  const setPartyStatusMutation = useSetPartyStatus(editingParty?.id || "dummy");
  const createSubPartyMutation = useCreateSubParty();
  const updateSubPartyMutation = useUpdateSubParty(editingSubParty?.id || "dummy");
  const setSubPartyStatusMutation = useSetSubPartyStatus(deactivatingSubParty?.id || "dummy");
  const setSubPartyDefaultMutation = useSetSubPartyAsDefault(selectedParentParty?.id || "dummy", "dummy");

  // Computed properties
  const subPartyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    currentPartySubParties.forEach((sp) => {
      if (sp.status === "Active") {
        counts[sp.party_id] = (counts[sp.party_id] || 0) + 1;
      }
    });
    return counts;
  }, [currentPartySubParties]);

  const uniqueStates = useMemo(
    () => Array.from(new Set(allParties.map((p) => p.state).filter(Boolean))),
    [allParties],
  );

  const uniqueCities = useMemo(
    () => Array.from(new Set(allParties.map((p) => p.city).filter(Boolean))),
    [allParties],
  );

  // Filtered Main Parties
  const filteredMainParties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allParties.filter((p) => {
      const partyType = (p.party_type as PartyType) || "Job Party";
      const matchesTab = partyType === activeTab;
      if (!matchesTab) return false;

      const matchesQuery =
        !q ||
        p.party_code.toLowerCase().includes(q) ||
        p.party_name.toLowerCase().includes(q) ||
        p.office_name.toLowerCase().includes(q) ||
        (p.contact_person && p.contact_person.toLowerCase().includes(q)) ||
        (p.mobile && p.mobile.includes(q)) ||
        p.city.toLowerCase().includes(q) ||
        (p.gstin && p.gstin.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesState = stateFilter === "all" || p.state === stateFilter;
      const matchesCity = cityFilter === "all" || p.city === cityFilter;

      return matchesQuery && matchesStatus && matchesState && matchesCity;
    });
  }, [allParties, activeTab, searchQuery, statusFilter, stateFilter, cityFilter]);

  // Filtered Sub Parties
  const filteredSubParties = useMemo(() => {
    const q = subSearchQuery.trim().toLowerCase();

    return currentPartySubParties.filter((sp) => {
      const matchesQuery =
        !q ||
        sp.sub_party_code.toLowerCase().includes(q) ||
        sp.sub_party_name.toLowerCase().includes(q) ||
        (selectedParentParty && selectedParentParty.party_name.toLowerCase().includes(q)) ||
        sp.city.toLowerCase().includes(q) ||
        sp.state.toLowerCase().includes(q) ||
        (sp.gstin && sp.gstin.toLowerCase().includes(q)) ||
        (sp.contact_person && sp.contact_person.toLowerCase().includes(q)) ||
        (sp.mobile && sp.mobile.includes(q)) ||
        sp.location_type.toLowerCase().includes(q);

      const matchesStatus = subStatusFilter === "all" || sp.status === subStatusFilter;
      const matchesLocation =
        subLocationFilter === "all" || sp.location_type === subLocationFilter;
      const matchesDefault =
        subDefaultFilter === "all"
          ? true
          : subDefaultFilter === "yes"
            ? sp.is_default
            : !sp.is_default;

      return matchesQuery && matchesStatus && matchesLocation && matchesDefault;
    });
  }, [
    currentPartySubParties,
    selectedParentParty,
    subSearchQuery,
    subStatusFilter,
    subLocationFilter,
    subDefaultFilter,
  ]);

  // Handlers for Main Party Form
  const handleNewMainParty = () => {
    setEditingParty(null);
    setPartyFormData({
      party_code: "",
      party_name: "",
      party_type: activeTab,
      office_name: "",
      address_line1: "",
      address_line2: "",
      area: "",
      city: "",
      district: "",
      state: "Gujarat",
      pin_code: "",
      country: "India",
      contact_person: "",
      designation: "",
      mobile: "",
      alternate_mobile: "",
      email: "",
      whatsapp_number: "",
      gstin: "",
      pan: "",
      job_work_applicable: activeTab === "Job Party" ? "Yes" : "No",
      job_work_remarks: "",
      remarks: "",
      status: "Active",
    });
    setPartyErrors({});
    setPartyFormOpen(true);
  };

  const handleEditMainParty = (party: Party) => {
    setEditingParty(party);
    setPartyFormData({ ...party });
    setPartyErrors({});
    setPartyFormOpen(true);
  };

  const validatePartyForm = (): boolean => {
    const errs: Partial<Record<string, string>> = {};

    if (!partyFormData.party_code?.trim()) errs.party_code = "Party Code is required";
    if (!partyFormData.party_name?.trim()) errs.party_name = "Party Name is required";
    if (!partyFormData.office_name?.trim()) errs.office_name = "Office Name is required";
    if (!partyFormData.address_line1?.trim())
      errs.address_line1 = "Address Line 1 is required";
    if (!partyFormData.city?.trim()) errs.city = "City is required";
    if (!partyFormData.state?.trim()) errs.state = "State is required";
    if (!partyFormData.pin_code?.trim()) {
      errs.pin_code = "PIN Code is required";
    } else if (!validatePIN(partyFormData.pin_code)) {
      errs.pin_code = "PIN Code must be 6 digits";
    }

    if (partyFormData.gstin && !validateGSTIN(partyFormData.gstin)) {
      errs.gstin = "Invalid GSTIN format";
    }
    if (partyFormData.pan && !validatePAN(partyFormData.pan)) {
      errs.pan = "Invalid PAN format";
    }
    if (partyFormData.mobile && !validateMobile(partyFormData.mobile)) {
      errs.mobile = "Invalid 10-digit mobile number";
    }
    if (partyFormData.email && !validateEmail(partyFormData.email)) {
      errs.email = "Invalid email format";
    }

    setPartyErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitPartyForm = (bypassDuplicateCheck = false) => {
    if (!validatePartyForm()) {
      toast.error("Please resolve validation errors before saving");
      return;
    }

    // TODO: Implement duplicate detection with service layer validation

    if (editingParty?.id) {
      updatePartyMutation.mutate(partyFormData, {
        onSuccess: () => {
          setPartyFormOpen(false);
          setPartyDuplicateMatch(null);
          toast.success(`Party ${partyFormData.party_code} saved successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to save party: ${formatServiceError(error)}`);
        },
      });
    } else {
      createPartyMutation.mutate(partyFormData, {
        onSuccess: () => {
          setPartyFormOpen(false);
          setPartyDuplicateMatch(null);
          toast.success(`Party ${partyFormData.party_code} created successfully!`);
        },
        onError: (error) => {
          toast.error(`Unable to create party: ${formatServiceError(error)}`);
        },
      });
    }
  };

  // Handlers for Sub Party Form
  const handleOpenAddSubParty = (parent: Party) => {
    setEditingSubParty(null);
    setSubExactCodeError(null);
    setSubFormData({
      party_id: parent.id,
      sub_party_code: "",
      sub_party_name: "",
      party_type: (parent.party_type as PartyType) || activeTab,
      location_type:
        parent.party_type === "Job Party" ? "Job Work Unit" : "Branch Office",
      location_type_other: "",
      address_line1: parent.address_line1 || "",
      address_line2: parent.address_line2 || "",
      area: parent.area || "",
      city: parent.city || "",
      district: parent.district || "",
      state: parent.state || "Gujarat",
      pin_code: parent.pin_code || "",
      country: parent.country || "India",
      contact_person: parent.contact_person || "",
      mobile: parent.mobile || "",
      alternate_mobile: parent.alternate_mobile || "",
      phone: "",
      email: parent.email || "",
      alternate_email: "",
      gstin: parent.gstin || "",
      pan: parent.pan || "",
      billing_address: parent.address_line1
        ? `${parent.address_line1}, ${parent.city}, ${parent.state}`
        : "",
      shipping_address: parent.address_line1
        ? `${parent.address_line1}, ${parent.city}, ${parent.state}`
        : "",
      delivery_address: parent.address_line1
        ? `${parent.address_line1}, ${parent.city}, ${parent.state}`
        : "",
      is_default: !currentPartySubParties.some((sp) => sp.status === "Active"),
      status: "Active",
      remarks: "",
      internal_notes: "",
    });
    setSubErrors({});
    setSubFormOpen(true);
  };

  const handleEditSubParty = (sub: SubParty) => {
    setEditingSubParty(sub);
    setSubExactCodeError(null);
    setSubFormData({ ...sub });
    setSubErrors({});
    setSubFormOpen(true);
  };

  const validateSubPartyForm = (): boolean => {
    const errs: Partial<Record<string, string>> = {};

    if (!subFormData.sub_party_code?.trim())
      errs.sub_party_code = "Sub Party Code is required";
    if (!subFormData.sub_party_name?.trim())
      errs.sub_party_name = "Sub Party Name is required";
    if (!subFormData.address_line1?.trim())
      errs.address_line1 = "Address Line 1 is required";
    if (!subFormData.city?.trim()) errs.city = "City is required";
    if (!subFormData.state?.trim()) errs.state = "State is required";

    if (subFormData.gstin && !validateGSTIN(subFormData.gstin)) {
      errs.gstin = "Invalid GSTIN format";
    }
    if (subFormData.pan && !validatePAN(subFormData.pan)) {
      errs.pan = "Invalid PAN format";
    }
    if (subFormData.mobile && !validateMobile(subFormData.mobile)) {
      errs.mobile = "Invalid 10-digit mobile number";
    }
    if (subFormData.email && !validateEmail(subFormData.email)) {
      errs.email = "Invalid email format";
    }

    setSubErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitSubPartyForm = () => {
    if (!validateSubPartyForm()) {
      toast.error("Please resolve validation errors before saving Sub Party");
      return;
    }

    // Check exact code uniqueness
    const codeExists = currentPartySubParties.some(
      (sp) =>
        sp.sub_party_code === subFormData.sub_party_code &&
        sp.id !== editingSubParty?.id,
    );
    if (codeExists) {
      setSubExactCodeError(
        `Sub Party Code "${subFormData.sub_party_code}" already exists under this Party.`,
      );
      return;
    }
    setSubExactCodeError(null);

    if (editingSubParty?.id) {
      updateSubPartyMutation.mutate(subFormData, {
        onSuccess: () => {
          setSubFormOpen(false);
          toast.success(`Sub Party ${subFormData.sub_party_code} saved successfully!`);
        },
      });
    } else {
      createSubPartyMutation.mutate(subFormData, {
        onSuccess: () => {
          setSubFormOpen(false);
          toast.success(`Sub Party ${subFormData.sub_party_code} created successfully!`);
        },
      });
    }
  };

  const handleToggleSubPartyDefault = (sub: SubParty) => {
    if (sub.is_default) return;
    if (sub.status === "Inactive") {
      toast.error("Inactive Sub Party cannot be marked as Default");
      return;
    }

    setSubPartyDefaultMutation.mutate(
      { partyId: sub.party_id, subPartyId: sub.id },
      {
        onSuccess: () => {
          toast.success(`Marked "${sub.sub_party_name}" as Default Sub Party.`);
        },
      },
    );
  };

  const handleToggleSubPartyStatus = (sub: SubParty) => {
    if (sub.status === "Active") {
      setDeactivatingSubParty(sub);
    } else {
      toast.info("Reactivation not yet implemented");
    }
  };

  const confirmDeactivateSubParty = () => {
    if (deactivatingSubParty && setSubPartyStatusMutation) {
      setSubPartyStatusMutation.mutate("Inactive", {
        onSuccess: () => {
          setDeactivatingSubParty(null);
          toast.info(`Sub Party ${deactivatingSubParty.sub_party_code} deactivated.`);
        },
      });
    }
  };

  const handleCopyMainAddressToTransaction = () => {
    const full = [
      subFormData.address_line1,
      subFormData.address_line2,
      subFormData.area,
      subFormData.city,
      subFormData.state,
      subFormData.pin_code,
    ]
      .filter(Boolean)
      .join(", ");

    setSubFormData((prev) => ({
      ...prev,
      billing_address: full,
      shipping_address: full,
      delivery_address: full,
    }));
    toast.info("Copied main address to billing, shipping, and delivery fields");
  };

  if (partiesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading parties...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Tabs Header */}
      {!selectedParentParty ? (
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {PARTY_TYPES.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery("");
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                  activeTab === tab
                    ? "bg-background text-primary shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Building2 className={`size-3.5 ${activeTab === tab ? "text-primary" : ""}`} />
                {tab}
                <Badge
                  variant={activeTab === tab ? "default" : "secondary"}
                  className="text-[0.625rem] px-1.5 py-0 h-4"
                >
                  {filteredMainParties.length}
                </Badge>
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={handleNewMainParty}
            className="h-8 gap-1 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> New {activeTab}
          </Button>
        </div>
      ) : (
        /* Breadcrumb when viewing Sub Parties */
        <div className="flex items-center justify-between gap-3 bg-card border border-border p-3 rounded-lg">
          <div className="flex items-center gap-2 text-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedParentParty(null)}
              className="h-7 text-xs gap-1"
            >
              <ArrowLeft className="size-3.5" /> Back to Parties
            </Button>
            <span className="text-muted-foreground">
              {selectedParentParty.party_code} — {selectedParentParty.party_name}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => handleOpenAddSubParty(selectedParentParty)}
            className="h-8 gap-1 text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Add Sub Party
          </Button>
        </div>
      )}

      {/* Main Parties List or Sub Parties List */}
      {!selectedParentParty ? (
        /* Main Parties List */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">{activeTab}</CardTitle>
              <span className="text-xs text-muted-foreground">
                Showing {filteredMainParties.length} of {allParties.length}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">City</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMainParties.map((party) => (
                    <TableRow key={party.id}>
                      <TableCell className="font-mono font-bold text-primary">
                        {party.party_code}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{party.party_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {party.office_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{party.city}</TableCell>
                      <TableCell>
                        <Badge
                          variant={party.status === "Active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {party.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingParty(party)}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditMainParty(party)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedParentParty(party)}
                            className="h-7 w-7 p-0"
                          >
                            <Layers className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Sub Parties List */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Sub Parties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">Location Type</TableHead>
                    <TableHead className="w-20">Default</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubParties.map((subParty) => (
                    <TableRow key={subParty.id}>
                      <TableCell className="font-mono font-bold text-primary">
                        {subParty.sub_party_code}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm">{subParty.sub_party_name}</span>
                      </TableCell>
                      <TableCell className="text-sm">{subParty.location_type}</TableCell>
                      <TableCell>
                        {subParty.is_default && (
                          <Star className="size-4 fill-primary text-primary" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={subParty.status === "Active" ? "default" : "secondary"}>
                          {subParty.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingSubParty(subParty)}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditSubParty(subParty)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Party Form Dialog */}
      <Dialog open={partyFormOpen} onOpenChange={setPartyFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingParty ? "Edit Party" : `New ${activeTab}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3">
            <div>
              <Label className="text-xs font-semibold">Party Code *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.party_code || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, party_code: e.target.value })
                }
                placeholder="e.g. P-001"
              />
              {partyErrors.party_code && (
                <p className="text-xs text-destructive mt-1">{partyErrors.party_code}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Party Name *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.party_name || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, party_name: e.target.value })
                }
              />
              {partyErrors.party_name && (
                <p className="text-xs text-destructive mt-1">{partyErrors.party_name}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Office Name *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.office_name || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, office_name: e.target.value })
                }
              />
              {partyErrors.office_name && (
                <p className="text-xs text-destructive mt-1">{partyErrors.office_name}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Contact Person</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.contact_person || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, contact_person: e.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Address Line 1 *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.address_line1 || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, address_line1: e.target.value })
                }
              />
              {partyErrors.address_line1 && (
                <p className="text-xs text-destructive mt-1">{partyErrors.address_line1}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Address Line 2</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.address_line2 || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, address_line2: e.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">City *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.city || ""}
                onChange={(e) => setPartyFormData({ ...partyFormData, city: e.target.value })}
              />
              {partyErrors.city && (
                <p className="text-xs text-destructive mt-1">{partyErrors.city}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">State *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.state || ""}
                onChange={(e) => setPartyFormData({ ...partyFormData, state: e.target.value })}
              />
              {partyErrors.state && (
                <p className="text-xs text-destructive mt-1">{partyErrors.state}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">PIN Code *</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.pin_code || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, pin_code: e.target.value })
                }
              />
              {partyErrors.pin_code && (
                <p className="text-xs text-destructive mt-1">{partyErrors.pin_code}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Mobile</Label>
              <Input
                className="h-8 text-xs"
                value={partyFormData.mobile || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, mobile: e.target.value })
                }
              />
              {partyErrors.mobile && (
                <p className="text-xs text-destructive mt-1">{partyErrors.mobile}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Email</Label>
              <Input
                className="h-8 text-xs"
                type="email"
                value={partyFormData.email || ""}
                onChange={(e) =>
                  setPartyFormData({ ...partyFormData, email: e.target.value })
                }
              />
              {partyErrors.email && (
                <p className="text-xs text-destructive mt-1">{partyErrors.email}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">GSTIN</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={partyFormData.gstin || ""}
                onChange={(e) =>
                  setPartyFormData({
                    ...partyFormData,
                    gstin: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g. 27AABCD1234H1Z0"
              />
              {partyErrors.gstin && (
                <p className="text-xs text-destructive mt-1">{partyErrors.gstin}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">PAN</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={partyFormData.pan || ""}
                onChange={(e) =>
                  setPartyFormData({
                    ...partyFormData,
                    pan: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g. AABCD1234H"
              />
              {partyErrors.pan && (
                <p className="text-xs text-destructive mt-1">{partyErrors.pan}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 py-2 border-t">
            <Label className="text-xs font-semibold">Remarks</Label>
            <Textarea
              className="h-20 text-xs"
              value={partyFormData.remarks || ""}
              onChange={(e) =>
                setPartyFormData({ ...partyFormData, remarks: e.target.value })
              }
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPartyFormOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmitPartyForm()}
              disabled={createPartyMutation.isPending || updatePartyMutation.isPending}
              className="h-8 text-xs"
            >
              {createPartyMutation.isPending || updatePartyMutation.isPending
                ? "Saving..."
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub Party Form Dialog */}
      <Dialog open={subFormOpen} onOpenChange={setSubFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editingSubParty ? "Edit Sub Party" : "New Sub Party"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-3">
            <div>
              <Label className="text-xs font-semibold">Sub Party Code *</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.sub_party_code || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, sub_party_code: e.target.value })
                }
                placeholder="e.g. SP-001"
              />
              {subErrors.sub_party_code && (
                <p className="text-xs text-destructive mt-1">{subErrors.sub_party_code}</p>
              )}
              {subExactCodeError && (
                <p className="text-xs text-destructive mt-1">{subExactCodeError}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Sub Party Name *</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.sub_party_name || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, sub_party_name: e.target.value })
                }
              />
              {subErrors.sub_party_name && (
                <p className="text-xs text-destructive mt-1">{subErrors.sub_party_name}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Location Type *</Label>
              <Select
                value={subFormData.location_type || ""}
                onValueChange={(v) =>
                  setSubFormData({ ...subFormData, location_type: v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map((lt) => (
                    <SelectItem key={lt} value={lt} className="text-xs">
                      {lt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Contact Person</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.contact_person || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, contact_person: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold">Address Line 1 *</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.address_line1 || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, address_line1: e.target.value })
                }
              />
              {subErrors.address_line1 && (
                <p className="text-xs text-destructive mt-1">{subErrors.address_line1}</p>
              )}
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold">Address Line 2</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.address_line2 || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, address_line2: e.target.value })
                }
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">City *</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.city || ""}
                onChange={(e) => setSubFormData({ ...subFormData, city: e.target.value })}
              />
              {subErrors.city && (
                <p className="text-xs text-destructive mt-1">{subErrors.city}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">State *</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.state || ""}
                onChange={(e) => setSubFormData({ ...subFormData, state: e.target.value })}
              />
              {subErrors.state && (
                <p className="text-xs text-destructive mt-1">{subErrors.state}</p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Mobile</Label>
              <Input
                className="h-8 text-xs"
                value={subFormData.mobile || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, mobile: e.target.value })
                }
              />
              {subErrors.mobile && (
                <p className="text-xs text-destructive mt-1">{subErrors.mobile}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">Email</Label>
              <Input
                className="h-8 text-xs"
                type="email"
                value={subFormData.email || ""}
                onChange={(e) =>
                  setSubFormData({ ...subFormData, email: e.target.value })
                }
              />
              {subErrors.email && (
                <p className="text-xs text-destructive mt-1">{subErrors.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-2 py-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Mark as Default Sub Party</Label>
              <Switch
                checked={subFormData.is_default || false}
                onCheckedChange={(v) =>
                  setSubFormData({ ...subFormData, is_default: v })
                }
              />
            </div>
            <Label className="text-xs font-semibold">Remarks</Label>
            <Textarea
              className="h-16 text-xs"
              value={subFormData.remarks || ""}
              onChange={(e) =>
                setSubFormData({ ...subFormData, remarks: e.target.value })
              }
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSubFormOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmitSubPartyForm()}
              disabled={createSubPartyMutation.isPending || updateSubPartyMutation.isPending}
              className="h-8 text-xs"
            >
              {createSubPartyMutation.isPending || updateSubPartyMutation.isPending
                ? "Saving..."
                : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Sub Party Confirmation */}
      <AlertDialog open={!!deactivatingSubParty} onOpenChange={() => setDeactivatingSubParty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Sub Party?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate "{deactivatingSubParty?.sub_party_code}" and may affect related
              transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivateSubParty}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
