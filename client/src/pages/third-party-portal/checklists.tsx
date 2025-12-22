import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, Type, Hash, Camera, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo' | 'checkbox';
  label: string;
  required?: boolean;
  description?: string;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    photoMinCount?: number;
    photoMaxCount?: number;
    photoRequired?: boolean;
    minChecked?: number;
  };
}

interface Checklist {
  id: string;
  name: string;
  description?: string;
  module: 'maintenance' | 'clean';
  items: ChecklistItem[];
  isActive: boolean;
}

const getTypeLabel = (type: string) => ({
  'text': 'Texto',
  'number': 'Número',
  'photo': 'Foto',
  'checkbox': 'Checkbox'
}[type] || type);

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'text': return <Type className="w-4 h-4" />;
    case 'number': return <Hash className="w-4 h-4" />;
    case 'photo': return <Camera className="w-4 h-4" />;
    case 'checkbox': return <CheckSquare className="w-4 h-4" />;
    default: return null;
  }
};

export default function ThirdPartyChecklists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', description: '', module: 'maintenance' as const });
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState<Partial<ChecklistItem>>({
    type: 'text',
    label: '',
    description: '',
    required: false,
    options: [],
    validation: {}
  });

  // Queries
  const { data: modules } = useQuery<{ allowedModules: string[] }>({
    queryKey: ['/api/third-party-portal/my-modules', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: checklists = [], refetch } = useQuery<Checklist[]>({
    queryKey: ['/api/third-party-portal/checklists', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/third-party-portal/checklists', data),
    onSuccess: () => {
      toast({ title: 'Checklist criado com sucesso' });
      resetForm();
      refetch();
    },
    onError: (err: any) => toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest('PATCH', `/api/third-party-portal/checklists/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Checklist atualizado com sucesso' });
      resetForm();
      refetch();
    },
    onError: (err: any) => toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/third-party-portal/checklists/${id}`),
    onSuccess: () => {
      toast({ title: 'Checklist excluído com sucesso' });
      refetch();
    },
    onError: (err: any) => toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', module: 'maintenance' });
    setItems([]);
    setNewItem({ type: 'text', label: '', description: '', required: false, options: [], validation: {} });
    setCreateOpen(false);
    setEditOpen(false);
    setEditingId(null);
  };

  const addItem = () => {
    if (!newItem.label?.trim()) return;
    const item: ChecklistItem = {
      id: `item-${Date.now()}`,
      type: (newItem.type || 'text') as any,
      label: newItem.label.trim(),
      description: newItem.description,
      required: newItem.required,
      options: newItem.options,
      validation: newItem.validation,
    };
    setItems([...items, item]);
    setNewItem({ type: 'text', label: '', description: '', required: false, options: [], validation: {} });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleCreate = () => {
    if (!formData.name.trim() || items.length === 0) {
      toast({ title: 'Nome e itens são obrigatórios', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ ...formData, items });
  };

  const handleEdit = (checklist: Checklist) => {
    setEditingId(checklist.id);
    setFormData({ name: checklist.name, description: checklist.description || '', module: checklist.module });
    setItems(checklist.items);
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!formData.name.trim() || items.length === 0) {
      toast({ title: 'Nome e itens são obrigatórios', variant: 'destructive' });
      return;
    }
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, data: { ...formData, items } });
  };

  const hasAccess = modules?.allowedModules?.length > 0;

  if (!hasAccess) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex flex-col items-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Sem Acesso</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-muted-foreground">Gerencie os checklists para suas propostas</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Checklist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Verificação de Equipamentos"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descrição opcional..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Módulo *</Label>
                <Select value={formData.module} onValueChange={(value) => setFormData({ ...formData, module: value as 'maintenance' | 'clean' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modules?.allowedModules?.includes('maintenance') && <SelectItem value="maintenance">Manutenção</SelectItem>}
                    {modules?.allowedModules?.includes('clean') && <SelectItem value="clean">Limpeza</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Adicionar Item */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Adicionar Item ao Checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={newItem.type} onValueChange={(value) => {
                        const updates: any = { type: value as any };
                        if (value === 'checkbox' && !newItem.options?.length) {
                          updates.options = [];
                        }
                        setNewItem({ ...newItem, ...updates });
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="photo">Foto</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rótulo *</Label>
                      <Input
                        placeholder="Ex: Verificar pressão"
                        value={newItem.label}
                        onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Observações</Label>
                      <Input
                        placeholder="Instruções opcionais..."
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Configurações avançadas */}
                  {newItem.type && (
                    <Card className="bg-slate-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Configurações - {getTypeLabel(newItem.type)}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Texto */}
                        {newItem.type === 'text' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Mínimo de caracteres</Label>
                              <Input
                                type="number"
                                placeholder="Ex: 10"
                                value={newItem.validation?.minLength || ""}
                                onChange={(e) => setNewItem(prev => ({
                                  ...prev,
                                  validation: { ...prev.validation, minLength: e.target.value ? parseInt(e.target.value) : undefined }
                                }))}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Máximo de caracteres</Label>
                              <Input
                                type="number"
                                placeholder="Ex: 500"
                                value={newItem.validation?.maxLength || ""}
                                onChange={(e) => setNewItem(prev => ({
                                  ...prev,
                                  validation: { ...prev.validation, maxLength: e.target.value ? parseInt(e.target.value) : undefined }
                                }))}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {/* Número */}
                        {newItem.type === 'number' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Valor mínimo</Label>
                              <Input
                                type="number"
                                placeholder="Ex: 0"
                                value={newItem.validation?.minValue || ""}
                                onChange={(e) => setNewItem(prev => ({
                                  ...prev,
                                  validation: { ...prev.validation, minValue: e.target.value ? parseInt(e.target.value) : undefined }
                                }))}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor máximo</Label>
                              <Input
                                type="number"
                                placeholder="Ex: 100"
                                value={newItem.validation?.maxValue || ""}
                                onChange={(e) => setNewItem(prev => ({
                                  ...prev,
                                  validation: { ...prev.validation, maxValue: e.target.value ? parseInt(e.target.value) : undefined }
                                }))}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {/* Foto */}
                        {newItem.type === 'photo' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Mínimo de fotos</Label>
                                <Input
                                  type="number"
                                  placeholder="Ex: 1"
                                  value={newItem.validation?.photoMinCount || ""}
                                  onChange={(e) => setNewItem(prev => ({
                                    ...prev,
                                    validation: { ...prev.validation, photoMinCount: e.target.value ? parseInt(e.target.value) : undefined }
                                  }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Máximo de fotos</Label>
                                <Input
                                  type="number"
                                  placeholder="Ex: 5"
                                  value={newItem.validation?.photoMaxCount || ""}
                                  onChange={(e) => setNewItem(prev => ({
                                    ...prev,
                                    validation: { ...prev.validation, photoMaxCount: e.target.value ? parseInt(e.target.value) : undefined }
                                  }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={newItem.validation?.photoRequired || false}
                                onCheckedChange={(checked) => setNewItem(prev => ({
                                  ...prev,
                                  validation: { ...prev.validation, photoRequired: checked }
                                }))}
                              />
                              <Label className="text-xs">Foto obrigatória</Label>
                            </div>
                          </div>
                        )}

                        {/* Checkbox */}
                        {newItem.type === 'checkbox' && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Opções do Checkbox</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNewItem(prev => ({
                                    ...prev,
                                    options: [...(prev.options || []), '']
                                  }));
                                }}
                                className="w-full h-9 text-xs mb-2"
                              >
                                <Plus className="w-3 h-3 mr-2" />
                                Adicionar Opção
                              </Button>
                              <div className="space-y-2">
                                {(newItem.options || []).map((option, index) => (
                                  <div key={index} className="flex gap-2">
                                    <Input
                                      value={option}
                                      onChange={(e) => {
                                        const newOptions = [...(newItem.options || [])];
                                        newOptions[index] = e.target.value;
                                        setNewItem(prev => ({ ...prev, options: newOptions }));
                                      }}
                                      className="h-8 text-xs flex-1"
                                      placeholder={`Opção ${index + 1}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newOptions = (newItem.options || []).filter((_, i) => i !== index);
                                        setNewItem(prev => ({ ...prev, options: newOptions }));
                                      }}
                                      className="h-8"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Mínimo de checks</Label>
                                <Input
                                  type="number"
                                  placeholder="Ex: 1"
                                  value={newItem.validation?.minChecked || ""}
                                  onChange={(e) => setNewItem(prev => ({
                                    ...prev,
                                    validation: { ...prev.validation, minChecked: e.target.value ? parseInt(e.target.value) : undefined }
                                  }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Máximo de checks</Label>
                                <Input
                                  type="number"
                                  placeholder="Ex: 3"
                                  value={newItem.validation?.maxChecked || ""}
                                  onChange={(e) => setNewItem(prev => ({
                                    ...prev,
                                    validation: { ...prev.validation, maxChecked: e.target.value ? parseInt(e.target.value) : undefined }
                                  }))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Campo obrigatório */}
                        <div className="flex items-center gap-2 pt-2">
                          <Switch
                            checked={newItem.required || false}
                            onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, required: checked }))}
                          />
                          <Label className="text-xs">Campo obrigatório</Label>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Button
                    type="button"
                    onClick={addItem}
                    disabled={!newItem.label?.trim()}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Item
                  </Button>
                </CardContent>
              </Card>

              {/* Items List */}
              <div>
                <Label>Itens ({items.length})</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-muted-foreground">{getTypeIcon(item.type)}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{item.label}</p>
                            <Badge variant="outline" className="text-xs">{getTypeLabel(item.type)}</Badge>
                            {item.required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                          </div>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Verificação de Equipamentos"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição opcional..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Items List */}
            <div>
              <Label>Itens ({items.length})</Label>
              <div className="space-y-2 mt-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-muted-foreground">{getTypeIcon(item.type)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.label}</p>
                          <Badge variant="outline" className="text-xs">{getTypeLabel(item.type)}</Badge>
                          {item.required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                        </div>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklists List */}
      <div>
        {!checklists || checklists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum checklist criado</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {checklists.map((checklist) => (
              <Card key={checklist.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">{checklist.name}</CardTitle>
                      {checklist.description && <p className="text-xs text-muted-foreground mt-1">{checklist.description}</p>}
                    </div>
                    <Badge>{checklist.module === 'maintenance' ? 'Manutenção' : 'Limpeza'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{checklist.items?.length || 0} itens</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(checklist)}>
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(checklist.id)} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
