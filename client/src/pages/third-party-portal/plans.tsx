import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, Wrench, Sparkles, Clock, Loader2, AlertCircle, CheckCircle2, XCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const weekDays = [
  { id: 0, name: "Dom" },
  { id: 1, name: "Seg" },
  { id: 2, name: "Ter" },
  { id: 3, name: "Qua" },
  { id: 4, name: "Qui" },
  { id: 5, name: "Sex" },
  { id: 6, name: "Sáb" },
];

const planProposalSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().optional(),
  planType: z.enum(["preventive", "corrective", "predictive", "cleaning", "deep_cleaning", "sanitization"]),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"]),
  weekDays: z.array(z.number()).optional(),
  estimatedDuration: z.number().min(1, "Duração estimada obrigatória"),
  zoneId: z.string().min(1, "Zona obrigatória"),
  equipmentId: z.string().optional(),
  checklistItems: z.array(z.object({
    description: z.string(),
    required: z.boolean().default(true),
  })).optional(),
});

type PlanProposalFormData = z.infer<typeof planProposalSchema>;

export default function ThirdPartyPlans() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<{ description: string; required: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const { data: modulesData, isLoading: loadingModules } = useQuery<{
    allowedModules: string[];
    companyName: string;
    customerId: string;
  }>({
    queryKey: ['/api/third-party-portal/my-modules'],
  });

  const { data: zones = [] } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/zones'],
  });

  const { data: equipment = [] } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/equipment'],
  });

  const { data: proposals = [], isLoading: loadingProposals } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/plan-proposals'],
  });

  const form = useForm<PlanProposalFormData>({
    resolver: zodResolver(planProposalSchema),
    defaultValues: {
      title: "",
      description: "",
      planType: "preventive",
      frequency: "monthly",
      weekDays: [],
      estimatedDuration: 30,
      zoneId: "",
      equipmentId: "",
      checklistItems: [],
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: PlanProposalFormData & { module: string }) => {
      return await apiRequest("POST", "/api/third-party-portal/plan-proposals", {
        ...data,
        checklistItems,
      });
    },
    onSuccess: () => {
      toast({ title: "Proposta de plano enviada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/plan-proposals'] });
      setIsCreateDialogOpen(false);
      setSelectedModule(null);
      setChecklistItems([]);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar proposta", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: PlanProposalFormData) => {
    if (!selectedModule) return;
    createProposalMutation.mutate({
      ...data,
      module: selectedModule,
      checklistItems,
    });
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, { description: newChecklistItem.trim(), required: true }]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_espera':
        return <Badge className="bg-yellow-500/10 text-yellow-600"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>;
      case 'aprovado':
        return <Badge className="bg-chart-2/10 text-chart-2"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'recusado':
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1" />Recusado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: "Diário",
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      annual: "Anual",
    };
    return labels[freq] || freq;
  };

  const getPlanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      preventive: "Preventiva",
      corrective: "Corretiva",
      predictive: "Preditiva",
      cleaning: "Limpeza",
      deep_cleaning: "Limpeza Profunda",
      sanitization: "Sanitização",
    };
    return labels[type] || type;
  };

  const allowedModules = modulesData?.allowedModules || [];
  const hasMaintenanceAccess = allowedModules.includes('maintenance');
  const hasCleanAccess = allowedModules.includes('clean');

  if (loadingModules) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!hasMaintenanceAccess && !hasCleanAccess) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sem Acesso a Módulos</h3>
          <p className="text-muted-foreground text-center">
            Sua empresa não possui permissão para criar propostas de planos.
            Entre em contato com o cliente para solicitar acesso.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maintenancePlanTypes = [
    { value: "preventive", label: "Preventiva" },
    { value: "corrective", label: "Corretiva" },
    { value: "predictive", label: "Preditiva" },
  ];

  const cleanPlanTypes = [
    { value: "cleaning", label: "Limpeza" },
    { value: "deep_cleaning", label: "Limpeza Profunda" },
    { value: "sanitization", label: "Sanitização" },
  ];

  const planTypesForModule = selectedModule === 'maintenance' ? maintenancePlanTypes : cleanPlanTypes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Propostas de Planos</h1>
          <p className="text-muted-foreground">
            Proponha planos de manutenção ou limpeza para aprovação do cliente
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (open) {
            // Auto-select module if only one is available
            if (hasMaintenanceAccess && !hasCleanAccess) {
              setSelectedModule('maintenance');
              form.setValue('planType', 'preventive');
            } else if (hasCleanAccess && !hasMaintenanceAccess) {
              setSelectedModule('clean');
              form.setValue('planType', 'cleaning');
            }
          } else {
            setSelectedModule(null);
            setChecklistItems([]);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan-proposal">
              <Plus className="w-4 h-4 mr-2" />
              Nova Proposta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Proposta de Plano</DialogTitle>
              <DialogDescription>
                Selecione o módulo e preencha os detalhes do plano proposto
              </DialogDescription>
            </DialogHeader>

            {!selectedModule ? (
              <div className="grid grid-cols-2 gap-4 py-4">
                {hasMaintenanceAccess && (
                  <Card 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedModule('maintenance');
                      form.setValue('planType', 'preventive');
                    }}
                    data-testid="card-select-maintenance"
                  >
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Wrench className="w-12 h-12 text-orange-500 mb-3" />
                      <h3 className="font-medium">Manutenção</h3>
                      <p className="text-sm text-muted-foreground">Plano de Manutenção</p>
                    </CardContent>
                  </Card>
                )}
                {hasCleanAccess && (
                  <Card 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedModule('clean');
                      form.setValue('planType', 'cleaning');
                    }}
                    data-testid="card-select-clean"
                  >
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Sparkles className="w-12 h-12 text-blue-500 mb-3" />
                      <h3 className="font-medium">Limpeza</h3>
                      <p className="text-sm text-muted-foreground">Plano de Limpeza</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título do Plano</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Manutenção Preventiva Mensal" {...field} data-testid="input-plan-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Descreva o plano proposto..." {...field} data-testid="input-plan-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="planType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Plano</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-plan-type">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {planTypesForModule.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-frequency">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Diário</SelectItem>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="biweekly">Quinzenal</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="quarterly">Trimestral</SelectItem>
                              <SelectItem value="semiannual">Semestral</SelectItem>
                              <SelectItem value="annual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {(form.watch('frequency') === 'weekly' || form.watch('frequency') === 'biweekly') && (
                    <FormField
                      control={form.control}
                      name="weekDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias da Semana</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {weekDays.map((day) => (
                              <label 
                                key={day.id} 
                                className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover-elevate"
                              >
                                <Checkbox
                                  checked={field.value?.includes(day.id)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), day.id]
                                      : (field.value || []).filter((d) => d !== day.id);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-day-${day.id}`}
                                />
                                <span className="text-sm">{day.name}</span>
                              </label>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="zoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-zone">
                                <SelectValue placeholder="Selecione a zona" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {zones.map((zone: any) => (
                                <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estimatedDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração Estimada (min)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-duration" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {selectedModule === 'maintenance' && (
                    <FormField
                      control={form.control}
                      name="equipmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipamento (opcional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-equipment">
                                <SelectValue placeholder="Selecione o equipamento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Nenhum</SelectItem>
                              {equipment.map((eq: any) => (
                                <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-2">
                    <FormLabel>Itens do Checklist</FormLabel>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Adicionar item ao checklist" 
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                        data-testid="input-checklist-item"
                      />
                      <Button type="button" variant="outline" onClick={addChecklistItem} data-testid="button-add-checklist">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {checklistItems.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {checklistItems.map((item, index) => (
                          <div key={index} className="flex items-center justify-between gap-2 p-2 border rounded-md">
                            <span className="text-sm">{item.description}</span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeChecklistItem(index)}
                              data-testid={`button-remove-checklist-${index}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setSelectedModule(null)}
                      data-testid="button-back"
                    >
                      Voltar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createProposalMutation.isPending}
                      data-testid="button-submit-proposal"
                    >
                      {createProposalMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Enviar Proposta
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-proposals">Todas</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-proposals">Aguardando</TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved-proposals">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected-proposals">Recusadas</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'approved', 'rejected'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Propostas de Planos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProposals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : proposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma proposta de plano encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposals
                        .filter((p: any) => {
                          if (tab === 'all') return true;
                          if (tab === 'pending') return p.status === 'em_espera';
                          if (tab === 'approved') return p.status === 'aprovado';
                          if (tab === 'rejected') return p.status === 'recusado';
                          return true;
                        })
                        .map((proposal: any) => (
                          <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                            <TableCell className="font-medium">{proposal.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {proposal.module === 'maintenance' ? (
                                  <><Wrench className="w-3 h-3 mr-1" />Manutenção</>
                                ) : (
                                  <><Sparkles className="w-3 h-3 mr-1" />Limpeza</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>{getPlanTypeLabel(proposal.planType)}</TableCell>
                            <TableCell>{getFrequencyLabel(proposal.frequency)}</TableCell>
                            <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                            <TableCell>
                              {proposal.createdAt && format(new Date(proposal.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
