interface Props {
  size?: number;
  strokeWidth?: number;
}

export const Spinner = ({ size = 16, strokeWidth = 2 }: Props) => (
  <div className="flex items-center justify-center">
    <svg
      height={size}
      stroke="currentColor"
      viewBox="0 0 40 40"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Loading</title>
      <g
        fill="none"
        fillRule="evenodd"
        strokeWidth={strokeWidth}
        transform="translate(2 2)"
      >
        <circle cx={18} cy={18} r={18} strokeOpacity={0.3} />
        <path d="M36 18c0-9.94-8.06-18-18-18">
          <animateTransform
            attributeName="transform"
            dur="1s"
            from="0 18 18"
            repeatCount="indefinite"
            to="360 18 18"
            type="rotate"
          />
        </path>
      </g>
    </svg>
  </div>
);
