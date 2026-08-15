import {
  IconArrowUpRight,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandPinterest,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandYoutube,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconHome,
  IconMail,
  IconMenu2,
  IconMessageCircle,
  IconMoodEmpty,
  IconMoon,
  IconPlayerPlayFilled,
  IconSearch,
  IconSun,
  IconX,
  type IconProps,
} from "@tabler/icons-react";

// The public site uses Tabler Icons exactly as specified in the design system (24×24 grid,
// stroke 2, round caps/joins). Colour/fill are never hard-set here — icons inherit currentColor
// from the parent, so a text-colour utility drives them (per the design's "colour bound to a
// style, never a raw fill" rule). Thin wrappers keep our call sites (`size` prop, default 20)
// stable and force stroke 2 + aria-hidden.

type P = Partial<IconProps>;
const wrap =
  (Icon: (props: IconProps) => React.ReactNode) =>
  ({ size = 20, ...props }: P) =>
    <Icon size={size} stroke={2} aria-hidden {...props} />;

export const Search = wrap(IconSearch);
export const Menu = wrap(IconMenu2);
export const Close = wrap(IconX);
export const ChevronDown = wrap(IconChevronDown);
export const ChevronRight = wrap(IconChevronRight);
export const ChevronLeft = wrap(IconChevronLeft);
export const ArrowUpRight = wrap(IconArrowUpRight);
export const Sun = wrap(IconSun);
export const Moon = wrap(IconMoon);
export const Mail = wrap(IconMail);
export const MoodEmpty = wrap(IconMoodEmpty);
export const Play = wrap(IconPlayerPlayFilled);

export const MessageCircle = wrap(IconMessageCircle);
export const Clock = wrap(IconClock);
export const Home = wrap(IconHome);

export const Facebook = wrap(IconBrandFacebook);
export const XMark = wrap(IconBrandX);
export const Instagram = wrap(IconBrandInstagram);
export const WhatsApp = wrap(IconBrandWhatsapp);
export const YouTube = wrap(IconBrandYoutube);
export const LinkedIn = wrap(IconBrandLinkedin);
export const Pinterest = wrap(IconBrandPinterest);

export const SOCIAL = [
  { name: "Facebook", Icon: Facebook, href: "#" },
  { name: "X", Icon: XMark, href: "#" },
  { name: "Instagram", Icon: Instagram, href: "#" },
  { name: "WhatsApp", Icon: WhatsApp, href: "#" },
  { name: "YouTube", Icon: YouTube, href: "#" },
] as const;
