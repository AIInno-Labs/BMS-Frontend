import Image from "next/image";

/** FRP brand lockup — trimmed asset with excess canvas padding removed. */

const LOCKUP_SRC = "/frp-logo-lockup-trimmed.png";
const LOCKUP_WIDTH = 573;
const LOCKUP_HEIGHT = 258;

const LOCKUP_CLASS = {
  default: "h-14 w-auto shrink-0 sm:h-16",
  header: "h-14 w-auto shrink-0 sm:h-16",
  sidebar: "h-auto w-[56%] max-w-none origin-left",
} as const;

export function FrpLogo({
  className,
  variant = "icon",
  size = "default",
}: {
  className?: string;
  /** `lockup` = full mark + FRP / ENGINEERING. `icon` = mark only (cropped from lockup). */
  variant?: "icon" | "lockup";
  /** `sidebar` = fills the nav rail width. */
  size?: "default" | "header" | "sidebar";
}) {
  if (variant === "lockup") {
    return (
      <Image
        src={LOCKUP_SRC}
        alt="FRP Engineering"
        width={LOCKUP_WIDTH}
        height={LOCKUP_HEIGHT}
        sizes={size === "sidebar" ? "256px" : "200px"}
        className={`object-contain object-left ${LOCKUP_CLASS[size]} ${className ?? ""}`}
        priority
      />
    );
  }

  return (
    <Image
      src={LOCKUP_SRC}
      alt=""
      width={40}
      height={40}
      className={`h-9 w-9 shrink-0 object-cover object-left ${className ?? ""}`}
      aria-hidden
    />
  );
}
