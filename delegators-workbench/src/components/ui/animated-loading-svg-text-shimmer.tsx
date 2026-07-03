import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

let cachedPathLength = 0;
let stylesInjected = false;

const loaderKeyframes = `
  @keyframes drawStroke {
    0% {
      stroke-dashoffset: var(--path-length);
      animation-timing-function: ease-in-out;
    }
    50% {
      stroke-dashoffset: 0;
      animation-timing-function: ease-in-out;
    }
    100% {
      stroke-dashoffset: calc(var(--path-length) * -1);
    }
  }
`;

interface LoaderProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
}

const Loader = React.forwardRef<SVGSVGElement, LoaderProps>(
  ({ className, size = 64, strokeWidth = 2, ...props }, ref) => {
    const pathRef = useRef<SVGPathElement>(null);
    const [pathLength, setPathLength] = useState(cachedPathLength);

    useEffect(() => {
      if (!stylesInjected) {
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = loaderKeyframes;
        document.head.appendChild(style);
      }

      if (!cachedPathLength && pathRef.current) {
        cachedPathLength = pathRef.current.getTotalLength();
        setPathLength(cachedPathLength);
      }
    }, []);

    const isReady = pathLength > 0;

    return (
      <svg
        ref={ref}
        role="status"
        aria-label="Loading"
        viewBox="0 0 19 19"
        fill="none"
        width={size}
        height={size}
        className={cn('text-current', className)}
        {...props}
      >
        <path
          ref={pathRef}
          d="M4.43431 2.42415C-0.789139 6.90104 1.21472 15.2022 8.434 15.9242C15.5762 16.6384 18.8649 9.23035 15.9332 4.5183C14.1316 1.62255 8.43695 0.0528911 7.51841 3.33733C6.48107 7.04659 15.2699 15.0195 17.4343 16.9241"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={isReady ? {
            strokeDasharray: pathLength,
            '--path-length': pathLength,
          } as React.CSSProperties : undefined}
          className={cn(
            'transition-opacity duration-300',
            isReady ? 'opacity-100 animate-[drawStroke_2.5s_infinite]' : 'opacity-0'
          )}
        />
      </svg>
    );
  }
);

Loader.displayName = 'Loader';

interface LoadingBreadcrumbProps {
  text?: string;
  className?: string;
  onOpenSteps?: () => void;
}

export function LoadingBreadcrumb({
  text = 'Thinking',
  className,
  onOpenSteps,
}: LoadingBreadcrumbProps) {
  const content = (
    <>
      <Loader size={18} strokeWidth={2.5} className="loading-breadcrumb-icon" />
      <span className="loading-breadcrumb-text">{text}</span>
      {onOpenSteps ? (
        <ChevronRight size={15} className="loading-breadcrumb-chevron" aria-hidden="true" />
      ) : null}
    </>
  );

  if (!onOpenSteps) {
    return (
      <div className={cn('loading-breadcrumb', className)} aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn('loading-breadcrumb', 'loading-breadcrumb-clickable', className)}
      onClick={onOpenSteps}
      aria-label={`View harness steps: ${text}`}
    >
      {content}
    </button>
  );
}
