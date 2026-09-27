import { useRef, useState } from "react";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/hooks/use-sidebar-width";
import { cn } from "@/lib/utils";

const KEY_STEP = 16;

/**
 * Drag handle on the sidebar's right edge. Drag (mouse or touch) to resize, arrow keys
 * for keyboard users, Home/End for min/max, double-click to restore the default width.
 */
export function SidebarResizeHandle({
  width,
  onResize,
  onResizingChange,
}: {
  width: number;
  onResize: (width: number) => void;
  onResizingChange?: (resizing: boolean) => void;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const setResizing = (value: boolean) => {
    setDragging(value);
    onResizingChange?.(value);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, width };
        setResizing(true);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onResize(start.current.width + e.clientX - start.current.x);
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        start.current = null;
        setResizing(false);
      }}
      onPointerCancel={() => {
        start.current = null;
        setResizing(false);
      }}
      onDoubleClick={() => onResize(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={(e) => {
        const next =
          e.key === "ArrowLeft"
            ? width - KEY_STEP
            : e.key === "ArrowRight"
              ? width + KEY_STEP
              : e.key === "Home"
                ? SIDEBAR_MIN_WIDTH
                : e.key === "End"
                  ? SIDEBAR_MAX_WIDTH
                  : null;
        if (next === null) return;
        e.preventDefault();
        onResize(next);
      }}
      className={cn(
        "group absolute inset-y-0 -right-1.5 z-50 flex w-3 cursor-col-resize touch-none justify-center outline-none",
      )}
    >
      <span
        className={cn(
          "h-full w-0.5 transition-colors group-hover:bg-sidebar-primary/70 group-focus-visible:bg-sidebar-primary",
          dragging && "bg-sidebar-primary",
        )}
      />
    </div>
  );
}
