import React from 'react';
import { config } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowTrendDown,
  faArrowTrendUp,
  faArrowsRotate,
  faAward,
  faBars,
  faBatteryHalf,
  faBell,
  faBolt,
  faBriefcase,
  faBuilding,
  faBullseye,
  faCalendarDays,
  faCamera,
  faChartColumn,
  faChartPie,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faCircleQuestion,
  faCircleXmark,
  faClipboardList,
  faClock,
  faCloudArrowUp,
  faCoins,
  faCommentDots,
  faCopy,
  faDatabase,
  faDollarSign,
  faDownload,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFaceSmile,
  faFile,
  faFileLines,
  faFilter,
  faFloppyDisk,
  faFolderOpen,
  faFolderTree,
  faGaugeHigh,
  faGear,
  faGift,
  faHeart,
  faHeartPulse,
  faHouse,
  faInbox,
  faLightbulb,
  faLock,
  faMagnifyingGlass,
  faPaperPlane,
  faPause,
  faPenToSquare,
  faPhone,
  faPlay,
  faPlus,
  faRightFromBracket,
  faRobot,
  faShieldHalved,
  faSliders,
  faSquareCheck,
  faTrash,
  faTriangleExclamation,
  faUpload,
  faUser,
  faUserPlus,
  faUserXmark,
  faUsers,
  faXmark
} from '@fortawesome/free-solid-svg-icons';

config.autoAddCss = false;

function makeIcon(icon) {
  return function Icon({ size, style, ...props }) {
    return <FontAwesomeIcon icon={icon} {...props} style={size ? { height: size, ...style } : style} />;
  };
}

export const Activity = makeIcon(faHeartPulse);
export const AlertCircle = makeIcon(faCircleExclamation);
export const AlertTriangle = makeIcon(faTriangleExclamation);
export const Award = makeIcon(faAward);
export const BarChart3 = makeIcon(faChartColumn);
export const Battery = makeIcon(faBatteryHalf);
export const Bell = makeIcon(faBell);
export const Bot = makeIcon(faRobot);
export const Briefcase = makeIcon(faBriefcase);
export const Building2 = makeIcon(faBuilding);
export const Calendar = makeIcon(faCalendarDays);
export const Camera = makeIcon(faCamera);
export const Check = makeIcon(faCheck);
export const CheckCircle = makeIcon(faCircleCheck);
export const CheckSquare = makeIcon(faSquareCheck);
export const ChevronDown = makeIcon(faChevronDown);
export const ChevronLeft = makeIcon(faChevronLeft);
export const ChevronRight = makeIcon(faChevronRight);
export const ChevronUp = makeIcon(faChevronUp);
export const Clock = makeIcon(faClock);
export const Clock3 = makeIcon(faClock);
export const CloudUpload = makeIcon(faCloudArrowUp);
export const Coins = makeIcon(faCoins);
export const Copy = makeIcon(faCopy);
export const Database = makeIcon(faDatabase);
export const Document = makeIcon(faFile);
export const DollarSign = makeIcon(faDollarSign);
export const Download = makeIcon(faDownload);
export const Edit = makeIcon(faPenToSquare);
export const Eye = makeIcon(faEye);
export const EyeOff = makeIcon(faEyeSlash);
export const FileText = makeIcon(faFileLines);
export const Filter = makeIcon(faFilter);
export const Folder = makeIcon(faFolderOpen);
export const FolderKanban = makeIcon(faFolderTree);
export const Gift = makeIcon(faGift);
export const Heart = makeIcon(faHeart);
export const HelpCircle = makeIcon(faCircleQuestion);
export const Home = makeIcon(faHouse);
export const Idea = makeIcon(faLightbulb);
export const Inbox = makeIcon(faInbox);
export const Info = makeIcon(faCircleInfo);
export const LayoutDashboard = makeIcon(faGaugeHigh);
export const Lock = makeIcon(faLock);
export const LogOut = makeIcon(faRightFromBracket);
export const Mail = makeIcon(faEnvelope);
export const Menu = makeIcon(faBars);
export const MessageCircle = makeIcon(faCommentDots);
export const MoreVertical = makeIcon(faEllipsisVertical);
export const Pause = makeIcon(faPause);
export const Phone = makeIcon(faPhone);
export const PieChart = makeIcon(faChartPie);
export const Play = makeIcon(faPlay);
export const Plus = makeIcon(faPlus);
export const RefreshCw = makeIcon(faArrowsRotate);
export const Save = makeIcon(faFloppyDisk);
export const Search = makeIcon(faMagnifyingGlass);
export const Send = makeIcon(faPaperPlane);
export const Settings = makeIcon(faGear);
export const Settings2 = makeIcon(faSliders);
export const Shield = makeIcon(faShieldHalved);
export const Smile = makeIcon(faFaceSmile);
export const Target = makeIcon(faBullseye);
export const Tasks = makeIcon(faClipboardList);
export const Trash2 = makeIcon(faTrash);
export const TrendingDown = makeIcon(faArrowTrendDown);
export const TrendingUp = makeIcon(faArrowTrendUp);
export const Upload = makeIcon(faUpload);
export const User = makeIcon(faUser);
export const UserPlus = makeIcon(faUserPlus);
export const UserX = makeIcon(faUserXmark);
export const Users = makeIcon(faUsers);
export const X = makeIcon(faXmark);
export const XCircle = makeIcon(faCircleXmark);
export const Zap = makeIcon(faBolt);
