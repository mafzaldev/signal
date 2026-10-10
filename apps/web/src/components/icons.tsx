import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowDownIcon as PhArrowDown,
  ArrowLeftIcon as PhArrowLeft,
  ArrowRightIcon as PhArrowRight,
  ArrowUpIcon as PhArrowUp,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon as PhCheck,
  ClockCounterClockwiseIcon,
  CopyIcon as PhCopy,
  EyeIcon as PhEye,
  EyeSlashIcon as PhEyeSlash,
  FlagIcon as PhFlag,
  FolderIcon as PhFolder,
  GearIcon,
  KeyIcon as PhKey,
  ListIcon,
  MagnifyingGlassIcon,
  PlusIcon as PhPlus,
  SignOutIcon,
  TrashIcon as PhTrash,
  UsersIcon as PhUsers,
  XIcon as PhX,
} from '@phosphor-icons/react/dist/ssr';

/** Phosphor icons, decorative and 16px unless the caller sizes them. Bold, because the
 * regular weight's hairline strokes blur at 16px on standard-density screens. */
function icon(Component: Icon) {
  return function AppIcon({ className = 'size-4', ...props }: IconProps) {
    return <Component aria-hidden="true" weight="bold" className={className} {...props} />;
  };
}

export const PlusIcon = icon(PhPlus);
export const SearchIcon = icon(MagnifyingGlassIcon);
export const ChevronDownIcon = icon(CaretDownIcon);
export const ChevronRightIcon = icon(CaretRightIcon);
export const ArrowUpIcon = icon(PhArrowUp);
export const ArrowDownIcon = icon(PhArrowDown);
export const ArrowLeftIcon = icon(PhArrowLeft);
export const ArrowRightIcon = icon(PhArrowRight);
export const FlagIcon = icon(PhFlag);
export const SettingsIcon = icon(GearIcon);
export const HistoryIcon = icon(ClockCounterClockwiseIcon);
export const LogOutIcon = icon(SignOutIcon);
export const CopyIcon = icon(PhCopy);
export const EyeIcon = icon(PhEye);
export const EyeSlashIcon = icon(PhEyeSlash);
export const CheckIcon = icon(PhCheck);
export const XIcon = icon(PhX);
export const TrashIcon = icon(PhTrash);
export const UsersIcon = icon(PhUsers);
export const MenuIcon = icon(ListIcon);
export const FolderIcon = icon(PhFolder);
export const KeyIcon = icon(PhKey);
