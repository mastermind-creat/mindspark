
export type AppName = 'Mood Palette' | 'Decision Spinner' | 'Focus Timer' | 'Emoji Story' | 'Gratitude Journal';

export interface AppInfo {
  name: AppName;
  icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  component: () => JSX.Element;
}

export interface GratitudeEntry {
  id: number;
  date: string;
  text: string;
  rewrittenText?: string;
}
