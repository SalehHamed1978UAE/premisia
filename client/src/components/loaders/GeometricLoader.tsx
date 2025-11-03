import './geometric-loaders.css';

export type LoaderType = 'cube' | 'hexagon' | 'orbit' | 'fractal' | 'dots' | 'ripple';

interface GeometricLoaderProps {
  type?: LoaderType;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function GeometricLoader({ type = 'fractal', size = 'medium', className = '' }: GeometricLoaderProps) {
  const sizeClass = size === 'small' ? `${type}-loader-small` : '';
  
  const loaders: Record<LoaderType, JSX.Element> = {
    cube: (
      <div className={`cube-loader ${sizeClass} ${className}`}>
        <div className="cube-face"></div>
        <div className="cube-face"></div>
        <div className="cube-face"></div>
        <div className="cube-face"></div>
        <div className="cube-face"></div>
        <div className="cube-face"></div>
      </div>
    ),
    hexagon: (
      <div className={`hexagon-loader ${sizeClass} ${className}`}>
        <div className="hexagon"></div>
      </div>
    ),
    orbit: (
      <div className={`orbit-loader ${sizeClass} ${className}`}>
        <div className="orbit-center"></div>
        <div className="orbit-ring">
          <div className="orbit-dot"></div>
        </div>
        <div className="orbit-ring">
          <div className="orbit-dot"></div>
        </div>
        <div className="orbit-ring">
          <div className="orbit-dot"></div>
        </div>
      </div>
    ),
    fractal: (
      <div className={`fractal-loader ${sizeClass} ${className}`}>
        <div className="fractal-square"></div>
        <div className="fractal-square"></div>
        <div className="fractal-square"></div>
        <div className="fractal-square"></div>
      </div>
    ),
    dots: (
      <div className={`dots-loader ${className}`}>
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    ),
    ripple: (
      <div className={`ripple-loader ${sizeClass} ${className}`}>
        <div className="ripple-ring"></div>
        <div className="ripple-ring"></div>
        <div className="ripple-ring"></div>
      </div>
    ),
  };

  return loaders[type];
}

// Button loader wrapper
interface ButtonLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  loaderType?: LoaderType;
  className?: string;
}

export function ButtonWithLoader({ isLoading, children, loaderType = 'dots', className = '' }: ButtonLoaderProps) {
  return (
    <span className={isLoading ? 'btn-loading' : ''}>
      <span className={isLoading ? 'btn-text' : ''}>{children}</span>
      {isLoading && (
        <span className="btn-loader">
          <GeometricLoader type={loaderType} size="small" />
        </span>
      )}
    </span>
  );
}
