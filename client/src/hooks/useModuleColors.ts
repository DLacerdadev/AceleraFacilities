import { CSSProperties } from "react";

/**
 * Hook que retorna utilitários para aplicar cores do módulo ativo
 */
export function useModuleColors() {
  /**
   * Retorna um estilo para botão primário com cores do módulo
   */
  const getButtonStyle = (): CSSProperties => ({
    background: `linear-gradient(135deg, var(--module-primary), var(--module-secondary))`,
  });

  /**
   * Retorna um estilo para badge com cores do módulo
   */
  const getBadgeStyle = (): CSSProperties => ({
    backgroundColor: 'var(--module-primary)',
    borderColor: 'var(--module-primary)',
    color: 'white',
  });

  /**
   * Retorna um estilo para ícone com cor primária do módulo
   */
  const getIconStyle = (): CSSProperties => ({
    color: 'var(--module-primary)',
  });

  /**
   * Retorna um estilo para background suave com cores do módulo
   */
  const getSoftBackgroundStyle = (): CSSProperties => ({
    background: `linear-gradient(135deg, color-mix(in srgb, var(--module-primary) 10%, white), color-mix(in srgb, var(--module-secondary) 5%, white))`,
    borderColor: `color-mix(in srgb, var(--module-primary) 30%, white)`,
  });

  /**
   * Retorna classe CSS para texto com cor primária do módulo
   */
  const getTextColorClass = () => 'text-[var(--module-primary)]';

  return {
    getButtonStyle,
    getBadgeStyle,
    getIconStyle,
    getSoftBackgroundStyle,
    getTextColorClass,
  };
}
