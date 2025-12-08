import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { 
  Plus, 
  Calendar,
  Edit, 
  Trash2,
  Settings,
  CheckCircle2
} from "lucide-react";

interface MaintenancePlansProps {
  customerId: string;
}

export default function MaintenancePlans({ customerId }: MaintenancePlansProps) {
  const { toast } = useToast();
  const { currentModule } = useModule();

  // Planos de Manutenção são exclusivos do módulo de manutenção
  if (currentModule !== 'maintenance') {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Funcionalidade Não Disponível</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Calendar className="w-16 h-16 mx-auto text-slate-400" />
            <p className="text-slate-600">
              Os planos de manutenção estão disponíveis apenas no módulo <strong>OPUS Manutenção</strong>.
            </p>
            <p className="text-sm text-slate-500">
              Alterne para OPUS Manutenção usando o seletor de plataforma na barra lateral.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageEquipmentDialogOpen, setIsManageEquipmentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  
  // Form states
  const [planName, setPlanName] = useState("");
  const [planType, setPlanType] = useState("preventiva");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Equipment assignment states
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [frequency, setFrequency] = useState("mensal");

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });

  // Fetch maintenance plans
  const { data: plans, isLoading } = useQuery({
    queryKey: [`/api/customers/${customerId}/maintenance-plans`, { module: currentModule }],
    enabled: !!customerId,
  });

  // Fetch equipment for selected customer
  const { data: equipment } = useQuery({
    queryKey: [`/api/customers/${customerId}/equipment`, { module: currentModule }],
    enabled: !!customerId,
  });

  // Fetch checklist templates
  const { data: templates } = useQuery({
    queryKey: [`/api/customers/${customerId}/maintenance-checklist-templates`, { module: currentModule }],
    enabled: !!customerId,
  });

  // Fetch plan equipments for selected plan
  const { data: planEquipments } = useQuery({
    queryKey: [`/api/maintenance-plans/${selectedPlan?.id}/equipments`],
    enabled: !!selectedPlan?.id,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/maintenance-plans", data);
    },
    onSuccess: () => {
      toast({ title: "Plano criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-plans`] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar plano", 
        variant: "destructive" 
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/maintenance-plans/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Plano atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-plans`] });
      setIsEditDialogOpen(false);
      setEditingPlan(null);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar plano", 
        variant: "destructive" 
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/maintenance-plans/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Plano excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-plans`] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao excluir plano", 
        variant: "destructive" 
      });
    },
  });

  const addEquipmentToPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/maintenance-plan-equipments", data);
    },
    onSuccess: () => {
      toast({ title: "Equipamento adicionado ao plano" });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-plans/${selectedPlan?.id}/equipments`] });
      setSelectedEquipmentId("");
      setSelectedTemplateId("");
      setFrequency("mensal");
    },
    onError: () => {
      toast({ 
        title: "Erro ao adicionar equipamento", 
        variant: "destructive" 
      });
    },
  });

  const removeEquipmentFromPlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/maintenance-plan-equipments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Equipamento removido do plano" });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance-plans/${selectedPlan?.id}/equipments`] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao remover equipamento", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setPlanName("");
    setPlanType("preventiva");
    setDescription("");
    setIsActive(true);
  };

  const handleCreate = () => {
    const companyId = (customer as any)?.companyId;
    if (!companyId || !planName) {
      toast({ 
        title: "Preencha todos os campos obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    createPlanMutation.mutate({
      companyId,
      customerId,
      name: planName,
      type: planType,
      description: description || null,
      isActive,
    });
  };

  const handleEdit = (plan: any) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanType(plan.type);
    setDescription(plan.description || "");
    setIsActive(plan.isActive);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    const companyId = (customer as any)?.companyId;
    if (!editingPlan || !companyId) return;

    updatePlanMutation.mutate({
      id: editingPlan.id,
      companyId,
      customerId,
      name: planName,
      type: planType,
      description: description || null,
      isActive,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este plano?")) {
      deletePlanMutation.mutate(id);
    }
  };

  const handleManageEquipment = (plan: any) => {
    setSelectedPlan(plan);
    setIsManageEquipmentDialogOpen(true);
  };

  const handleAddEquipment = () => {
    if (!selectedEquipmentId || !selectedTemplateId) {
      toast({ 
        title: "Selecione um equipamento e um template", 
        variant: "destructive" 
      });
      return;
    }

    addEquipmentToPlanMutation.mutate({
      planId: selectedPlan.id,
      equipmentId: selectedEquipmentId,
      checklistTemplateId: selectedTemplateId,
      frequency,
    });
  };

  const getEquipmentName = (equipmentId: string) => {
    if (!Array.isArray(equipment)) return "N/A";
    return equipment.find((e: any) => e.id === equipmentId)?.name || "N/A";
  };

  const getTemplateName = (templateId: string) => {
    if (!Array.isArray(templates)) return "N/A";
    return templates.find((t: any) => t.id === templateId)?.name || "N/A";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Planos de Manutenção" description="Gerencie planos preventivos e preditivos" />

      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Lista de Planos</CardTitle>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-plan">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar Novo Plano de Manutenção</DialogTitle>
                  <DialogDescription>
                    Defina um plano para agrupar equipamentos
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="planName">Nome do Plano *</Label>
                    <Input
                      id="planName"
                      data-testid="input-plan-name"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="Ex: Manutenção Preventiva HVAC"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planType">Tipo de Manutenção</Label>
                    <Select value={planType} onValueChange={setPlanType}>
                      <SelectTrigger data-testid="select-plan-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="preditiva">Preditiva</SelectItem>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      data-testid="input-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva o objetivo e escopo do plano"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded"
                      data-testid="checkbox-is-active"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Plano ativo
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createPlanMutation.isPending}
                    data-testid="button-save"
                  >
                    {createPlanMutation.isPending ? "Criando..." : "Criar Plano"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Carregando planos...</div>
            ) : !Array.isArray(plans) || plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum plano cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(plans) && plans.map((plan: any) => (
                    <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell className="capitalize">
                        <Badge variant="outline">{plan.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {plan.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {plan.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageEquipment(plan)}
                            data-testid={`button-manage-${plan.id}`}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(plan)}
                            data-testid={`button-edit-${plan.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(plan.id)}
                            data-testid={`button-delete-${plan.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Plano de Manutenção</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano *</Label>
                <Input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Manutenção</Label>
                <Select value={planType} onValueChange={setPlanType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="preditiva">Preditiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="editIsActive" className="cursor-pointer">
                  Plano ativo
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingPlan(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updatePlanMutation.isPending}
              >
                {updatePlanMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manage Equipment Dialog */}
        <Dialog open={isManageEquipmentDialogOpen} onOpenChange={setIsManageEquipmentDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Equipamentos - {selectedPlan?.name}</DialogTitle>
              <DialogDescription>
                Adicione ou remova equipamentos deste plano
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Adicionar Equipamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Equipamento</Label>
                      <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um equipamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(equipment) && equipment.map((equip: any) => (
                            <SelectItem key={equip.id} value={equip.id}>
                              {equip.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Template de Checklist</Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(templates) && templates.map((template: any) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diaria">Diária</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="bimestral">Bimestral</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleAddEquipment}
                    disabled={addEquipmentToPlanMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Equipamento
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Equipamentos no Plano</CardTitle>
                </CardHeader>
                <CardContent>
                  {!Array.isArray(planEquipments) || planEquipments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum equipamento neste plano
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Checklist</TableHead>
                          <TableHead>Frequência</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(planEquipments) && planEquipments.map((pe: any) => (
                          <TableRow key={pe.id}>
                            <TableCell>{getEquipmentName(pe.equipmentId)}</TableCell>
                            <TableCell>{getTemplateName(pe.checklistTemplateId)}</TableCell>
                            <TableCell className="capitalize">{pe.frequency}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEquipmentFromPlanMutation.mutate(pe.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
