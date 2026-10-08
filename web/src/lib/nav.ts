import {
  LayoutDashboard, CalendarDays, ListTodo, Radar, Dumbbell, Salad, Droplets, Ruler, HeartPulse, Sparkles, GraduationCap, Languages, BookOpenText, Pill,
  Gem, Camera, Rocket, Lightbulb, Landmark, PiggyBank, Wallet, TrendingUp, Building2, BedDouble, Heart, Plane, CalendarCheck2, Images, NotebookPen,
  FolderOpen, Target, ClipboardCheck, BarChart3, Bot, User, Palette, Bell, Plug, ShieldCheck, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { key: 'calendar', label: 'My Calendar', path: '/calendar', icon: CalendarDays },
      { key: 'tasks', label: 'My Tasks', path: '/tasks', icon: ListTodo },
      { key: 'command', label: 'Command Center', path: '/command', icon: Radar },
    ],
  },
  {
    label: 'Wellness',
    items: [
      { key: 'fitness', label: 'Fitness', path: '/fitness', icon: Dumbbell },
      { key: 'nutrition', label: 'Nutrition', path: '/nutrition', icon: Salad },
      { key: 'water', label: 'Water Tracker', path: '/water', icon: Droplets },
      { key: 'body', label: 'Body Progress', path: '/body', icon: Ruler },
      { key: 'wellness', label: 'Wellness', path: '/wellness', icon: HeartPulse },
      { key: 'beauty', label: 'Beauty & Self-Care', path: '/beauty', icon: Sparkles },
    ],
  },
  {
    label: 'Studies & Career',
    items: [
      { key: 'studies', label: 'My Master', path: '/studies', icon: GraduationCap },
      { key: 'toeic', label: 'TOEIC Academy', path: '/toeic', icon: Languages },
      { key: 'thesis', label: 'Master Thesis', path: '/thesis', icon: BookOpenText },
      { key: 'pharmacy', label: 'Pharmacy Work', path: '/pharmacy', icon: Pill },
    ],
  },
  {
    label: 'Business',
    items: [
      { key: 'lash', label: 'Lash Studio', path: '/lash', icon: Gem },
      { key: 'instagram', label: 'Instagram Manager', path: '/instagram', icon: Camera },
      { key: 'entrepreneurship', label: 'Entrepreneurship', path: '/entrepreneurship', icon: Rocket },
      { key: 'ideas', label: 'Business Ideas', path: '/ideas', icon: Lightbulb },
    ],
  },
  {
    label: 'Money',
    items: [
      { key: 'banks', label: 'My Banks', path: '/banks', icon: Landmark },
      { key: 'budget', label: 'Budget', path: '/budget', icon: Wallet },
      { key: 'savings', label: 'Savings', path: '/savings', icon: PiggyBank },
      { key: 'investments', label: 'Investments', path: '/investments', icon: TrendingUp },
      { key: 'realestate', label: 'Real Estate', path: '/real-estate', icon: Building2 },
      { key: 'airbnb', label: 'Airbnb', path: '/airbnb', icon: BedDouble },
    ],
  },
  {
    label: 'Lifestyle',
    items: [
      { key: 'wishlist', label: 'Wishlist', path: '/wishlist', icon: Heart },
      { key: 'travel', label: 'Travel Planner', path: '/travel', icon: Plane },
      { key: 'habits', label: 'Habit Tracker', path: '/habits', icon: CalendarCheck2 },
      { key: 'vision', label: 'Vision Board', path: '/vision', icon: Images },
      { key: 'journal', label: 'Personal Journal', path: '/journal', icon: NotebookPen },
    ],
  },
  {
    label: 'Organization',
    items: [
      { key: 'resources', label: 'Resource Hub', path: '/resources', icon: FolderOpen },
      { key: 'goals', label: 'Goals', path: '/goals', icon: Target },
      { key: 'review', label: 'Monthly Review', path: '/review', icon: ClipboardCheck },
      { key: 'analytics', label: 'Life Analytics', path: '/analytics', icon: BarChart3 },
    ],
  },
  { label: 'Assistant', items: [{ key: 'ai', label: 'Jadou AI', path: '/ai', icon: Bot }] },
  {
    label: 'Settings',
    items: [
      { key: 'settings-profile', label: 'Profile', path: '/settings/profile', icon: User },
      { key: 'settings-personalization', label: 'Personalization', path: '/settings/personalization', icon: Palette },
      { key: 'settings-notifications', label: 'Notifications', path: '/settings/notifications', icon: Bell },
      { key: 'settings-integrations', label: 'Integrations', path: '/settings/integrations', icon: Plug },
      { key: 'settings-privacy', label: 'Data & Privacy', path: '/settings/privacy', icon: ShieldCheck },
    ],
  },
];

export const ALL_ITEMS = NAV.flatMap((g) => g.items);
/** modules that cannot be hidden */
export const CORE_KEYS = new Set(['dashboard', 'ai', 'settings-profile', 'settings-personalization', 'settings-notifications', 'settings-integrations', 'settings-privacy']);

/** where a record of a given resource lives in the app (used by search & links) */
export const RESOURCE_PAGE: Record<string, string> = {
  task: '/tasks', event: '/calendar', goal: '/goals', habit: '/habits', habitLog: '/habits', journalEntry: '/journal', focusSession: '/tasks', review: '/review',
  routine: '/beauty', routineLog: '/beauty', memory: '/settings/privacy', note: '/command', course: '/studies', homework: '/studies', exam: '/studies', grade: '/studies',
  groupProject: '/studies', thesisItem: '/thesis', toeicExam: '/toeic', toeicAttempt: '/toeic', toeicMistake: '/toeic', flashcard: '/toeic', exercise: '/fitness',
  workoutTemplate: '/fitness', workoutSession: '/fitness', setLog: '/fitness', foodLog: '/nutrition', recipe: '/nutrition', shoppingItem: '/nutrition', mealPlan: '/nutrition',
  waterLog: '/water', bodyMetric: '/body', wellnessLog: '/wellness', contentPost: '/pharmacy', campaign: '/pharmacy', contentAsset: '/pharmacy', socialMetric: '/pharmacy',
  inboxRequest: '/instagram', lashService: '/lash', client: '/lash', lashAppointment: '/lash', stockItem: '/lash', bankAccount: '/banks', transaction: '/banks',
  budgetLine: '/budget', savingsGoal: '/savings', savingsContribution: '/savings', investment: '/investments', property: '/real-estate', airbnbListing: '/airbnb',
  airbnbBooking: '/airbnb', messageTemplate: '/airbnb', businessIdea: '/ideas', sideHustle: '/entrepreneurship', sideHustleLog: '/entrepreneurship', wishlistItem: '/wishlist',
  beautyProduct: '/beauty', hairLog: '/beauty', trip: '/travel', tripExpense: '/travel', tripPhoto: '/travel', visionItem: '/vision', resource: '/resources', resourcePlan: '/resources',
};

export const MOBILE_TABS = ['dashboard', 'calendar', 'tasks', 'ai'];
