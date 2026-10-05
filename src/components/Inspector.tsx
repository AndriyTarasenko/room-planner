import type { ReactNode } from 'react';
import { selectSelectedItem, selectSelectedOpening, selectSelectedOpeningRoom, selectSelectedRoom, useEditor } from '../store';
import { ItemInspector } from './ItemInspector';
import { LayoutOverview } from './LayoutOverview';
import { OpeningInspector } from './OpeningInspector';
import { RoomInspector } from './RoomInspector';

/** Properties of whatever is selected (an object, a room, or a door or window), else `fallback`. */
export function SelectionInspector({ fallback = null }: { fallback?: ReactNode }) {
  const item = useEditor(selectSelectedItem);
  const room = useEditor(selectSelectedRoom);
  const opening = useEditor(selectSelectedOpening);
  const openingRoom = useEditor(selectSelectedOpeningRoom);
  if (item) return <ItemInspector key={item.id} item={item} />;
  if (room) return <RoomInspector key={room.id} room={room} />;
  if (opening && openingRoom) return <OpeningInspector key={opening.id} opening={opening} room={openingRoom} />;
  return fallback;
}

/** The right panel: whatever is selected, or the layout overview. */
export const Inspector = () => <SelectionInspector fallback={<LayoutOverview />} />;
