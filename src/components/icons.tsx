type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function StudentsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function TeachersIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 7a1 1 0 0 1 .55-.89l8-4a1 1 0 0 1 .9 0l8 4A1 1 0 0 1 21 7v.5" />
      <path d="m3 7 9 4.5L21 7" />
      <path d="M7 9.5V14c0 1.5 2.2 3 5 3s5-1.5 5-3V9.5" />
      <path d="M21 7v6" />
    </svg>
  );
}

export function HeadTeacherIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 10.5V14c0 2 3 4 6 4s6-2 6-4v-3.5" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function AdminIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
