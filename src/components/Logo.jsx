import { cn } from '../lib/utils';

export default function Logo({ className, size = 'md' }) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg' },
    md: { icon: 'w-12 h-12', text: 'text-2xl' },
    lg: { icon: 'w-20 h-20', text: 'text-4xl' },
    xl: { icon: 'w-28 h-28', text: 'text-5xl' },
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative', sizes[size].icon)}>
        <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#b8941f" />
            </linearGradient>
            <linearGradient id="logoGradRed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B0000" />
              <stop offset="100%" stopColor="#3d0101" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#logoGradRed)" stroke="url(#logoGrad)" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="url(#logoGrad)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
          <path
            d="M50 25 C40 25, 32 33, 32 43 C32 55, 50 75, 50 75 C50 75, 68 55, 68 43 C68 33, 60 25, 50 25 Z"
            fill="url(#logoGrad)"
          />
          <circle cx="50" cy="43" r="5" fill="#3d0101" />
          <circle cx="50" cy="43" r="2.5" fill="#D4AF37" />
          <circle cx="20" cy="50" r="1.2" fill="#D4AF37" opacity="0.6" />
          <circle cx="80" cy="50" r="1.2" fill="#D4AF37" opacity="0.6" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={cn('font-display font-bold tracking-tight text-ivory-50 leading-none', sizes[size].text)}>
          Trip<span className="text-gold-500">App</span>
        </span>
        {(size === 'lg' || size === 'xl') && (
          <span className="font-accent italic text-gold-500/70 text-sm mt-1">Your Personal Travel Companion</span>
        )}
      </div>
    </div>
  );
}
