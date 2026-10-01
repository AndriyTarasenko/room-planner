import { AppWindow, DoorOpen, House, PanelTopDashed, PencilRuler, Ruler } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OpeningKind } from '../types';

export const ROOM_ICON = <House size={16} />;
export const DRAW_ICON = <PencilRuler size={16} />;
export const MEASURE_ICON = <Ruler size={16} />;

export const OPENING_ICONS: Record<OpeningKind, ReactNode> = {
  door: <DoorOpen size={15} />,
  window: <AppWindow size={15} />,
  passage: <PanelTopDashed size={15} />,
};
