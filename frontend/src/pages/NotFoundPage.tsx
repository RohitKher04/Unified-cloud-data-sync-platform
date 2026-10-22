import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Custom inline SVG illustration */}
        <div className="mx-auto flex h-36 w-36 items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-primary"
          >
            <rect
              x="20"
              y="20"
              width="120"
              height="120"
              rx="28"
              fill="currentColor"
              fillOpacity="0.06"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            <circle cx="80" cy="80" r="38" fill="currentColor" fillOpacity="0.12" />
            <path
              d="M58 80H102M80 58V102"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              transform="rotate(45 80 80)"
              className="text-muted-foreground"
            />
            <circle cx="56" cy="56" r="4" fill="currentColor" />
            <circle cx="104" cy="56" r="4" fill="currentColor" />
            <circle cx="56" cy="104" r="4" fill="currentColor" />
            <circle cx="104" cy="104" r="4" fill="currentColor" />
          </svg>
        </div>

        <div className="space-y-2">
          <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold font-mono text-primary">
            404 ERROR
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Page Not Found
          </h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            The page you requested could not be located or may have been moved. Check the URL or return to your overview.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="gap-2 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go Back
          </Button>

          <Button asChild size="sm" className="gap-2 text-xs">
            <Link to="/dashboard">
              <Home className="h-3.5 w-3.5" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
