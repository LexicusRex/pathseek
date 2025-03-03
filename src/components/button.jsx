import React, { forwardRef } from 'react';

/**
 * Reusable Button component with configurable styles
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} [props.className] - Additional classes to override defaults
 * @param {string} [props.variant='primary'] - Button style variant
 * @param {string} [props.size='md'] - Button size
 * @param {function} [props.onClick] - Click handler
 * @param {boolean} [props.disabled] - Disabled state
 * @param {React.ReactNode} [props.startIcon] - Icon to show before text
 * @param {React.ReactNode} [props.endIcon] - Icon to show after text
 * @param {any} props.rest - All other props passed to the button element
 */
const Button = forwardRef(({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  startIcon,
  endIcon,
  ...rest
}, ref) => {
  // Base classes that always apply
  const baseClasses = 'font-semibold cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ';

  // Size classes
  const sizeClasses = {
    sm: 'h-8 px-3 py-1 text-xs',
    md: 'h-9 px-4 py-2',
    lg: 'h-10 px-6 py-2.5 text-base',
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow hover:bg-[var(--primary)]/90 shadow',
    secondary: 'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80',
    outline: 'border border-[var(--input)] bg-background hover:bg-[var(--accent1)] hover:text-[var(--accent1-foreground)]',
    ghost: 'hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
    destructive: 'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90',
    accent1: 'bg-[var(--accent1)] text-[var(--accent1-foreground)] hover:bg-[var(--accent1)]/90',
    accent2: 'bg-[var(--accent2)] text-[var(--accent2-foreground)] hover:bg-[var(--accent2)]/90',
  };

  // Combine classes, with custom className taking precedence
  const classes = `${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${className}`;

  return (
    <button 
      ref={ref}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {startIcon && <span className="button-start-icon">{startIcon}</span>}
      {children}
      {endIcon && <span className="button-end-icon">{endIcon}</span>}
    </button>
  );
});

export default Button;