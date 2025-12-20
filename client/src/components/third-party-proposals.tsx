import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClient } from "@/contexts/ClientContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Check, 
  X, 
  Clock, 
  Building2, 
  MapPin, 
  AlertTriangle,
  Calendar,
  Wrench,
  ClipboardList,
  Repeat,
  Eye,
  Info
} from "lucide-react";

interface ThirdPartyProposal {
  id: string;
  thirdPartyCompanyId: string;
  thirdPartyCompanyName: string;
  customerId: string;
  title: string;
  description: string | null;
  zoneId: string | null;
  equipmentId: string | null;
  priority: string;
  dueDate: string | null;
  module: string;
  status: string;
  workOrderId: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface ThirdPartyPlanProposal {
  id: string;
  thirdPartyCompanyId: string;
  thirdPartyCompanyName: string;
  customerId: string;
  title: string;
  description: string | null;
  module: string;
  planType: string;
  frequency: string;
  customFrequency: number | null;
  frequencyUnit: string | null;
  siteId: string | null;
  zoneId: string | null;
  equipmentId: string | null;
  checklistId: string | null;
  status: string;
  createdPlanId: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface ThirdPartyProposalsProps {
  module: 'maintenance' | 'clean';
}

export function ThirdPartyProposalsCard({ module, onClick }: ThirdPartyProposalsProps & { onClick: () => void }) {
  const { activeClientId } = useClient();
  const theme = useModuleTheme();

  const { data: pendingWOCount } = useQuery<{ count: number }>({
    queryKey: ["/api/customers", activeClientId, "third-party-proposals", "pending-count", { module }],
    enabled: !!activeClientId,
  });

  const { data: pendingPlanCount } = useQuery<{ count: number }>({
    queryKey: ["/api/customers", activeClientId, "third-party-plan-proposals", "pending-count", { module }],
    enabled: !!activeClientId,
  });

  const count = (pendingWOCount?.count || 0) + (pendingPlanCount?.count || 0);

  return (
    <div 
      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors group"
      onClick={onClick}
      data-testid="card-pending-proposals"
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform relative",
        count > 0 ? "bg-amber-50" : "bg-gray-50"
      )}>
        <FileText className={cn("w-5 h-5", count > 0 ? "text-amber-600" : "text-gray-400")} />
        {count > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">{count > 9 ? "9+" : count}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Propostas</p>
        <p className={cn("text-xl font-bold", count > 0 ? "text-amber-600" : "text-gray-400")}>
          {count}
        </p>
      </div>
    </div>
  );
}

export function ThirdPartyProposalsModal({ 
  module, 
  isOpen, 
  onClose 
}: ThirdPartyProposalsProps & { isOpen: boolean; onClose: () => void }) {
  const { activeClientId } = useClient();
  const theme = useModuleTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedProposal, setSelectedProposal] = useState<ThirdPartyProposal | ThirdPartyPlanProposal | null>(null);
  const [proposalType, setProposalType] = useState<'wo' | 'plan'>('wo');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsPlanProposal, setDetailsPlanProposal] = useState<ThirdPartyPlanProposal | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("em_espera");
  const [activeTab, setActiveTab] = useState<string>("work-orders");

  const { data: woProposals, isLoading: isLoadingWO } = useQuery<ThirdPartyProposal[]>({
    queryKey: ["/api/customers", activeClientId, "third-party-proposals", { module }],
    enabled: !!activeClientId && isOpen,
  });

  const { data: planProposals, isLoading: isLoadingPlans } = useQuery<ThirdPartyPlanProposal[]>({
    queryKey: ["/api/customers", activeClientId, "third-party-plan-proposals", { module }],
    enabled: !!activeClientId && isOpen,
  });

  const { data: zones } = useQuery<any[]>({
    queryKey: ["/api/customers", activeClientId, "zones", { module }],
    enabled: !!activeClientId,
  });

  const { data: sites } = useQuery<any[]>({
    queryKey: ["/api/customers", activeClientId, "sites", { module }],
    enabled: !!activeClientId,
  });

  const { data: equipment } = useQuery<any[]>({
    queryKey: ["/api/customers", activeClientId, "equipment"],
    enabled: !!activeClientId,
  });

  const approveWOMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest("POST", `/api/customers/${activeClientId}/third-party-proposals/${proposalId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "third-party-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "work-orders"] });
      toast({ title: "Proposta aprovada", description: "A ordem de serviço foi criada com sucesso." });
      setSelectedProposal(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível aprovar a proposta.", variant: "destructive" });
    },
  });

  const rejectWOMutation = useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: string; reason: string }) => {
      return apiRequest("POST", `/api/customers/${activeClientId}/third-party-proposals/${proposalId}/reject`, {
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "third-party-proposals"] });
      toast({ title: "Proposta rejeitada", description: "A proposta foi rejeitada." });
      setShowRejectDialog(false);
      setSelectedProposal(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível rejeitar a proposta.", variant: "destructive" });
    },
  });

  const approvePlanMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest("POST", `/api/customers/${activeClientId}/third-party-plan-proposals/${proposalId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "third-party-plan-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "maintenance-activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "cleaning-schedules"] });
      toast({ title: "Proposta aprovada", description: "O plano foi criado com sucesso." });
      setSelectedProposal(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível aprovar a proposta.", variant: "destructive" });
    },
  });

  const rejectPlanMutation = useMutation({
    mutationFn: async ({ proposalId, reason }: { proposalId: string; reason: string }) => {
      return apiRequest("POST", `/api/customers/${activeClientId}/third-party-plan-proposals/${proposalId}/reject`, {
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "third-party-plan-proposals"] });
      toast({ title: "Proposta rejeitada", description: "A proposta foi rejeitada." });
      setShowRejectDialog(false);
      setSelectedProposal(null);
      setRejectionReason("");
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível rejeitar a proposta.", variant: "destructive" });
    },
  });

  const filteredWOProposals = woProposals?.filter(p => 
    statusFilter === "all" ? true : p.status === statusFilter
  ) || [];

  const filteredPlanProposals = planProposals?.filter(p => 
    statusFilter === "all" ? true : p.status === statusFilter
  ) || [];

  const pendingWOCount = woProposals?.filter(p => p.status === "em_espera").length || 0;
  const pendingPlanCount = planProposals?.filter(p => p.status === "em_espera").length || 0;

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId || !zones) return "N/A";
    const zone = zones.find(z => z.id === zoneId);
    return zone?.name || "N/A";
  };

  const getSiteName = (siteId: string | null) => {
    if (!siteId || !sites) return "N/A";
    const site = sites.find(s => s.id === siteId);
    return site?.name || "N/A";
  };

  const getEquipmentName = (equipmentId: string | null) => {
    if (!equipmentId || !equipment) return null;
    const equip = equipment.find(e => e.id === equipmentId);
    return equip?.name || null;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { class: string; label: string }> = {
      baixa: { class: "bg-green-100 text-green-700", label: "Baixa" },
      media: { class: "bg-yellow-100 text-yellow-700", label: "Média" },
      alta: { class: "bg-orange-100 text-orange-700", label: "Alta" },
      critica: { class: "bg-red-100 text-red-700", label: "Crítica" },
    };
    const variant = variants[priority] || variants.media;
    return <Badge className={variant.class}>{variant.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { class: string; label: string }> = {
      em_espera: { class: "bg-amber-100 text-amber-700", label: "Pendente" },
      aprovado: { class: "bg-green-100 text-green-700", label: "Aprovado" },
      recusado: { class: "bg-red-100 text-red-700", label: "Recusado" },
    };
    const variant = variants[status] || variants.em_espera;
    return <Badge className={variant.class}>{variant.label}</Badge>;
  };

  const getFrequencyLabel = (frequency: string, customFrequency?: number | null, frequencyUnit?: string | null) => {
    const labels: Record<string, string> = {
      diario: "Diário",
      semanal: "Semanal",
      quinzenal: "Quinzenal",
      mensal: "Mensal",
      bimestral: "Bimestral",
      trimestral: "Trimestral",
      semestral: "Semestral",
      anual: "Anual",
      personalizado: customFrequency && frequencyUnit 
        ? `A cada ${customFrequency} ${frequencyUnit === 'days' ? 'dias' : frequencyUnit === 'weeks' ? 'semanas' : 'meses'}`
        : "Personalizado",
    };
    return labels[frequency] || frequency;
  };

  const getPlanTypeLabel = (planType: string) => {
    const labels: Record<string, string> = {
      preventiva: "Preventiva",
      preditiva: "Preditiva",
      corretiva: "Corretiva",
    };
    return labels[planType] || planType;
  };

  const StatusFilterButtons = () => (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <Button
        variant={statusFilter === "em_espera" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("em_espera")}
        className={statusFilter === "em_espera" ? cn(theme.buttons.primary) : ""}
        style={statusFilter === "em_espera" ? theme.buttons.primaryStyle : undefined}
        data-testid="filter-pending"
      >
        <Clock className="w-4 h-4 mr-1" />
        Pendentes
      </Button>
      <Button
        variant={statusFilter === "aprovado" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("aprovado")}
        data-testid="filter-approved"
      >
        <Check className="w-4 h-4 mr-1" />
        Aprovadas
      </Button>
      <Button
        variant={statusFilter === "recusado" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("recusado")}
        data-testid="filter-rejected"
      >
        <X className="w-4 h-4 mr-1" />
        Recusadas
      </Button>
      <Button
        variant={statusFilter === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter("all")}
        data-testid="filter-all"
      >
        Todas
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Propostas de Terceiros
            </DialogTitle>
            <DialogDescription>
              Gerencie as propostas enviadas por empresas terceirizadas
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="work-orders" className="relative">
                <Wrench className="w-4 h-4 mr-2" />
                Ordens de Serviço
                {pendingWOCount > 0 && (
                  <Badge className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5">{pendingWOCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="plans" className="relative">
                <ClipboardList className="w-4 h-4 mr-2" />
                Planos
                {pendingPlanCount > 0 && (
                  <Badge className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5">{pendingPlanCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="work-orders" className="flex-1 overflow-hidden flex flex-col mt-4">
              <StatusFilterButtons />
              <div className="flex-1 overflow-y-auto space-y-3">
                {isLoadingWO ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : filteredWOProposals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma proposta encontrada</p>
                  </div>
                ) : (
                  filteredWOProposals.map((proposal) => (
                    <div key={proposal.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" data-testid={`proposal-wo-${proposal.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-medium truncate">{proposal.title}</h4>
                            {getStatusBadge(proposal.status)}
                            {getPriorityBadge(proposal.priority)}
                          </div>
                          {proposal.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{proposal.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {proposal.thirdPartyCompanyName}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {getZoneName(proposal.zoneId)}
                            </span>
                            {proposal.equipmentId && (
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {getEquipmentName(proposal.equipmentId)}
                              </span>
                            )}
                            {proposal.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(proposal.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(proposal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {proposal.status === "recusado" && proposal.rejectionReason && (
                            <div className="mt-2 p-2 bg-red-50 rounded-md text-xs text-red-700">
                              <strong>Motivo da recusa:</strong> {proposal.rejectionReason}
                            </div>
                          )}
                        </div>
                        {proposal.status === "em_espera" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedProposal(proposal); setProposalType('wo'); setShowRejectDialog(true); }}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              data-testid={`reject-wo-${proposal.id}`}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveWOMutation.mutate(proposal.id)}
                              disabled={approveWOMutation.isPending}
                              className={cn(theme.buttons.primary)}
                              style={theme.buttons.primaryStyle}
                              data-testid={`approve-wo-${proposal.id}`}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {approveWOMutation.isPending ? "Aprovando..." : "Aprovar"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="plans" className="flex-1 overflow-hidden flex flex-col mt-4">
              <StatusFilterButtons />
              <div className="flex-1 overflow-y-auto space-y-3">
                {isLoadingPlans ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : filteredPlanProposals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma proposta de plano encontrada</p>
                  </div>
                ) : (
                  filteredPlanProposals.map((proposal) => (
                    <div key={proposal.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" data-testid={`proposal-plan-${proposal.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-medium truncate">{proposal.title}</h4>
                            {getStatusBadge(proposal.status)}
                            <Badge variant="outline">{getPlanTypeLabel(proposal.planType)}</Badge>
                            <Badge className="bg-blue-100 text-blue-700">{module === 'maintenance' ? 'Manutenção' : 'Limpeza'}</Badge>
                          </div>
                          {proposal.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{proposal.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {proposal.thirdPartyCompanyName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {getFrequencyLabel(proposal.frequency, proposal.customFrequency, proposal.frequencyUnit)}
                            </span>
                            {proposal.siteId && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {getSiteName(proposal.siteId)}
                              </span>
                            )}
                            {proposal.zoneId && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {getZoneName(proposal.zoneId)}
                              </span>
                            )}
                            {proposal.equipmentId && (
                              <span className="flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {getEquipmentName(proposal.equipmentId)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(proposal.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {proposal.status === "recusado" && proposal.rejectionReason && (
                            <div className="mt-2 p-2 bg-red-50 rounded-md text-xs text-red-700">
                              <strong>Motivo da recusa:</strong> {proposal.rejectionReason}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setDetailsPlanProposal(proposal); setShowDetailsDialog(true); }}
                            data-testid={`details-plan-${proposal.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detalhes
                          </Button>
                          {proposal.status === "em_espera" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedProposal(proposal); setProposalType('plan'); setShowRejectDialog(true); }}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                data-testid={`reject-plan-${proposal.id}`}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Rejeitar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approvePlanMutation.mutate(proposal.id)}
                                disabled={approvePlanMutation.isPending}
                                className={cn(theme.buttons.primary)}
                                style={theme.buttons.primaryStyle}
                                data-testid={`approve-plan-${proposal.id}`}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                {approvePlanMutation.isPending ? "Aprovando..." : "Aprovar"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open);
        if (!open) {
          setRejectionReason("");
          setSelectedProposal(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Rejeitar Proposta
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para notificar a empresa terceirizada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                data-testid="input-rejection-reason"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                  setSelectedProposal(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedProposal) {
                    if (proposalType === 'wo') {
                      rejectWOMutation.mutate({ proposalId: selectedProposal.id, reason: rejectionReason });
                    } else {
                      rejectPlanMutation.mutate({ proposalId: selectedProposal.id, reason: rejectionReason });
                    }
                  }
                }}
                disabled={rejectWOMutation.isPending || rejectPlanMutation.isPending}
                data-testid="confirm-reject"
              >
                {(rejectWOMutation.isPending || rejectPlanMutation.isPending) ? "Rejeitando..." : "Confirmar Rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) setDetailsPlanProposal(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Detalhes da Proposta de Plano
            </DialogTitle>
            <DialogDescription>
              Informações completas sobre a proposta de plano enviada pelo terceiro
            </DialogDescription>
          </DialogHeader>

          {detailsPlanProposal && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Título</Label>
                  <p className="font-medium">{detailsPlanProposal.title}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(detailsPlanProposal.status)}</div>
                </div>
              </div>

              {detailsPlanProposal.description && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-sm">{detailsPlanProposal.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo de Plano</Label>
                  <p className="font-medium">{getPlanTypeLabel(detailsPlanProposal.planType)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Módulo</Label>
                  <Badge className="bg-blue-100 text-blue-700">{module === 'maintenance' ? 'Manutenção' : 'Limpeza'}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Frequência</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Repeat className="w-4 h-4" />
                    {getFrequencyLabel(detailsPlanProposal.frequency, detailsPlanProposal.customFrequency, detailsPlanProposal.frequencyUnit)}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Empresa Terceirizada</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {detailsPlanProposal.thirdPartyCompanyName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {detailsPlanProposal.siteId && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Site</Label>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {getSiteName(detailsPlanProposal.siteId)}
                    </p>
                  </div>
                )}
                {detailsPlanProposal.zoneId && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Zona</Label>
                    <p className="font-medium flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {getZoneName(detailsPlanProposal.zoneId)}
                    </p>
                  </div>
                )}
              </div>

              {detailsPlanProposal.equipmentId && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Equipamento</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Wrench className="w-4 h-4" />
                    {getEquipmentName(detailsPlanProposal.equipmentId)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data de Criação</Label>
                  <p className="text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(detailsPlanProposal.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {detailsPlanProposal.reviewedAt && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data de Revisão</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(detailsPlanProposal.reviewedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              {detailsPlanProposal.status === "recusado" && detailsPlanProposal.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <Label className="text-xs text-red-600">Motivo da Recusa</Label>
                  <p className="text-sm text-red-700 mt-1">{detailsPlanProposal.rejectionReason}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Fechar
                </Button>
                {detailsPlanProposal.status === "em_espera" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDetailsDialog(false);
                        setSelectedProposal(detailsPlanProposal);
                        setProposalType('plan');
                        setShowRejectDialog(true);
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => {
                        approvePlanMutation.mutate(detailsPlanProposal.id);
                        setShowDetailsDialog(false);
                      }}
                      disabled={approvePlanMutation.isPending}
                      className={cn(theme.buttons.primary)}
                      style={theme.buttons.primaryStyle}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
