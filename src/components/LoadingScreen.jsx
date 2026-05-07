import Logo from './Logo';

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 grain">
      <div className="animate-fade-in flex flex-col items-center gap-6">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
        <div className="flex items-center gap-2 text-coral-500/60">
          <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-coral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-cream-100/70 text-sm">{message}</p>
      </div>
    </div>
  );
}
