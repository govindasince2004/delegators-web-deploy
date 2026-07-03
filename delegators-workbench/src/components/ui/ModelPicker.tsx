import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayModelHint, displayModelName } from '../../lib/modelLabels';
import { cn } from '../../lib/utils';

type ModelPickerVariant = 'composer' | 'settings';

interface ModelPickerProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  variant?: ModelPickerVariant;
  disabled?: boolean;
}

function detailsFor(model: string) {
  return {
    name: displayModelName(model),
    description: displayModelHint(model),
  };
}

export function ModelPicker({
  models,
  value,
  onChange,
  variant = 'composer',
  disabled = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, models.indexOf(value)));
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = detailsFor(value);

  const updateAnchor = () => {
    if (buttonRef.current) setAnchor(buttonRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateAnchor();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const reposition = () => updateAnchor();
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(Math.max(0, models.indexOf(value)));
  }, [models, value]);

  const select = (model: string) => {
    onChange(model);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % models.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + models.length) % models.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const model = models[activeIndex];
      if (model) select(model);
    }
  };

  const menuWidth = Math.min(320, window.innerWidth - 24);
  const left = anchor
    ? Math.max(12, Math.min(anchor.left, window.innerWidth - menuWidth - 12))
    : 12;
  const openAbove = anchor ? anchor.top > window.innerHeight - anchor.bottom : true;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn('model-trigger', `model-trigger-${variant}`, open && 'open')}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || models.length === 0}
        title={variant === 'composer' ? `Model: ${current.name}` : 'Choose model'}
      >
        {variant === 'settings' ? (
          <img
            className="model-trigger-logo"
            src="/delegators-logo-white.png"
            alt=""
            aria-hidden="true"
          />
        ) : null}
        <span className="model-trigger-copy">
          {variant === 'settings' ? <small>Current model</small> : null}
          <strong>{current.name}</strong>
        </span>
        <ChevronDown size={variant === 'composer' ? 11 : 13} aria-hidden="true" />
      </button>

      {open && anchor ? createPortal(
        <div
          ref={menuRef}
          className="model-menu"
          role="listbox"
          aria-label="Choose a model"
          style={{
            width: menuWidth,
            left,
            top: openAbove ? anchor.top - 8 : anchor.bottom + 8,
            transform: openAbove ? 'translateY(-100%)' : undefined,
          }}
          onKeyDown={handleKeyDown}
        >
          <div className="model-menu-heading">
            <span>Available with your plan</span>
            <small>{models.length} model{models.length === 1 ? '' : 's'}</small>
          </div>
          {models.map((model, index) => {
            const details = detailsFor(model);
            const selected = model === value;
            return (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn('model-option', index === activeIndex && 'active')}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(model)}
              >
                <span className="model-option-icon">
                  <img src="/delegators-logo-white.png" alt="" aria-hidden="true" />
                </span>
                <span className="model-option-copy">
                  <strong>{details.name}</strong>
                  <small>{details.description}</small>
                </span>
                <span className="model-option-check">
                  {selected ? <Check size={15} aria-hidden="true" /> : null}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      ) : null}
    </>
  );
}