import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/* Modal plumbing shared by sheets and the workout logger. */

const stack: { escape: () => void }[] = [];
let suppressClicksUntil = 0;

// When a sheet opens or closes on a tap, a quick second tap would land on whatever is now under the
// finger (a tab, "Log food", "Discard"…). Swallow clicks for a moment after any modal opens or closes.
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

/*
 * Back button. While any modal is open, the current history entry is a marker entry. Back leaves
 * it, which closes the topmost modal (the marker comes back if others stay open). Closing the last
 * modal any other way steps back off the marker, unless another modal opened meanwhile (one sheet
 * replacing another), in which case the marker is reused.
 */
const isMarker = (st: unknown) => !!st && typeof st === 'object' && (st as any).logbookModal === true;
let ignorePopUntil = 0;
const stepBack = () => {
  ignorePopUntil = Date.now() + 600;
  history.back();
};
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (Date.now() < ignorePopUntil) {
      ignorePopUntil = 0;
      return;
    }
    if (stack.length) {
      stack[stack.length - 1].escape();
      setTimeout(() => {
        if (stack.length && !isMarker(history.state)) history.pushState({ logbookModal: true }, '');
      }, 60);
    } else if (isMarker(e.state)) {
      stepBack(); // landed on a leftover marker (e.g. via Forward): skip it
    }
  });
}
const modalOpened = () => {
  if (!isMarker(history.state)) history.pushState({ logbookModal: true }, '');
};
const modalClosed = () => {
  setTimeout(() => {
    if (stack.length === 0 && isMarker(history.state)) stepBack();
  }, 60);
};

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Makes `ref` behave as a modal: takes focus when it opens, keeps Tab inside it, closes on Escape,
 * and hands focus back when it closes. Only the topmost open modal reacts to keys.
 */
export function useModal(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  // Read during the first render, before any autoFocus field inside the modal takes focus.
  const [previouslyFocused] = useState(() => (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null));

  useEffect(() => {
    const token = { escape: () => escape.current() };
    stack.push(token);
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus();
    // The second tap of a double tap must not land on whatever the modal put under the finger.
    suppressClicksUntil = Date.now() + 350;
    // The phone's Back button closes the modal instead of changing the page underneath.
    modalOpened();

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
    // Screen readers and Tab should not reach the page behind an open modal.
    const behind = [...document.querySelectorAll<HTMLElement>('.app, .tabbar')];
    behind.forEach((b) => b.setAttribute('inert', ''));
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
      modalClosed();
      document.body.style.overflow = prevOverflow;
      if (stack.length === 0) behind.forEach((b) => b.removeAttribute('inert'));
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

  // Drawn at the top of the page, outside the screen it was opened from, so the screen can be made inert.
  return createPortal(
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
    </div>,
    document.body,
  );
}
