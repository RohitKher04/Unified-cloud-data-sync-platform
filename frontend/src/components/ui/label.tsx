import React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-xs font-semibold tracking-wide text-foreground/90 uppercase select-none',
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';
