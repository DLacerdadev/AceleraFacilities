import { useLocation } from 'wouter';
import { Building2, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MODULE_CONFIGS, ModuleType } from '@/contexts/ModuleContext';

export default function ModuleSelector() {
  const [, setLocation] = useLocation();

  const handleModuleSelect = (moduleType: ModuleType) => {
    localStorage.setItem('opus:currentModule', moduleType);
    setLocation(`/${moduleType}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Plataforma OPUS
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Selecione o módulo que deseja acessar
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-blue-500"
            onClick={() => handleModuleSelect('clean')}
            data-testid="card-module-clean"
          >
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl text-blue-900 dark:text-blue-400">
                {MODULE_CONFIGS.clean.displayName}
              </CardTitle>
              <CardDescription className="text-base">
                {MODULE_CONFIGS.clean.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-select-clean"
              >
                Acessar OPUS Clean
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-orange-500"
            onClick={() => handleModuleSelect('maintenance')}
            data-testid="card-module-maintenance"
          >
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wrench className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-2xl text-orange-900 dark:text-orange-400">
                {MODULE_CONFIGS.maintenance.displayName}
              </CardTitle>
              <CardDescription className="text-base">
                {MODULE_CONFIGS.maintenance.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-select-maintenance"
              >
                Acessar OPUS Manutenção
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sistema modular de gestão de facilities
          </p>
        </div>
      </div>
    </div>
  );
}
