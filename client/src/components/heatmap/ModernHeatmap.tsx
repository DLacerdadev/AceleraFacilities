import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Zone {
  zoneId: string;
  zoneName: string;
  areaM2: number;
  slaPercentage: number;
  totalTasks: number;
  completedTasks: number;
  category: string;
}

interface ModernHeatmapProps {
  data: Zone[];
  selectedSite?: any;
  onZoneClick?: (zoneId: string) => void;
}

export default function ModernHeatmap({ data, selectedSite, onZoneClick }: ModernHeatmapProps) {
  // Transform data for ApexCharts heatmap
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group zones by category for better visualization
    const categories = [...new Set(data.map(zone => zone.category))];
    
    return categories.map((category, categoryIndex) => {
      const categoryZones = data.filter(zone => zone.category === category);
      
      return {
        name: category.charAt(0).toUpperCase() + category.slice(1),
        data: categoryZones.map((zone, zoneIndex) => ({
          x: zone.zoneName,
          y: zone.slaPercentage,
          zone: zone, // Keep zone data for tooltips
          color: getSLAColor(zone.slaPercentage)
        }))
      };
    });
  }, [data]);

  // Chart configuration
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'heatmap' as const,
      height: 400,
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      },
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: true
        }
      },
      events: {
        dataPointSelection: (event: any, chartContext: any, config: any) => {
          const zone = chartData[config.seriesIndex]?.data[config.dataPointIndex]?.zone;
          if (zone && onZoneClick) {
            onZoneClick(zone.zoneId);
          }
        }
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#fff'],
        fontSize: '12px',
        fontWeight: 'bold'
      },
      formatter: (value: number) => `${value}%`
    },
    colors: ['#008FFB'],
    plotOptions: {
      heatmap: {
        radius: 8,
        enableShades: false,
        colorScale: {
          ranges: [
            { from: 0, to: 70, color: '#FF4560', name: 'Crítico' },
            { from: 71, to: 84, color: '#FEB019', name: 'Atenção' },
            { from: 85, to: 94, color: '#00D9FF', name: 'Bom' },
            { from: 95, to: 100, color: '#00E396', name: 'Excelente' }
          ]
        },
        distributed: false
      }
    },
    xaxis: {
      type: 'category',
      labels: {
        style: {
          fontSize: '11px',
          colors: '#64748b'
        },
        rotate: -45,
        trim: true,
        maxHeight: 80
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '12px',
          colors: '#64748b'
        }
      }
    },
    tooltip: {
      custom: ({ seriesIndex, dataPointIndex, w }: any) => {
        const zone = chartData[seriesIndex]?.data[dataPointIndex]?.zone;
        if (!zone) return '';
        
        return `
          <div class="bg-white p-4 rounded-lg shadow-lg border min-w-64">
            <div class="font-semibold text-slate-900 mb-2">${zone.zoneName}</div>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-600">SLA:</span>
                <span class="font-medium ${getSLATextColor(zone.slaPercentage)}">${zone.slaPercentage}%</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Área:</span>
                <span class="font-medium">${zone.areaM2}m²</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Tarefas:</span>
                <span class="font-medium">${zone.completedTasks}/${zone.totalTasks}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600">Categoria:</span>
                <span class="font-medium capitalize">${zone.category}</span>
              </div>
            </div>
          </div>
        `;
      }
    },
    grid: {
      padding: {
        top: 0,
        right: 30,
        bottom: 0,
        left: 20
      }
    },
    legend: {
      show: false
    }
  }), [chartData, onZoneClick]);

  // Statistics for the header
  const stats = useMemo(() => {
    if (!data || data.length === 0) return { avgSLA: 0, totalZones: 0, criticalZones: 0, excellentZones: 0 };

    const avgSLA = Math.round(data.reduce((sum, zone) => sum + zone.slaPercentage, 0) / data.length);
    const criticalZones = data.filter(zone => zone.slaPercentage < 70).length;
    const excellentZones = data.filter(zone => zone.slaPercentage >= 95).length;

    return {
      avgSLA,
      totalZones: data.length,
      criticalZones,
      excellentZones
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Mapa de Calor Interativo - SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Carregando dados do mapa de calor...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              Mapa de Calor Interativo - SLA de Limpeza
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedSite?.name} - Visualização em tempo real do cumprimento de SLA por zona
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">SLA Médio</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.avgSLA}%</div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Excelentes</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.excellentZones}</div>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-red-100 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">Críticas</span>
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.criticalZones}</div>
          </div>

          <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Minus className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-900">Total</span>
            </div>
            <div className="text-2xl font-bold text-slate-600 mt-1">{stats.totalZones}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            Crítico (&lt;70%)
          </Badge>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            Atenção (70-84%)
          </Badge>
          <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-200">
            <div className="w-3 h-3 bg-cyan-500 rounded-full mr-2"></div>
            Bom (85-94%)
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            Excelente (≥95%)
          </Badge>
        </div>

        {/* Interactive Heatmap */}
        <div className="w-full">
          <Chart
            options={chartOptions}
            series={chartData}
            type="heatmap"
            height={400}
          />
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">💡 Dica:</span> Clique nas células do mapa para ver detalhes das zonas. Use a barra de ferramentas para exportar ou resetar a visualização.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getSLAColor(sla: number): string {
  if (sla >= 95) return '#00E396'; // Green - Excellent
  if (sla >= 85) return '#00D9FF'; // Cyan - Good  
  if (sla >= 70) return '#FEB019'; // Orange - Attention
  return '#FF4560'; // Red - Critical
}

function getSLATextColor(sla: number): string {
  if (sla >= 95) return 'text-green-600';
  if (sla >= 85) return 'text-cyan-600';
  if (sla >= 70) return 'text-orange-600';
  return 'text-red-600';
}