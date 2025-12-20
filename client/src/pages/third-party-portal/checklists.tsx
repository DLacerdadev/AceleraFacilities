import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo' | 'checkbox';
  label: string;
  required?: boolean;
  description?: string;
}

interface Checklist {
  id: string;
  name: string;
  description?: string;
  module: 'maintenance' | 'clean';
  items: ChecklistItem[];
  isActive: boolean;
  createdAt?: string;
}

export default function ThirdPartyChecklists() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({ name: '', description: '', module: 'maintenance' as const });
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState({ type: 'text' as const, label: '', description: '' });

  // Queries
  const { data: modules } = useQuery<{ allowedModules: string[] }>({
    queryKey: ['/api/third-party-portal/my-modules'],
  });

  const { data: checklists = [], refetch } = useQuery<Checklist[]>({
    queryKey: ['/api/third-party-portal/checklists'],
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
    setNewItem({ type: 'text', label: '', description: '' });
    setCreateOpen(false);
    setEditOpen(false);
    setEditingId(null);
  };

  const addItem = () => {
    if (!newItem.label.trim()) return;
    setItems([...items, { ...newItem, id: `item-${Date.now()}`, label: newItem.label.trim() }]);
    setNewItem({ type: 'text', label: '', description: '' });
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
          <p className="text-muted-foreground text-center text-sm mt-2">
            Sua empresa não possui permissão para criar checklists.
          </p>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              {/* Item Form */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Adicionar Item</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-sm">Tipo</Label>
                      <Select value={newItem.type} onValueChange={(value) => setNewItem({ ...newItem, type: value as any })}>
                        <SelectTrigger className="h-9">
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
                    <div>
                      <Label className="text-sm">Rótulo *</Label>
                      <Input
                        className="h-9"
                        placeholder="Ex: Pressão"
                        value={newItem.label}
                        onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Descrição</Label>
                      <Input
                        className="h-9"
                        placeholder="Opcional..."
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                    <Plus className="w-3 h-3 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </Card>

              {/* Items List */}
              <div>
                <Label>Itens ({items.length})</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                      <Badge variant="outline">{item.type}</Badge>
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
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </div>
                    <Badge variant="outline">{item.type}</Badge>
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
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{checklist.name}</CardTitle>
                      {checklist.description && <p className="text-xs text-muted-foreground mt-1">{checklist.description}</p>}
                    </div>
                    <Badge>{checklist.module === 'maintenance' ? 'Manutenção' : 'Limpeza'}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{checklist.items?.length || 0} itens</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(checklist)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(checklist.id)}
                      disabled={deleteMutation.isPending}
                    >
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
