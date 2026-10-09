export default function Icon({ name, ...props }) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    bag: (
      <>
        <path d="M6 7h12l1 14H5L6 7Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
    heart: <path d="m12 20-8-8a5 5 0 0 1 7-7l1 1 1-1a5 5 0 0 1 7 7l-8 8Z" />,
    arrow: (
      <>
        <path d="M4 12h15M13 6l6 6-6 6" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    flower: (
      <>
        <path d="M12 9c-7-11-12 1-5 3-8 7 4 12 5 5 5 9 13-1 6-5 7-6-3-11-6-3Z" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C4 1 1 17 10 19c8 2 11-7 10-15Z" />
        <path d="M4 22 16 10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
