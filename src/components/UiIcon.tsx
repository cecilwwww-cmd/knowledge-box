const paths = {
  search: 'm16.5 16.5 4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  note: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h6',
  box: 'm12 2 9 5v10l-9 5-9-5V7Zm-9 5 9 5 9-5m-9 5v10',
  down: 'm6 9 6 6 6-6',
  collapse: 'm11 6-6 6 6 6m7-12-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M12 20V4m-7 7 7-7 7 7',
  sparkle: 'm10 3 1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8Zm8 11 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z',
  pencil: 'm13.5 6.5 4 4M4 20l4.4-.9L20 7.5a1.4 1.4 0 0 0 0-2l-1.5-1.5a1.4 1.4 0 0 0-2 0L5 15.6Z',
  copy: 'M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2ZM5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
} as const

export function UiIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}
