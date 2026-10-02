import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { type DragEvent as ReactDragEvent, useEffect, useMemo, useRef } from 'react';
import { Group, Layer, Stage } from 'react-konva';
import { PRODUCT_DRAG_TYPE, droppedProduct, placeProduct } from '../catalog/placeProduct';
import { analyzeLayoutCached } from '../furniture/analysis';
import { centeredViewport, clampZoom, panForZoom, viewToWorld } from '../geometry/viewport';
import { useElementSize } from '../hooks/useElementSize';
import { planExtent } from '../plan/openings';
import { roomContaining } from '../plan/rooms';
import {
  projectStore,
  selectItems,
  selectRooms,
  selectSelectedOpening,
  selectSelectedOpeningRoom,
  selectSelectedRoom,
  useEditor,
} from '../store';
import { DraftCapture, DraftLabels, DraftOutline } from './DraftLayer';
import { FurnitureNode } from './FurnitureNode';
import { ItemTransformer, RotationReadout } from './ItemTransformer';
import { LShapeHandles } from './LShapeHandles';
import { LabelsLayer } from './LabelsLayer';
import { OpeningMeasurements, RoomDimensions, SelectionMeasurements, SnapGuides } from './MeasurementsLayer';
import { OpeningNode } from './OpeningNode';
import { RoomFloors, RoomLabels, RoomWalls } from './PlanLayer';
import { RoomHandles } from './RoomHandles';
import { RulerCapture, RulerOverlay } from './RulerLayer';
import { ClearanceZones, ConflictRegions, DeskGuides } from './ZoneLayers';
import { PLAN_DRAG_TYPE, addPlanElement, droppedPlanTool } from './planTools';
import { CANVAS, CANVAS_PADDING } from './theme';
import { useUi } from './uiStore';

/** The 2D top-down editor: floor plan, furniture, and all visual feedback. */
export function RoomCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const size = useElementSize(containerRef);

  const rooms = useEditor(selectRooms);
  const items = useEditor(selectItems);
  const settings = useEditor((s) => s.settings);
  const selectedId = useEditor((s) => s.selectedId);
  const selectedRoom = useEditor(selectSelectedRoom);
  const selectedOpening = useEditor(selectSelectedOpening);
  const openingRoom = useEditor(selectSelectedOpeningRoom);
  const projectRevision = useEditor((s) => s.projectRevision);
  const activeLayoutId = useEditor((s) => s.activeLayoutId);
  const zoom = useUi((s) => s.zoom);
  const pan = useUi((s) => s.pan);
  const frozenBox = useUi((s) => s.fitBox);
  const guides = useUi((s) => s.guides);
  const drawing = useUi((s) => s.tool === 'draw');
  const measuring = useUi((s) => s.tool === 'measure');
  const rotatingId = useUi((s) => s.rotatingId);

  const liveBox = useMemo(() => planExtent(rooms), [rooms]);
  const fitBox = frozenBox ?? liveBox;
  const vp = useMemo(
    () => centeredViewport(fitBox, size.width, size.height, CANVAS_PADDING, zoom),
    [fitBox, size.width, size.height, zoom],
  );
  const analysis = analyzeLayoutCached(items, rooms);
  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;
  // L-shaped items are sized by their arms' own handles instead of the transformer's box.
  const selectedL = selected?.shape.kind === 'l' ? { ...selected, shape: selected.shape } : null;
  const rotating = selected && selected.id === rotatingId ? selected : null;
  // Room sizes are shown for the selected room, and always when the plan has a single room.
  const dimensionRoom = selectedRoom ?? (!selectedOpening && rooms.length === 1 ? rooms[0] : null);

  // Floor items first, surface items (monitors…) always on top of them.
  const ordered = useMemo(
    () => [...items.filter((i) => i.placement === 'floor'), ...items.filter((i) => i.placement === 'surface')],
    [items],
  );

  useEffect(() => {
    useUi.getState().resetView();
  }, [projectRevision]);

  useEffect(() => {
    useUi.getState().setLiveBox(liveBox);
  }, [liveBox]);

  // While measuring, the left button measures; only the middle button pans.
  useEffect(() => {
    if (!measuring) return;
    const previous = Konva.dragButtons;
    Konva.dragButtons = [1];
    return () => {
      Konva.dragButtons = previous;
    };
  }, [measuring]);

  // With nothing selected, new furniture goes into the room in the middle of the view.
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const center = viewToWorld({ x: size.width / 2 - pan.x, y: size.height / 2 - pan.y }, vp);
    const room = roomContaining(center, rooms);
    if (room) projectStore.getState().focusRoom(room.id);
  }, [vp, pan, size.width, size.height, rooms]);

  // Attach the transformer to the selected furniture (rooms and openings have their own handles).
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const node = selected ? stage.findOne(`#${selected.id}`) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selected, items, activeLayoutId]);

  const deselectIfBackground = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) projectStore.getState().select(null);
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels in larger steps.
    const factor = e.evt.ctrlKey ? Math.exp(-e.evt.deltaY * 0.01) : e.evt.deltaY > 0 ? 1 / 1.15 : 1.15;
    const nextZoom = clampZoom(zoom * factor);
    if (nextZoom === zoom) return;
    const after = centeredViewport(fitBox, size.width, size.height, CANVAS_PADDING, nextZoom);
    useUi.getState().setView(nextZoom, panForZoom(pointer, pan, vp, after));
  };

  const handleStageDrag = (e: KonvaEventObject<DragEvent>) => {
    const stage = stageRef.current;
    if (stage && e.target === stage) useUi.getState().setPan({ x: stage.x(), y: stage.y() });
  };

  // Drag & drop from the furniture browser and the floor plan tools.
  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    const types = e.dataTransfer.types;
    if (types.includes(PRODUCT_DRAG_TYPE) || types.includes(PLAN_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const product = droppedProduct(e.dataTransfer);
    const tool = droppedPlanTool(e.dataTransfer);
    const stage = stageRef.current;
    if ((!product && !tool) || !stage) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const world = viewToWorld({ x: pointer.x - pan.x, y: pointer.y - pan.y }, vp);
    if (product) placeProduct(product, world);
    else if (tool) addPlanElement(tool, world);
  };

  const ready = size.width > 0 && size.height > 0;
  const worldProps = { x: vp.originX, y: vp.originY, scaleX: vp.scale, scaleY: vp.scale };

  return (
    <div
      ref={containerRef}
      className="canvas-host"
      style={{ background: CANVAS.background, cursor: drawing || measuring ? 'crosshair' : undefined }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      // No autoscroll on a middle click: the middle button pans the plan.
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
    >
      {ready && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={pan.x}
          y={pan.y}
          draggable
          onDragMove={handleStageDrag}
          onDragEnd={handleStageDrag}
          onWheel={handleWheel}
          onClick={deselectIfBackground}
          onTap={deselectIfBackground}
        >
          <Layer>
            <Group {...worldProps}>
              <RoomFloors rooms={rooms} settings={settings} scale={vp.scale} />
            </Group>
            {/* Room names sit on the floor, under walls and furniture, at a constant screen size. */}
            <RoomLabels rooms={rooms} vp={vp} hiddenId={selectedRoom?.id ?? null} />
            <Group {...worldProps}>
              <RoomWalls rooms={rooms} scale={vp.scale} />
              {rooms.flatMap((room) =>
                room.openings.map((opening) => (
                  <OpeningNode
                    key={opening.id}
                    room={room}
                    opening={opening}
                    rooms={rooms}
                    scale={vp.scale}
                    selected={opening.id === selectedId}
                    blocked={analysis.blockedDoorIds.has(opening.id)}
                  />
                )),
              )}
              {settings.showClearances && <ClearanceZones items={items} analysis={analysis} rooms={rooms} />}
              {ordered.map((item) => (
                <FurnitureNode
                  key={item.id}
                  item={item}
                  scale={vp.scale}
                  selected={item.id === selectedId}
                  colliding={analysis.collidingIds.has(item.id)}
                  outside={analysis.outsideIds.has(item.id)}
                />
              ))}
              <DeskGuides items={items} scale={vp.scale} />
              <ConflictRegions analysis={analysis} />
              {selectedRoom && !drawing && <RoomHandles room={selectedRoom} scale={vp.scale} />}
              {selectedL && !drawing && <LShapeHandles item={selectedL} scale={vp.scale} />}
              {drawing && <DraftOutline scale={vp.scale} />}
            </Group>
            {drawing && <DraftCapture vp={vp} width={size.width} height={size.height} />}
            {measuring && <RulerCapture vp={vp} width={size.width} height={size.height} />}
          </Layer>
          <Layer listening={false}>
            <LabelsLayer items={ordered} vp={vp} />
            {dimensionRoom && <RoomDimensions room={dimensionRoom} vp={vp} inside={rooms.length > 1} />}
            {selected && settings.showMeasurements && <SelectionMeasurements item={selected} items={items} rooms={rooms} vp={vp} />}
            {selectedOpening && openingRoom && settings.showMeasurements && (
              <OpeningMeasurements room={openingRoom} opening={selectedOpening} vp={vp} />
            )}
            <SnapGuides guides={guides} vp={vp} />
            {drawing && <DraftLabels vp={vp} />}
            {measuring && <RulerOverlay vp={vp} />}
          </Layer>
          {/* Selection handles on top of labels and distances, so they are never covered. */}
          <Layer listening={!drawing && !measuring}>
            <ItemTransformer ref={transformerRef} resizable={!selectedL} />
            {rotating && <RotationReadout item={rotating} vp={vp} />}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
