import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Sheet(props: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  full?: boolean;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={'sheet' + (props.full ? ' full' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-head">
          {props.onBack && (
            <button className="icon-btn" style={{ marginLeft: -12 }} onClick={props.onBack} aria-label="Back">
              <Icon name="left" />
            </button>
          )}
          <h2>{props.title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
        {props.foot && <div className="sheet-foot">{props.foot}</div>}
      </div>
    </div>
  );
}
