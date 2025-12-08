import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, MapPin, Wrench, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Zone, Site, CleaningActivity } from "@shared/schema";

interface ManualSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationServiceSelect: (zoneId: string, serviceId: string) => void;
  companyId: string;
}

export default function ManualSelectionModal({
  isOpen,
  onClose,
  onLocationServiceSelect,
  companyId,
}: ManualSelectionModalProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Fetch sites for the company
  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: [`/api/companies/${companyId}/sites`],
    enabled: isOpen && !!companyId,
  });

  // Fetch zones for selected site
  const { data: zones = [], isLoading: zonesLoading } = useQuery<Zone[]>({
    queryKey: [`/api/sites/${selectedSiteId}/zones`],
    enabled: !!selectedSiteId,
  });

  // Fetch services for selected zone
  const { data: services = [], isLoading: servicesLoading } = useQuery<CleaningActivity[]>({
    queryKey: [`/api/companies/${companyId}/zones/${selectedZoneId}/services`],
    enabled: !!selectedZoneId && !!companyId,
  });

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedZoneId("");
    setSelectedServiceId("");
  };

  const handleZoneChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setSelectedServiceId("");
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };

  const handleConfirm = () => {
    if (selectedZoneId && selectedServiceId) {
      onLocationServiceSelect(selectedZoneId, selectedServiceId);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedSiteId("");
    setSelectedZoneId("");
    setSelectedServiceId("");
    onClose();
  };

  const canConfirm = selectedZoneId && selectedServiceId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md mx-auto bg-white rounded-xl shadow-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-navy-600 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Seleção Manual
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="p-1 h-8 w-8 text-gray-500 hover:text-gray-700"
              data-testid="button-close-manual-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>Selecione o local e serviço que você deseja executar.</span>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Site Selection */}
          <div className="space-y-2">
            <Label htmlFor="site-select" className="text-sm font-medium text-gray-700">
              1. Selecione o Local
            </Label>
            {sitesLoading ? (
              <div className="text-sm text-gray-500 p-3 text-center">Carregando locais...</div>
            ) : (
              <Select
                value={selectedSiteId}
                onValueChange={handleSiteChange}
                disabled={sites.length === 0}
              >
                <SelectTrigger 
                  id="site-select"
                  className="w-full"
                  data-testid="select-site"
                >
                  <SelectValue placeholder="Escolha um local..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Zone Selection */}
          <div className="space-y-2">
            <Label htmlFor="zone-select" className="text-sm font-medium text-gray-700">
              2. Selecione a Zona
            </Label>
            {!selectedSiteId ? (
              <div className="text-sm text-gray-400 p-3 text-center bg-gray-50 rounded-md">
                Primeiro selecione um local
              </div>
            ) : zonesLoading ? (
              <div className="text-sm text-gray-500 p-3 text-center">Carregando zonas...</div>
            ) : zones.length === 0 ? (
              <div className="text-sm text-orange-600 p-3 text-center bg-orange-50 rounded-md">
                Nenhuma zona encontrada para este local
              </div>
            ) : (
              <Select
                value={selectedZoneId}
                onValueChange={handleZoneChange}
              >
                <SelectTrigger 
                  id="zone-select"
                  className="w-full"
                  data-testid="select-zone"
                >
                  <SelectValue placeholder="Escolha uma zona..." />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service-select" className="text-sm font-medium text-gray-700">
              3. Selecione o Serviço
            </Label>
            {!selectedZoneId ? (
              <div className="text-sm text-gray-400 p-3 text-center bg-gray-50 rounded-md">
                Primeiro selecione uma zona
              </div>
            ) : servicesLoading ? (
              <div className="text-sm text-gray-500 p-3 text-center">Carregando serviços...</div>
            ) : services.length === 0 ? (
              <div className="text-sm text-orange-600 p-3 text-center bg-orange-50 rounded-md">
                Nenhum serviço encontrado para esta zona
              </div>
            ) : (
              <Select
                value={selectedServiceId}
                onValueChange={handleServiceChange}
              >
                <SelectTrigger 
                  id="service-select"
                  className="w-full"
                  data-testid="select-service"
                >
                  <SelectValue placeholder="Escolha um serviço..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-gray-500" />
                        <span>{service.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
            data-testid="button-cancel-manual-selection"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 bg-navy-600 hover:bg-navy-700 text-white"
            data-testid="button-confirm-manual-selection"
          >
            {canConfirm ? "Confirmar" : "Selecione local e serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}