import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Mail, Phone, Shield, Plus } from "lucide-react";

interface UsersMobileProps {
  customerId: string;
}

export default function UsersMobile({ customerId }: UsersMobileProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "users"],
    enabled: !!customerId,
  });

  const filteredUsers = (users as any[])?.filter((user: any) => {
    return user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           user.email?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  const getRoleBadge = (role: string, id?: string) => {
    const testId = id ? `badge-role-${role}-${id}` : `badge-role-${role}`;
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500 text-white text-xs" data-testid={testId}>Admin</Badge>;
      case "gestor_cliente":
        return <Badge className="bg-blue-500 text-white text-xs" data-testid={testId}>Gestor</Badge>;
      case "supervisor_site":
        return <Badge className="bg-indigo-500 text-white text-xs" data-testid={testId}>Supervisor</Badge>;
      case "operador":
        return <Badge className="bg-green-500 text-white text-xs" data-testid={testId}>Operador</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white text-xs" data-testid={testId}>{role}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-4 space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Usuários</h2>
          <Button size="sm" className="bg-blue-600" data-testid="button-new-user" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Novo
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0" data-testid="card-stats-admins">
          <CardContent className="p-3 text-center">
            <Shield className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-admins">
              {(users as any[])?.filter((u: any) => u.role === 'admin').length || 0}
            </p>
            <p className="text-xs text-white/80">Admins</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0" data-testid="card-stats-gestores">
          <CardContent className="p-3 text-center">
            <User className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-gestores">
              {(users as any[])?.filter((u: any) => u.role === 'gestor_cliente').length || 0}
            </p>
            <p className="text-xs text-white/80">Gestores</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0" data-testid="card-stats-operadores">
          <CardContent className="p-3 text-center">
            <User className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-operadores">
              {(users as any[])?.filter((u: any) => u.role === 'operador').length || 0}
            </p>
            <p className="text-xs text-white/80">Operadores</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-600">{filteredUsers.length} usuários</p>
        </div>
        
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Nenhum usuário encontrado
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user: any) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow" data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900" data-testid={`text-user-name-${user.id}`}>
                        {user.name}
                      </p>
                      {getRoleBadge(user.role, user.id)}
                    </div>
                  </div>
                  {user.isActive ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs" data-testid={`badge-status-active-${user.id}`}>Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs" data-testid={`badge-status-inactive-${user.id}`}>Inativo</Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span data-testid={`text-user-phone-${user.id}`}>{user.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
