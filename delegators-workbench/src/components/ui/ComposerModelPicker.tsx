import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  availableComposerLanes,
  composerLaneLabel,
  composerTriggerLabel,
  laneSupportsThinking,
  parseComposerModelSelection,
  showComposerThinkingToggle,
  resolveComposerModel,
  type ComposerLane,
} from '../../lib/composerModelLanes';
import { cn } from '../../lib/utils';

type ComposerModelPickerProps = {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
};

export function ComposerModelPicker({
  models,
  value,
  onChange,
  disabled = false,
}: ComposerModelPickerProps) {
  const selection = parseComposerModelSelection(value, models);
  const lanes = availableComposerLanes(models);
  const activeLane = selection.lane;
  const thinkingToggleVisible = showComposerThinkingToggle(activeLane, models);
  const thinkingOn = selection.thinking && laneSupportsThinking(activeLane, models);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, lanes.indexOf(activeLane)));
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setActiveIndex(Math.max(0, lanes.indexOf(activeLane)));
  }, [activeLane, lanes]);

  const applySelection = (lane: ComposerLane, thinking: boolean) => {
    const resolvedThinking = thinking && laneSupportsThinking(lane, models);
    const model = resolveComposerModel(lane, resolvedThinking, models);
    if (model) onChange(model);
  };

  const selectLane = (lane: ComposerLane) => {
    const keepThinking = thinkingOn && laneSupportsThinking(lane, models);
    applySelection(lane, keepThinking);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const setThinking = (enabled: boolean) => {
    applySelection(activeLane, enabled);
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
      setActiveIndex((index) => (index + 1) % lanes.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + lanes.length) % lanes.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const lane = lanes[activeIndex];
      if (lane) selectLane(lane);
    }
  };

  const menuWidth = 188;
  const left = anchor
    ? Math.max(12, Math.min(anchor.left, window.innerWidth - menuWidth - 12))
    : 12;
  const openAbove = anchor ? anchor.top > window.innerHeight - anchor.bottom : true;
  const triggerLabel = composerTriggerLabel(activeLane, thinkingOn);

  if (lanes.length === 0) {
    return (
      <button type="button" className="composer-model-trigger" disabled>
        <span>dlg pro</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn('composer-model-trigger', open && 'open')}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${triggerLabel}`}
        disabled={disabled || lanes.length === 0}
        title="Model"
      >
        <span>{triggerLabel}</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>

      {open && anchor ? createPortal(
        <div
          ref={menuRef}
          className="composer-model-menu"
          role="listbox"
          aria-label="Model"
          style={{
            width: menuWidth,
            left,
            top: openAbove ? anchor.top - 8 : anchor.bottom + 8,
            transform: openAbove ? 'translateY(-100%)' : undefined,
          }}
          onKeyDown={handleKeyDown}
        >
          <div className="composer-model-menu-heading">Model</div>
          {lanes.map((lane, index) => {
            const laneSelected = lane === activeLane;
            return (
              <button
                key={lane}
                type="button"
                role="option"
                aria-selected={laneSelected}
                className={cn('composer-model-option', index === activeIndex && 'active')}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectLane(lane)}
              >
                <span>{composerLaneLabel(lane)}</span>
                <span className="composer-model-option-check">
                  {laneSelected && !thinkingOn ? <Check size={14} aria-hidden="true" /> : null}
                </span>
              </button>
            );
          })}

          {thinkingToggleVisible ? (
            <>
              <div className="composer-model-divider" aria-hidden="true" />
              <div className="composer-model-thinking">
                <span>Thinking</span>
                <div className="composer-model-thinking-toggle" role="group" aria-label="Thinking mode">
                  <button
                    type="button"
                    className={cn(!thinkingOn && 'selected')}
                    onClick={() => setThinking(false)}
                    disabled={!laneSupportsThinking(activeLane, models) && !thinkingOn}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    className={cn(thinkingOn && 'selected')}
                    onClick={() => setThinking(true)}
                    disabled={!laneSupportsThinking(activeLane, models)}
                  >
                    On
                  </button>
                </div>
              </div>
              {thinkingOn ? (
                <div className="composer-model-thinking-active">
                  <Check size={13} aria-hidden="true" />
                  <span>{composerTriggerLabel(activeLane, true)}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>,
        document.body
      ) : null}
    </>
  );
}