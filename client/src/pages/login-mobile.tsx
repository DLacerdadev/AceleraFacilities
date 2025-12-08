import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { login, setAuthState } from "@/lib/auth";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import aceleraLogo from "@assets/imagem_2025-11-10_010501695-Photoroom_1762805733799.png";

export default function LoginMobile() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user, token } = await login(credentials);
      setAuthState(user, token);
      
      // Redirecionar baseado no role do usuário
      if (user.role === 'operador') {
        setLocation("/mobile");
      } else {
        // Admin, gestor, supervisor vão para a versão desktop
        setLocation("/");
      }
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${user.name}!`,
      });
    } catch (error) {
      toast({
        title: "Erro no login",
        description: "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      
      {/* Container principal adaptado para mobile */}
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Hero Section adaptada para mobile */}
        <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 text-white overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="relative z-10 text-center space-y-6">
            {/* Logo */}
            <div className="mb-8">
              <div className="w-40 h-24 mx-auto bg-white/95 rounded-2xl p-4 shadow-xl flex items-center justify-center">
                <img 
                  src={aceleraLogo} 
                  alt="Acelera Full Facilities" 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
            
            {/* Hero Text */}
            <div className="space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                Plataforma inteligente para gestão completa de facilities
              </p>
            </div>
            
            {/* Features compactas */}
            <div className="grid grid-cols-1 gap-2 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span className="text-xs text-slate-300">Gestão em tempo real</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                <span className="text-xs text-slate-300">Interface móvel otimizada</span>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-16 h-16 bg-blue-500/20 rounded-full blur-xl"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 bg-indigo-500/20 rounded-full blur-xl"></div>
        </div>

        {/* Login Form Section */}
        <div className="p-8">
          <div className="space-y-6">
            
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Entrar</h2>
              <p className="text-slate-600 text-sm">Acesse sua conta para continuar</p>
            </div>

            {/* Login Form */}
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  
                  {/* Username Field */}
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium text-slate-900">
                      Usuário
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="username"
                        data-testid="input-username-mobile"
                        type="text"
                        placeholder="Digite seu usuário"
                        value={credentials.username}
                        onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-900">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        data-testid="input-password-mobile"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={credentials.password}
                        onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all duration-200"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Login Button */}
                  <Button 
                    type="submit" 
                    data-testid="button-login-mobile"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Entrando...</span>
                      </div>
                    ) : (
                      "Entrar"
                    )}
                  </Button>

                </form>
              </CardContent>
            </Card>

            {/* Link para Desktop */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                data-testid="link-desktop-version"
              >
                Acessar versão desktop
              </button>
            </div>

            {/* Footer */}
            <div className="text-center pt-4">
              <p className="text-xs text-slate-500">
                © 2025 Acelera Full Facilities. Todos os direitos reservados.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}