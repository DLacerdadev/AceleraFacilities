import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, QrCode, MapPin, Plus, Eye, Download } from "lucide-react";

interface QRCodesMobileProps {
  customerId: string;
}

export default function QRCodesMobile({ customerId }: QRCodesMobileProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");

  const { data: qrCodes, isLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "qr-points"],
    enabled: !!customerId,
  });

  const filteredQRCodes = (qrCodes as any[])?.filter((qr: any) => {
    const matchesType = typeFilter === "todos" || qr.type === typeFilter;
    const matchesSearch = qr.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         qr.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  }) || [];

  const totalExecucao = (qrCodes as any[])?.filter((qr: any) => qr.type === 'execucao').length || 0;
  const totalAtendimento = (qrCodes as any[])?.filter((qr: any) => qr.type === 'atendimento').length || 0;

  const getTypeBadge = (type: string, id?: string) => {
    const testId = id ? `badge-type-${type}-${id}` : `badge-type-${type}`;
    switch (type) {
      case "execucao":
        return <Badge className="bg-blue-500 text-white text-xs" data-testid={testId}>Execução</Badge>;
      case "atendimento":
        return <Badge className="bg-green-500 text-white text-xs" data-testid={testId}>Atendimento</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white text-xs" data-testid={testId}>{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
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
          <h2 className="text-lg font-semibold">QR Codes</h2>
          <Button size="sm" className="bg-blue-600" data-testid="button-new-qrcode" disabled>
            <Plus className="w-4 h-4 mr-2" />
            Novo
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar QR Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-qrcodes"
          />
        </div>

        {/* Filtro */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full" data-testid="select-type-filter">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" data-testid="select-item-type-todos">Todos</SelectItem>
            <SelectItem value="execucao" data-testid="select-item-type-execucao">Execução</SelectItem>
            <SelectItem value="atendimento" data-testid="select-item-type-atendimento">Atendimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg" data-testid="card-stats-execucao">
          <CardContent className="p-4 text-center">
            <QrCode className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-2xl font-bold text-white" data-testid="text-count-execucao">{totalExecucao}</p>
            <p className="text-xs text-white/80">Execução</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg" data-testid="card-stats-atendimento">
          <CardContent className="p-4 text-center">
            <QrCode className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-2xl font-bold text-white" data-testid="text-count-atendimento">{totalAtendimento}</p>
            <p className="text-xs text-white/80">Atendimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600 mb-3">{filteredQRCodes.length} QR Codes</p>
        
        {filteredQRCodes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Nenhum QR Code encontrado
            </CardContent>
          </Card>
        ) : (
          filteredQRCodes.map((qr: any) => (
            <Card key={qr.id} className="hover:shadow-md transition-shadow" data-testid={`card-qrcode-${qr.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <QrCode className="w-5 h-5 text-blue-600" />
                        <p className="font-semibold text-gray-900" data-testid={`text-qrcode-name-${qr.id}`}>
                          {qr.name || 'Sem nome'}
                        </p>
                      </div>
                      {getTypeBadge(qr.type, qr.id)}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-view-qrcode-${qr.id}`} disabled>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-download-qrcode-${qr.id}`} disabled>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Detalhes */}
                  {qr.description && (
                    <p className="text-sm text-gray-600" data-testid={`text-qrcode-description-${qr.id}`}>
                      {qr.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span data-testid={`text-qrcode-zone-${qr.id}`}>{qr.zoneName || 'Local não especificado'}</span>
                  </div>

                  {qr.isActive ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200" data-testid={`badge-status-active-${qr.id}`}>Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200" data-testid={`badge-status-inactive-${qr.id}`}>Inativo</Badge>
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
