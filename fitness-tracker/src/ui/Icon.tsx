const PATHS: Record<string, string> = {
  today: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  train: 'M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11',
  food: 'M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 2-3 4.5-3 8h3zm0 0v18',
  progress: 'M4 20V4M4 20h16M7.5 15l4-4.5 3 2.5 5-6.5',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 4.5h4v5h-4zM7 14.5h4v5H7z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  left: 'M14.5 5l-7 7 7 7',
  right: 'M9.5 5l7 7-7 7',
  up: 'M6 14.5l6-6 6 6',
  down: 'M6 9.5l6 6 6-6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  search: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13zM15.5 15.5L20 20',
  barcode: 'M4 6v12M7.5 6v12M11 6v12M13.5 6v12M17 6v12M20 6v12',
  camera: 'M4 8h4l1.5-2.5h5L16 8h4v11H4zM12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
};

export function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
