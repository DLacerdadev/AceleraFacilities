import { CSSProperties } from "react";

/**
 * Hook para obter estilos CSS dinâmicos baseados no módulo ativo
 * TODOS os estilos usam variáveis CSS: --module-primary, --module-secondary, --module-accent
 * Design predominantemente BRANCO com cor do módulo como identificação
 */
export function useModuleTheme() {
  
  // TODOS OS ESTILOS USAM VARIÁVEIS CSS - SEM BRANCHES CONDICIONAIS
  
  return {
    // Estilos inline básicos
    styles: {
      gradient: {
        background: 'linear-gradient(135deg, var(--module-primary), var(--module-secondary))'
      } as CSSProperties,
      
      color: {
        color: 'var(--module-primary)'
      } as CSSProperties,
      
      bgColor: {
        backgroundColor: 'var(--module-primary)'
      } as CSSProperties,
      
      borderColor: {
        borderColor: 'var(--module-primary)'
      } as CSSProperties,
    },
    
    // Gradientes - neutros ou usando variáveis CSS
    gradients: {
      page: 'bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20',
      section: 'bg-gradient-to-b from-white to-slate-50/30',
      
      // Header e stat cards usam estilos inline
      headerStyle: {
        background: 'linear-gradient(to right, var(--module-primary), var(--module-secondary))'
      } as CSSProperties,
      
      statStyle: {
        background: 'linear-gradient(to bottom right, var(--module-primary), var(--module-secondary))'
      } as CSSProperties,
      
      // Cards com toque suave de cor
      glassStyle: {
        background: 'linear-gradient(to bottom right, rgba(255,255,255,0.95), color-mix(in srgb, var(--module-primary) 5%, white), rgba(255,255,255,0.9))',
        backdropFilter: 'blur(10px)'
      } as CSSProperties,
      
      cardAccentStyle: {
        background: 'linear-gradient(to bottom right, white, color-mix(in srgb, var(--module-primary) 3%, white))'
      } as CSSProperties,
    },
    
    // Sombras neutras (cinza, não coloridas)
    shadows: {
      card: 'shadow-lg shadow-slate-200/50 hover:shadow-slate-300/60',
      button: 'hover:shadow-md',
      buttonStyle: {
        boxShadow: '0 4px 6px -1px color-mix(in srgb, var(--module-primary) 10%, transparent)'
      } as CSSProperties,
      intense: 'shadow-xl shadow-slate-300/40',
    },
    
    // Botões - cor do módulo
    buttons: {
      primary: 'text-white transition-all duration-200',
      primaryStyle: {
        background: 'linear-gradient(135deg, var(--module-primary), var(--module-secondary))'
      } as CSSProperties,
        
      outline: 'border transition-all duration-200',
      outlineStyle: {
        borderColor: 'var(--module-primary)',
        color: 'var(--module-primary)',
        backgroundColor: 'transparent'
      } as CSSProperties,
      
      outlineHoverStyle: {
        backgroundColor: 'color-mix(in srgb, var(--module-primary) 5%, white)'
      } as CSSProperties,
    },
    
    // Badges/Tags
    badges: {
      primary: 'border',
      primaryStyle: {
        backgroundColor: 'color-mix(in srgb, var(--module-primary) 10%, white)',
        color: 'var(--module-primary)',
        borderColor: 'color-mix(in srgb, var(--module-primary) 30%, white)'
      } as CSSProperties,
        
      light: '',
      lightStyle: {
        backgroundColor: 'color-mix(in srgb, var(--module-primary) 5%, white)',
        color: 'var(--module-primary)'
      } as CSSProperties,
    },
    
    // Cards
    cards: {
      modern: 'bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200',
      
      gradient: 'border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300',
      gradientStyle: {
        background: 'linear-gradient(to bottom right, white, color-mix(in srgb, var(--module-primary) 3%, white))'
      } as CSSProperties,
        
      glass: 'border border-slate-200/60 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300',
      glassStyle: {
        background: 'linear-gradient(to bottom right, rgba(255,255,255,0.95), color-mix(in srgb, var(--module-primary) 5%, white), rgba(255,255,255,0.9))',
        backdropFilter: 'blur(10px)'
      } as CSSProperties,
        
      featured: 'text-white rounded-xl shadow-lg transition-all duration-300',
      featuredStyle: {
        background: 'linear-gradient(to bottom right, var(--module-primary), var(--module-secondary))'
      } as CSSProperties,
    },
    
    // Cores de texto
    text: {
      primary: '',
      primaryStyle: { color: 'var(--module-primary)' } as CSSProperties,
      
      light: '',
      lightStyle: { color: 'color-mix(in srgb, var(--module-primary) 80%, white)' } as CSSProperties,
      
      dark: '',
      darkStyle: { color: 'color-mix(in srgb, var(--module-primary) 120%, black)' } as CSSProperties,
    },
    
    // Bordas
    borders: {
      primary: 'border',
      primaryStyle: { borderColor: 'var(--module-primary)' } as CSSProperties,
      
      light: 'border',
      lightStyle: { borderColor: 'color-mix(in srgb, var(--module-primary) 40%, white)' } as CSSProperties,
      
      accent: 'border-l-4',
      accentStyle: { borderLeftColor: 'var(--module-primary)' } as CSSProperties,
    },
    
    // Backgrounds
    backgrounds: {
      light: '',
      lightStyle: { backgroundColor: 'color-mix(in srgb, var(--module-primary) 10%, white)' } as CSSProperties,
      
      lighter: '',
      lighterStyle: { backgroundColor: 'color-mix(in srgb, var(--module-primary) 5%, white)' } as CSSProperties,
      
      primary: '',
      primaryStyle: { backgroundColor: 'var(--module-primary)' } as CSSProperties,
    },
    
    // Hover effects
    hover: {
      card: 'hover:border-slate-300 hover:shadow-md',
      cardStyle: {
        borderColor: 'color-mix(in srgb, var(--module-primary) 20%, var(--border))'
      } as CSSProperties,
    },
    
    // Animações
    animations: {
      shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
      pulse: '',
      pulseStyle: {
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        backgroundColor: 'color-mix(in srgb, var(--module-primary) 10%, transparent)'
      } as CSSProperties,
    }
  };
}
