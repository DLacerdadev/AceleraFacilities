import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  Package,
  MapPin,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface PublicZoneStats {
  zone: { id: string; name: string };
  customer: { id: string; name: string; homeLogo?: string | null };
  module: string;
  stats: {
    openToday: number;
    completedToday: number;
    partsUsedToday: number;
  };
  workOrders: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string | null;
    completedAt: string | null;
  }>;
}

export default function PublicZoneTv() {
  const params = useParams();
  const slug = params.slug as string;
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: stats, isLoading, isError, refetch } = useQuery<PublicZoneStats>({
    queryKey: ["/api/public/zone", slug],
    enabled: !!slug && slug.length >= 20,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (stats) {
      setLastUpdate(new Date());
    }
  }, [stats]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluida': return 'bg-green-500';
      case 'em_andamento': return 'bg-blue-500';
      case 'pendente': return 'bg-yellow-500';
      case 'cancelada': return 'bg-gray-500';
      default: return 'bg-orange-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'concluida': return 'Concluída';
      case 'em_andamento': return 'Em Andamento';
      case 'pendente': return 'Pendente';
      case 'cancelada': return 'Cancelada';
      case 'aberta': return 'Aberta';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'bg-red-500';
      case 'alta': return 'bg-orange-500';
      case 'media': return 'bg-yellow-500';
      case 'baixa': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Carregando informações da zona...</p>
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Página não encontrada</h1>
          <p className="text-slate-400">O link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  const openOrders = stats.workOrders.filter(wo => wo.status !== 'concluida' && wo.status !== 'cancelada');
  const completedOrders = stats.workOrders.filter(wo => wo.status === 'concluida');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {stats.customer.homeLogo && (
              <img 
                src={stats.customer.homeLogo} 
                alt={stats.customer.name}
                className="h-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white flex items-center gap-3">
                <MapPin className="w-8 h-8 text-cyan-400" />
                {stats.zone.name}
              </h1>
              <p className="text-slate-400 text-lg">{stats.customer.name}</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="text-lg px-4 py-2 border-cyan-400 text-cyan-400"
          >
            {stats.module === 'maintenance' ? 'Manutenção' : 'Limpeza'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">OS Abertas Hoje</p>
                    <p className="text-4xl font-bold text-orange-400">
                      {stats.stats.openToday}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Clock className="w-7 h-7 text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">OS Concluídas Hoje</p>
                    <p className="text-4xl font-bold text-green-400">
                      {stats.stats.completedToday}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">Peças Utilizadas</p>
                    <p className="text-4xl font-bold text-cyan-400">
                      {stats.stats.partsUsedToday}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <Package className="w-7 h-7 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm h-full">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Ordens em Aberto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {openOrders.length > 0 ? (
                    <motion.div
                      key="open-orders"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {openOrders.map((wo, index) => (
                        <motion.div
                          key={wo.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-slate-700/50 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-white">{wo.title}</p>
                              <p className="text-sm text-slate-400">Código: {wo.code}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge className={getPriorityColor(wo.priority)}>
                                {wo.priority}
                              </Badge>
                              <Badge className={getStatusColor(wo.status)}>
                                {getStatusLabel(wo.status)}
                              </Badge>
                            </div>
                          </div>
                          {wo.createdAt && (
                            <p className="text-xs text-slate-500">
                              Criada: {new Date(wo.createdAt).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-slate-400">Nenhuma ordem em aberto</p>
                    </div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm h-full">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  Concluídas Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {completedOrders.length > 0 ? (
                    <motion.div
                      key="completed-orders"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {completedOrders.map((wo, index) => (
                        <motion.div
                          key={wo.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-slate-700/50 rounded-lg p-4 border-l-4 border-green-500"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-white">{wo.title}</p>
                              <p className="text-sm text-slate-400">Código: {wo.code}</p>
                            </div>
                            <Badge className="bg-green-500">Concluída</Badge>
                          </div>
                          {wo.completedAt && (
                            <p className="text-xs text-slate-500">
                              Concluída: {new Date(wo.completedAt).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <div className="text-center py-8">
                      <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">Nenhuma ordem concluída hoje</p>
                    </div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4 text-slate-500 animate-pulse" />
          <p className="text-slate-500 text-sm">
            Atualização automática a cada 30s - Última: {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
