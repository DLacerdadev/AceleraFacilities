import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import { 
  MessageCircle, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  MapPin,
  Send,
  Shield,
  Clock
} from "lucide-react";

export default function QrPublic() {
  const { code } = useParams<{ code: string }>();
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [workOrderNumber, setWorkOrderNumber] = useState<number | null>(null);
  const { toast } = useToast();

  const createServiceRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/qr-public/${code}/service-request`, data);
    },
    onSuccess: (response) => {
      setIsSubmitted(true);
      setWorkOrderNumber(response.workOrderNumber);
      toast({ title: "Solicitação enviada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar solicitação", 
        description: error.message || "Tente novamente em alguns instantes",
        variant: "destructive" 
      });
    },
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhoto(file);
    }
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ 
        title: "Descrição obrigatória", 
        description: "Por favor, descreva o problema ou necessidade",
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    
    // In a real implementation, you would upload the photo first
    const photoUrl = photo ? URL.createObjectURL(photo) : undefined;
    
    createServiceRequestMutation.mutate({
      description: description.trim(),
      photo: photoUrl
    });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto pt-16">
          <Card className="border-chart-2/20 bg-chart-2/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-16 h-16 text-chart-2 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Solicitação Enviada!
              </h1>
              <p className="text-muted-foreground mb-4">
                Sua solicitação foi recebida e será atendida em breve.
              </p>
              
              {workOrderNumber && (
                <div className="bg-background rounded-lg p-4 mb-4">
                  <p className="text-sm text-muted-foreground">Número do protocolo:</p>
                  <p className="text-xl font-bold text-foreground">#{workOrderNumber}</p>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>✓ Equipe será notificada automaticamente</p>
                <p>✓ Atendimento em até 2 horas</p>
                <p>✓ Acompanhe pelo WhatsApp se disponível</p>
              </div>
            </CardContent>
          </Card>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold">OPUS CLEAN</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto text-center">
          <div className="w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold mb-1">Solicitar Atendimento</h1>
          <p className="text-sm opacity-90">
            Reporte problemas ou solicite limpeza
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 -mt-4">
        {/* Location Card */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-primary mt-1" />
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">Local Identificado</h2>
                <p className="text-sm text-muted-foreground">
                  {/* This would be populated from the QR code data */}
                  Código: {code}
                </p>
                <Badge variant="outline" className="mt-2">
                  QR Atendimento Público
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Descreva sua Solicitação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                O que você observou? *
              </label>
              <Textarea
                placeholder="Ex: Banheiro sem papel higiênico, lixeira cheia, piso molhado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={500}
                data-testid="textarea-description"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {description.length}/500 caracteres
              </p>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Foto (opcional)
              </label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {photo ? photo.name : "Toque para adicionar uma foto"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo 5MB
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Priority Info */}
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <Clock className="w-4 h-4 text-chart-4 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Tempo de Atendimento</p>
                  <p className="text-muted-foreground">
                    Solicitações são atendidas em até 2 horas durante o horário comercial.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting || createServiceRequestMutation.isPending}
              className="w-full h-12"
              data-testid="button-submit-request"
            >
              {isSubmitting || createServiceRequestMutation.isPending ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Solicitação
                </>
              )}
            </Button>

            {/* Security Notice */}
            <div className="flex items-start space-x-2 p-3 bg-muted/20 rounded-lg">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">Privacidade e Segurança</p>
                <p>
                  Suas informações são tratadas com confidencialidade e utilizadas 
                  apenas para o atendimento da solicitação.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">OPUS CLEAN</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sistema de Gestão de Facilities
          </p>
        </div>
      </div>
    </div>
  );
}
