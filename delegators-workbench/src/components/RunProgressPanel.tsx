import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { WorkbenchProgressItem } from '../lib/shared';

interface RunProgressPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  planTitle?: string;
  planItems: WorkbenchProgressItem[];
  activityLog: string[];
}

function statusDot(status: WorkbenchProgressItem['status']): string {
  if (status === 'done') return 'done';
  if (status === 'active') return 'active';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

export function RunProgressPanel({
  open,
  onClose,
  title,
  planTitle,
  planItems,
  activityLog,
}: RunProgressPanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="progress-scrim"
            aria-label="Close run progress"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="run-progress-panel"
            role="dialog"
            aria-label="Harness progress"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="run-progress-head">
              <div>
                <small>Read-only · agent keeps running</small>
                <strong>{title}</strong>
              </div>
              <button type="button" className="quiet-icon" onClick={onClose} title="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            {planTitle ? <p className="run-progress-plan">{planTitle}</p> : null}

            {planItems.length > 0 ? (
              <ol className="run-progress-steps" aria-label="Plan steps">
                {planItems.map((item) => (
                  <li key={item.id} className={statusDot(item.status)}>
                    <span className="run-step-dot" aria-hidden="true" />
                    <span className="run-step-copy">
                      <strong>{item.label}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}

            {activityLog.length > 0 ? (
              <div className="run-progress-log" aria-label="Live harness log">
                <span className="run-progress-log-label">Live trace</span>
                <ol>
                  {activityLog.map((line, index) => (
                    <li key={`${index}-${line.slice(0, 24)}`}>
                      <span className="run-step-dot" aria-hidden="true" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="run-progress-empty">Waiting for the next harness update…</p>
            )}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}