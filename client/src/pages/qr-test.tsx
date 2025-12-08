import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";

const COMPANY_ID = "company-opus-default";

export default function QrTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const testQrCode = async () => {
    if (!qrCode.trim()) {
      toast({
        title: "Erro",
        description: "Digite um código QR para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`/api/qr-scan/resolve?code=${encodeURIComponent(qrCode.trim())}&companyId=${COMPANY_ID}`);
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast({
          title: "✅ QR Code encontrado!",
          description: `${data.zone.name} - ${data.site.name}`,
        });
      } else {
        const errorData = await response.text();
        setError(`${response.status}: ${errorData}`);
        toast({
          title: "❌ QR Code não encontrado",
          description: `Status: ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (err) {
      setError(`Erro de rede: ${err}`);
      toast({
        title: "❌ Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addPhysicalCodes = async () => {
    setIsAddingCodes(true);
    let successCount = 0;
    let errorCount = 0;

    for (const codeData of physicalCodesToAdd) {
      try {
        const response = await fetch('/api/qr-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...codeData,
            companyId: COMPANY_ID,
            type: 'execution',
            isActive: true
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          console.log(`Erro ao adicionar ${codeData.code}:`, await response.text());
        }
      } catch (error) {
        errorCount++;
        console.log(`Erro de rede ao adicionar ${codeData.code}:`, error);
      }
    }

    setIsAddingCodes(false);
    toast({
      title: successCount > 0 ? "✅ QR Codes adicionados!" : "❌ Erro ao adicionar códigos",
      description: `${successCount} códigos adicionados, ${errorCount} erros`,
      variant: errorCount > successCount ? "destructive" : "default",
    });
  };

  const [isAddingCodes, setIsAddingCodes] = useState(false);

  const predefinedCodes = [
    { name: "QR Teste Simples", code: "TESTE123" },
    { name: "QR ABC", code: "ABC" },
    { name: "QR Numérico", code: "12345" },
    { name: "QR Execução", code: "95724a42-d74e-4c8e-ad3e-ba2cf4c8c2c9" },
    { name: "QR Atendimento", code: "qqq" },
    // Códigos físicos comuns
    { name: "QR Físico Principal", code: "PHYSICAL001" },
    { name: "Banheiro 001", code: "BATH001" },
    { name: "Banheiro 002", code: "BATH002" },
    { name: "Escritório 001", code: "OFFICE001" },
    { name: "Limpeza 001", code: "CLEAN001" },
    { name: "Código 00001", code: "00001" },
    { name: "Código 00002", code: "00002" },
    { name: "Área A001", code: "A001" },
    { name: "Área B001", code: "B001" },
    { name: "Sala 001", code: "SALA001" },
    { name: "QR Point 001", code: "QR001" },
    { name: "QR Point 002", code: "QR002" },
    { name: "Local 001", code: "LOC001" },
    { name: "Zona 001", code: "ZONE001" },
  ];

  const physicalCodesToAdd = [
    { code: "PHYSICAL001", name: "QR Físico - Banheiro Principal", zoneId: "zone-3" },
    { code: "BATH001", name: "Banheiro 001", zoneId: "zone-3" },
    { code: "BATH002", name: "Banheiro 002", zoneId: "zone-3" },
    { code: "OFFICE001", name: "Escritório 001", zoneId: "zone-3" },
    { code: "CLEAN001", name: "Limpeza 001", zoneId: "zone-3" },
    { code: "00001", name: "Código Numérico 00001", zoneId: "zone-3" },
    { code: "00002", name: "Código Numérico 00002", zoneId: "zone-3" },
    { code: "A001", name: "Área A001", zoneId: "zone-3" },
    { code: "B001", name: "Área B001", zoneId: "zone-3" },
    { code: "SALA001", name: "Sala 001", zoneId: "zone-3" },
    { code: "QR001", name: "QR Point 001", zoneId: "zone-3" },
    { code: "QR002", name: "QR Point 002", zoneId: "zone-3" },
    { code: "LOC001", name: "Local 001", zoneId: "zone-3" },
    { code: "ZONE001", name: "Zona 001", zoneId: "zone-3" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/mobile")}
            className="p-2"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold">Teste QR Code</h1>
          <div></div>
        </div>

        {/* Manual Test */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Teste Manual de QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Digite o código QR aqui"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && testQrCode()}
              />
              <Button onClick={testQrCode} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Testando..." : "Testar"}
              </Button>
            </div>

            {/* Add Physical Codes Button */}
            <div className="flex justify-center py-4">
              <Button 
                onClick={addPhysicalCodes} 
                disabled={isAddingCodes}
                variant="outline"
                className="w-full"
              >
                {isAddingCodes ? "Adicionando códigos..." : "📱 Adicionar QR Codes Físicos Comuns"}
              </Button>
            </div>

            {/* Predefined QR Codes */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">QR Codes no sistema ({predefinedCodes.length} códigos):</p>
              {predefinedCodes.map((item) => (
                <div key={item.code} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.code}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setQrCode(item.code)}
                  >
                    Usar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <p className="font-medium">Erro:</p>
              </div>
              <p className="text-sm text-red-600 mt-1 font-mono">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-green-600 mb-4">
                <CheckCircle className="w-5 h-5" />
                <p className="font-medium">QR Code encontrado com sucesso!</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="font-medium">QR Point:</p>
                  <p className="text-sm">Nome: {result.qrPoint.name}</p>
                  <p className="text-sm">Tipo: {result.qrPoint.type}</p>
                  <p className="text-sm">Código: {result.qrPoint.code}</p>
                </div>
                
                <div>
                  <p className="font-medium">Localização:</p>
                  <p className="text-sm">Zona: {result.zone.name}</p>
                  <p className="text-sm">Local: {result.site.name}</p>
                  <p className="text-sm">Empresa: {result.company.name}</p>
                </div>
                
                <div>
                  <p className="font-medium">Serviços disponíveis: {result.services.length}</p>
                  <div className="max-h-32 overflow-y-auto">
                    {result.services.slice(0, 3).map((service: any) => (
                      <p key={service.id} className="text-xs text-muted-foreground">
                        • {service.name}
                      </p>
                    ))}
                    {result.services.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        ... e mais {result.services.length - 3} serviços
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Instruções para Teste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>1. <strong>📱 Primeiro:</strong> Clique em "Adicionar QR Codes Físicos Comuns" para registrar códigos típicos</p>
              <p>2. <strong>🔍 Teste Manual:</strong> Digite o código do seu QR físico na caixa de texto acima</p>
              <p>3. <strong>📱 Scanner:</strong> Se funcionar aqui, funcionará no scanner mobile</p>
              <p>4. <strong>✅ Códigos Disponíveis:</strong> Temos {predefinedCodes.length} códigos cadastrados (veja a lista acima)</p>
              <p>5. <strong>🎯 Dica:</strong> Se seu QR físico não funcionar, ele precisa conter exatamente um dos códigos cadastrados</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}