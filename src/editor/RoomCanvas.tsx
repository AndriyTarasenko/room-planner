import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { type DragEvent as ReactDragEvent, useEffect, useMemo, useRef } from 'react';
import { Group, Layer, Stage, Transformer } from 'react-konva';
import { analyzeLayoutCached } from '../furniture/analysis';
import { centeredViewport, clampZoom, panForZoom, viewToWorld } from '../geometry/viewport';
import { useElementSize } from '../hooks/useElementSize';
import { projectStore, selectItems, useEditor } from '../store';
import { FurnitureNode } from './FurnitureNode';
import { LabelsLayer } from './LabelsLayer';
import { RoomDimensions, SelectionMeasurements, SnapGuides } from './MeasurementsLayer';
import { RoomLayer } from './RoomLayer';
import { ClearanceZones, ConflictRegions, DeskGuides } from './ZoneLayers';
import { CANVAS, CANVAS_PADDING } from './theme';
import { useUi } from './uiStore';

export const PRESET_DRAG_TYPE = 'application/x-room-planner-preset';

const RESIZE_ANCHORS = ['middle-left', 'middle-right', 'top-center', 'bottom-center'];
const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

/** The 2D top-down editor: room, furniture, and all visual feedback. */
export function RoomCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const size = useElementSize(containerRef);

  const room = useEditor((s) => s.room);
  const items = useEditor(selectItems);
  const settings = useEditor((s) => s.settings);
  const selectedId = useEditor((s) => s.selectedId);
  const projectRevision = useEditor((s) => s.projectRevision);
  const activeLayoutId = useEditor((s) => s.activeLayoutId);
  const zoom = useUi((s) => s.zoom);
  const pan = useUi((s) => s.pan);
  const guides = useUi((s) => s.guides);

  const vp = useMemo(
    () => centeredViewport(room, size.width, size.height, CANVAS_PADDING, zoom),
    [room, size.width, size.height, zoom],
  );
  const analysis = analyzeLayoutCached(items, room);
  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined;

  // Floor items first, surface items (monitors…) always on top of them.
  const ordered = useMemo(
    () => [...items.filter((i) => i.placement === 'floor'), ...items.filter((i) => i.placement === 'surface')],
    [items],
  );

  useEffect(() => {
    useUi.getState().resetView();
  }, [projectRevision]);

  // Attach the transformer to the selected node.
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, items, activeLayoutId]);

  const deselectIfBackground = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const target = e.target;
    if (target === target.getStage() || target.name() === 'floor') projectStore.getState().select(null);
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
    const after = centeredViewport(room, size.width, size.height, CANVAS_PADDING, nextZoom);
    useUi.getState().setView(nextZoom, panForZoom(pointer, pan, vp, after));
  };

  const handleStageDrag = (e: KonvaEventObject<DragEvent>) => {
    const stage = stageRef.current;
    if (stage && e.target === stage) useUi.getState().setPan({ x: stage.x(), y: stage.y() });
  };

  // Drag & drop from the furniture library.
  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(PRESET_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handleDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const presetId = e.dataTransfer.getData(PRESET_DRAG_TYPE);
    const stage = stageRef.current;
    if (!presetId || !stage) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const world = viewToWorld({ x: pointer.x - pan.x, y: pointer.y - pan.y }, vp);
    projectStore.getState().addPreset(presetId, world);
  };

  const ready = size.width > 0 && size.height > 0;

  return (
    <div
      ref={containerRef}
      className="canvas-host"
      style={{ background: CANVAS.background }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
            <Group x={vp.originX} y={vp.originY} scaleX={vp.scale} scaleY={vp.scale}>
              <RoomLayer room={room} settings={settings} scale={vp.scale} />
              {settings.showClearances && <ClearanceZones items={items} analysis={analysis} room={room} />}
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
            </Group>
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={RESIZE_ANCHORS}
              rotationSnaps={ROTATION_SNAPS}
              rotationSnapTolerance={4}
              rotateAnchorOffset={22}
              keepRatio={false}
              flipEnabled={false}
              ignoreStroke
              anchorSize={8}
              anchorCornerRadius={2}
              anchorStroke={CANVAS.accent}
              anchorFill="#ffffff"
              borderStroke={CANVAS.accent}
              borderStrokeWidth={1}
              padding={0}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
            />
          </Layer>
          <Layer listening={false}>
            <LabelsLayer items={ordered} vp={vp} />
            <RoomDimensions room={room} vp={vp} />
            {selected && settings.showMeasurements && (
              <SelectionMeasurements item={selected} items={items} room={room} vp={vp} />
            )}
            <SnapGuides guides={guides} vp={vp} />
          </Layer>
        </Stage>
      )}
    </div>
  );
}
