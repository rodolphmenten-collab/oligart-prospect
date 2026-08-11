import { type ButtonHTMLAttributes, forwardRef } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'ghost' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-bone text-ink hover:bg-brass-bright',
  outline: 'border border-white/20 text-bone hover:border-brass',
  ghost: 'text-bone-dim hover:text-bone',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', href, children, ...props }, ref) => {
    const classes = `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`;

    if (href) {
      return (
        <Link href={href} className={classes}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
