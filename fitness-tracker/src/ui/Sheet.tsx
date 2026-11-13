import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from './Icon';

/* Modal plumbing shared by sheets and the workout logger. */

const stack: object[] = [];
let suppressClicksUntil = 0;

// When a sheet closes on a tap, a quick second tap would land on whatever was underneath
// (a tab, "Log food", …). Swallow clicks for a moment after any modal closes.
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      if (Date.now() < suppressClicksUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Makes `ref` behave as a modal: takes focus when it opens, keeps Tab inside it, closes on Escape,
 * and hands focus back when it closes. Only the topmost open modal reacts to keys.
 */
export function useModal(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;

  useEffect(() => {
    const token = {};
    stack.push(token);
    const el = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (el && !el.contains(document.activeElement)) el.focus();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token || !el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        escape.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement;
      if (!el.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      suppressClicksUntil = Date.now() + 350;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // Run once per open: re-running on every render would steal focus from the field being typed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Sheet(props: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  full?: boolean;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, props.onClose);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
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
          <button className="icon-btn" onClick={props.onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
        {props.foot && <div className="sheet-foot">{props.foot}</div>}
      </div>
    </div>
  );
}
