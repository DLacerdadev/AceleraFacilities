import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { 
  Plus, 
  Building, 
  MapPin, 
  Eye, 
  Edit, 
  Trash2,
  Settings,
  QrCode,
  Thermometer
} from "lucide-react";
import CleaningHeatmap from "@/components/heatmap/CleaningHeatmap";

interface SitesProps {
  customerId: string;
}

export default function Sites({ customerId }: SitesProps) {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateZoneDialogOpen, setIsCreateZoneDialogOpen] = useState(false);
  const [isEditZoneDialogOpen, setIsEditZoneDialogOpen] = useState(false);
  const [isEditSiteDialogOpen, setIsEditSiteDialogOpen] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [editingZone, setEditingZone] = useState<any>(null);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneAreaM2, setZoneAreaM2] = useState("");
  const [zoneCapacity, setZoneCapacity] = useState("");
  const [zoneCategory, setZoneCategory] = useState("");
  const [editZoneAreaM2, setEditZoneAreaM2] = useState("");
  const [editZoneName, setEditZoneName] = useState("");
  const [editZoneDescription, setEditZoneDescription] = useState("");
  const [editZoneCapacity, setEditZoneCapacity] = useState("");
  const [editZoneCategory, setEditZoneCategory] = useState("");
  const [editSiteName, setEditSiteName] = useState("");
  const [editSiteAddress, setEditSiteAddress] = useState("");
  const [editSiteDescription, setEditSiteDescription] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sites, isLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "sites", { module: currentModule }],
    enabled: !!customerId,
  });

  // Buscar dados do cliente para obter companyId
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  const { data: zones } = useQuery({
    queryKey: ["/api/sites", selectedSiteId, "zones", { module: currentModule }],
    enabled: !!selectedSiteId,
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/customers/${customerId}/sites`, { ...data, customerId });
    },
    onSuccess: () => {
      toast({ title: "Local criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "sites"] });
      setIsCreateDialogOpen(false);
      setSiteName("");
      setSiteAddress("");
      setSiteDescription("");
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar local", 
        variant: "destructive" 
      });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/zones", data);
    },
    onSuccess: () => {
      toast({ title: "Zona criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
      setIsCreateZoneDialogOpen(false);
      setZoneName("");
      setZoneDescription("");
      setZoneAreaM2("");
      setZoneCapacity("");
      setZoneCategory("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar zona", 
        description: error.message || "Erro desconhecido",
        variant: "destructive" 
      });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", `/api/zones/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Zona atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "dashboard-stats"] });
      setIsEditZoneDialogOpen(false);
      setEditingZone(null);
      setEditZoneName("");
      setEditZoneDescription("");
      setEditZoneAreaM2("");
      setEditZoneCapacity("");
      setEditZoneCategory("");
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar zona", 
        variant: "destructive" 
      });
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/sites/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Local atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "sites"] });
      setIsEditSiteDialogOpen(false);
      setEditingSite(null);
      setEditSiteName("");
      setEditSiteAddress("");
      setEditSiteDescription("");
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar local", 
        variant: "destructive" 
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Local excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "sites"] });
      setSelectedSiteId("");
    },
    onError: () => {
      toast({ 
        title: "Erro ao excluir local", 
        variant: "destructive" 
      });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/zones/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Zona excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", selectedSiteId, "zones"] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao excluir zona", 
        variant: "destructive" 
      });
    },
  });

  const handleCreateSite = () => {
    if (!siteName.trim()) {
      toast({ 
        title: "Erro de validação",
        description: "Nome do local é obrigatório", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!siteAddress.trim()) {
      toast({ 
        title: "Erro de validação",
        description: "Endereço é obrigatório para identificação do local", 
        variant: "destructive" 
      });
      return;
    }

    if (!customer || !(customer as any).companyId) {
      toast({ 
        title: "Erro",
        description: "Dados do cliente não carregados. Tente novamente.", 
        variant: "destructive" 
      });
      return;
    }

    createSiteMutation.mutate({
      companyId: (customer as any).companyId,
      customerId,
      module: currentModule,
      name: siteName.trim(),
      address: siteAddress.trim(),
      description: siteDescription.trim() || null,
    });
  };

  const handleCreateZone = () => {
    if (!zoneName.trim() || !selectedSiteId) {
      toast({ 
        title: "Nome da zona é obrigatório", 
        variant: "destructive" 
      });
      return;
    }

    // Generate random initial position for floor plan
    const randomX = Math.random() * 60 + 20; // 20-80% range  
    const randomY = Math.random() * 60 + 20; // 20-80% range

    const dataToSend = {
      siteId: selectedSiteId,
      module: currentModule,
      name: zoneName.trim(),
      description: zoneDescription?.trim() || null,
      areaM2: zoneAreaM2 ? zoneAreaM2 : null,
      capacity: zoneCapacity ? parseInt(zoneCapacity) : null,
      category: zoneCategory || null,
      // Auto-generate floor plan positioning
      positionX: randomX.toFixed(2),
      positionY: randomY.toFixed(2),
      sizeScale: "1.00",
    };
    
    createZoneMutation.mutate(dataToSend);
  };

  const handleEditZone = (zone: any) => {
    setEditingZone(zone);
    setEditZoneName(zone.name || "");
    setEditZoneDescription(zone.description || "");
    setEditZoneAreaM2(zone.areaM2 || "");
    setEditZoneCapacity(zone.capacity || "");
    setEditZoneCategory(zone.category || "");
    setIsEditZoneDialogOpen(true);
  };

  const handleUpdateZone = () => {
    if (!editingZone || !editZoneName.trim()) {
      toast({ 
        title: "Nome é obrigatório", 
        variant: "destructive" 
      });
      return;
    }

    updateZoneMutation.mutate({
      id: editingZone.id,
      name: editZoneName.trim(),
      description: editZoneDescription.trim() || null,
      areaM2: editZoneAreaM2 ? editZoneAreaM2 : null,
      capacity: editZoneCapacity ? parseInt(editZoneCapacity) : null,
      category: editZoneCategory || null,
    });
  };

  const handleEditSite = (site: any) => {
    setEditingSite(site);
    setEditSiteName(site.name);
    setEditSiteAddress(site.address || "");
    setEditSiteDescription(site.description || "");
    setIsEditSiteDialogOpen(true);
  };

  const handleUpdateSite = () => {
    if (!editingSite || !editSiteName.trim()) {
      toast({ 
        title: "Nome do local é obrigatório", 
        variant: "destructive" 
      });
      return;
    }

    updateSiteMutation.mutate({
      id: editingSite.id,
      name: editSiteName,
      address: editSiteAddress,
      description: editSiteDescription,
    });
  };

  const handleDeleteSite = (site: any) => {
    if (confirm(`Tem certeza que deseja excluir o local "${site.name}"?`)) {
      deleteSiteMutation.mutate(site.id);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "banheiro":
        return <Badge className="bg-blue-100 text-blue-800">Banheiro</Badge>;
      case "escritorio":
        return <Badge className="bg-green-100 text-green-800">Escritório</Badge>;
      case "producao":
        return <Badge className="bg-orange-100 text-orange-800">Produção</Badge>;
      case "externo":
        return <Badge className="bg-purple-100 text-purple-800">Externo</Badge>;
      case "jardim":
        return <Badge className="bg-emerald-100 text-emerald-800">Jardim</Badge>;
      default:
        return <Badge variant="outline">{category || "Sem categoria"}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div>Carregando locais...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Locais e Zonas</h2>
          <p className="text-muted-foreground">Gerenciamento de locais da empresa e suas zonas</p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className={theme.buttons.primary} style={theme.buttons.primaryStyle} data-testid="button-create-site">
                <Plus className="w-4 h-4 mr-2" />
                Novo Local
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Criar Novo Local
                </DialogTitle>
                <DialogDescription>
                  Adicione um novo local de trabalho com todas as informações necessárias para gestão de facilities
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome do Local *
                    </label>
                    <Input
                      placeholder="Ex: Fábrica Principal"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      data-testid="input-site-name"
                      className="border-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Nome identificador único do local</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Endereço Completo *
                  </label>
                  <Input
                    placeholder="Rua, número, bairro, cidade - CEP"
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    data-testid="input-site-address"
                    className="border-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Endereço completo para localização e entregas</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Descrição e Observações
                  </label>
                  <Textarea
                    placeholder="Detalhes sobre o local: horário de funcionamento, responsável, características especiais..."
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    data-testid="textarea-site-description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-site"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="default"
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                    onClick={handleCreateSite}
                    disabled={createSiteMutation.isPending}
                    data-testid="button-save-site"
                  >
                    {createSiteMutation.isPending ? "Criando..." : "Criar Local"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Sites List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Locais da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {!sites || (sites as any[]).length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum local cadastrado</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crie seu primeiro local para começar
                </p>
                <Button 
                  className={`mt-4 ${theme.buttons.primary}`}
                  style={theme.buttons.primaryStyle}
                  onClick={() => setIsCreateDialogOpen(true)}
                  data-testid="button-create-first-site"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Local
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(sites as any[]).map((site: any) => (
                  <div 
                    key={site.id} 
                    className={`border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                      selectedSiteId === site.id ? "bg-muted/50 border-primary" : ""
                    }`}
                    onClick={() => setSelectedSiteId(site.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Building className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold text-foreground">
                            {site.name}
                          </h3>
                          {site.isActive ? (
                            <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </div>
                        
                        {site.address && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                            <MapPin className="w-4 h-4" />
                            <span>{site.address}</span>
                          </div>
                        )}
                        
                        {site.description && (
                          <p className="text-sm text-muted-foreground">{site.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 md:h-9 md:w-9"
                          data-testid={`button-view-site-${site.id}`}
                        >
                          <Eye className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 md:h-9 md:w-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSite(site);
                          }}
                          data-testid={`button-edit-site-${site.id}`}
                        >
                          <Edit className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 md:h-9 md:w-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSite(site);
                          }}
                          data-testid={`button-delete-site-${site.id}`}
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zones List for Selected Site */}
        {selectedSiteId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Zonas do Local: {(sites as any[])?.find((s: any) => s.id === selectedSiteId)?.name}
                </CardTitle>
                <Dialog open={isCreateZoneDialogOpen} onOpenChange={setIsCreateZoneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className={theme.buttons.primary} style={theme.buttons.primaryStyle} size="sm" data-testid="button-create-zone">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Zona
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Zona</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Nome da Zona *
                        </label>
                        <Input
                          placeholder="Ex: Banheiro Administrativo"
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          data-testid="input-zone-name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Categoria
                        </label>
                        <select 
                          className="w-full p-2 border border-input rounded-md bg-background text-foreground"
                          value={zoneCategory}
                          onChange={(e) => setZoneCategory(e.target.value)}
                          data-testid="select-zone-category"
                        >
                          <option value="">Selecione uma categoria</option>
                          <option value="banheiro">Banheiro</option>
                          <option value="escritorio">Escritório</option>
                          <option value="producao">Produção</option>
                          <option value="externo">Externo</option>
                          <option value="jardim">Jardim</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Área (m²)
                          </label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={zoneAreaM2}
                            onChange={(e) => setZoneAreaM2(e.target.value)}
                            data-testid="input-zone-area"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Capacidade
                          </label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={zoneCapacity}
                            onChange={(e) => setZoneCapacity(e.target.value)}
                            data-testid="input-zone-capacity"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Descrição
                        </label>
                        <Textarea
                          placeholder="Descrição opcional do local"
                          value={zoneDescription}
                          onChange={(e) => setZoneDescription(e.target.value)}
                          data-testid="textarea-zone-description"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsCreateZoneDialogOpen(false)}
                          data-testid="button-cancel-zone"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          variant="default"
                          className={theme.buttons.primary}
                          style={theme.buttons.primaryStyle}
                          onClick={handleCreateZone}
                          disabled={createZoneMutation.isPending}
                          data-testid="button-save-zone"
                        >
                          {createZoneMutation.isPending ? "Criando..." : "Criar Zona"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {!zones || (zones as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma zona cadastrada neste local</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crie a primeira zona para este local
                  </p>
                  <Button 
                    className={`mt-4 ${theme.buttons.primary}`}
                    style={theme.buttons.primaryStyle}
                    onClick={() => setIsCreateZoneDialogOpen(true)}
                    data-testid="button-create-first-zone"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeira Zona
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Área (m²)</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(zones as any[])?.map((zone: any) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">{zone.name}</TableCell>
                        <TableCell>{getCategoryBadge(zone.category)}</TableCell>
                        <TableCell>{zone.areaM2 ? `${zone.areaM2} m²` : "N/A"}</TableCell>
                        <TableCell>{zone.capacity || "N/A"}</TableCell>
                        <TableCell>
                          {zone.isActive ? (
                            <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditZone(zone)}
                              data-testid={`button-edit-zone-${zone.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a zona "${zone.name}"?`)) {
                                  deleteZoneMutation.mutate(zone.id);
                                }
                              }}
                              data-testid={`button-delete-zone-${zone.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
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
        )}


        {/* Edit Site Modal */}
        <Dialog open={isEditSiteDialogOpen} onOpenChange={setIsEditSiteDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Local - {editingSite?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome do Local *
                </label>
                <Input
                  placeholder="Ex: Fábrica Principal"
                  value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  data-testid="input-edit-site-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Endereço
                </label>
                <Input
                  placeholder="Ex: Av. Industrial, 500"
                  value={editSiteAddress}
                  onChange={(e) => setEditSiteAddress(e.target.value)}
                  data-testid="input-edit-site-address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descrição
                </label>
                <Textarea
                  placeholder="Descrição opcional do local"
                  value={editSiteDescription}
                  onChange={(e) => setEditSiteDescription(e.target.value)}
                  data-testid="textarea-edit-site-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditSiteDialogOpen(false)}
                  data-testid="button-cancel-edit-site"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="default"
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  onClick={handleUpdateSite}
                  disabled={updateSiteMutation.isPending}
                  data-testid="button-save-edit-site"
                >
                  {updateSiteMutation.isPending ? "Salvando..." : "Salvar Local"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Zone Modal */}
        <Dialog open={isEditZoneDialogOpen} onOpenChange={setIsEditZoneDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Zona - {editingZone?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da Zona *
                </label>
                <Input
                  placeholder="Ex: Banheiro 1"
                  value={editZoneName}
                  onChange={(e) => setEditZoneName(e.target.value)}
                  data-testid="input-edit-zone-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Categoria
                </label>
                <Select value={editZoneCategory} onValueChange={setEditZoneCategory}>
                  <SelectTrigger data-testid="select-edit-zone-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banheiro">🚻 Banheiro</SelectItem>
                    <SelectItem value="escritorio">🏢 Escritório</SelectItem>
                    <SelectItem value="producao">🏭 Produção</SelectItem>
                    <SelectItem value="externo">🌿 Externo</SelectItem>
                    <SelectItem value="jardim">🌱 Jardim</SelectItem>
                    <SelectItem value="outro">📦 Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Área (m²)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editZoneAreaM2}
                    onChange={(e) => setEditZoneAreaM2(e.target.value)}
                    data-testid="input-edit-zone-area"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Capacidade
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={editZoneCapacity}
                    onChange={(e) => setEditZoneCapacity(e.target.value)}
                    data-testid="input-edit-zone-capacity"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Descrição
                </label>
                <Textarea
                  placeholder="Descrição opcional do local"
                  value={editZoneDescription}
                  onChange={(e) => setEditZoneDescription(e.target.value)}
                  data-testid="textarea-edit-zone-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditZoneDialogOpen(false)}
                  data-testid="button-cancel-edit-zone"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="default"
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  onClick={handleUpdateZone}
                  disabled={updateZoneMutation.isPending}
                  data-testid="button-save-edit-zone"
                >
                  {updateZoneMutation.isPending ? "Salvando..." : "Salvar Zona"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
