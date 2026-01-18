import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskDependency } from "../../tasks/api/taskApi";

type TimelineBounds = {
  min: number;
  max: number;
};

type AxisTick = {
  left: number;
  label: string;
};

type AnchorSide = "start" | "end";

type LinkPoint = {
  x: number;
  y: number;
};

type BarMetrics = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DependencyLink = {
  id: string;
  type: TaskDependency["type"];
  path: string;
  label: string;
  labelX: number;
  labelY: number;
};

const toTs = (value: string) => new Date(value).getTime();

const statusClass = (status: string) => {
  switch (status) {
    case "Done":
      return "gantt-bar--done";
    case "InProgress":
      return "gantt-bar--progress";
    default:
      return "gantt-bar--planned";
  }
};

const collectDependencies = (items: Task[]) => {
  const byId = new Map<string, TaskDependency>();
  items.forEach((task) => {
    task.dependencies?.forEach((dep) => {
      if (!byId.has(dep.id)) {
        byId.set(dep.id, dep);
      }
    });
  });
  return Array.from(byId.values());
};

const dependencyAnchors = (type: TaskDependency["type"]) => {
  switch (type) {
    case "SS":
      return { from: "start" as const, to: "start" as const };
    case "FF":
      return { from: "end" as const, to: "end" as const };
    case "SF":
      return { from: "start" as const, to: "end" as const };
    case "FS":
    default:
      return { from: "end" as const, to: "start" as const };
  }
};

const anchorPoint = (metrics: BarMetrics, side: AnchorSide): LinkPoint => {
  const pad = 6;
  const x = side === "start" ? metrics.x - pad : metrics.x + metrics.width + pad;
  return { x, y: metrics.y + metrics.height / 2 };
};

const buildLinkPath = (start: LinkPoint, end: LinkPoint) => {
  const dx = Math.abs(end.x - start.x);
  const minBend = 24;
  let midX = start.x + (end.x - start.x) / 2;
  if (dx < minBend) {
    midX = start.x + (start.x < end.x ? minBend : -minBend);
  }
  const round = (value: number) => Math.round(value * 10) / 10;
  const labelX = round(midX);
  const labelY = round((start.y + end.y) / 2 - 10);
  return {
    path: `M ${round(start.x)} ${round(start.y)} L ${round(midX)} ${round(start.y)} L ${round(midX)} ${round(
      end.y,
    )} L ${round(end.x)} ${round(end.y)}`,
    labelX,
    labelY,
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clampPoint = (point: LinkPoint, width: number, height: number) => ({
  x: clamp(point.x, 0, width),
  y: clamp(point.y, 0, height),
});

const formatLag = (lag: number) => {
  if (!Number.isFinite(lag) || lag === 0) return "";
  const abs = Math.abs(lag);
  const formatted = Number.isInteger(abs) ? abs.toString() : abs.toFixed(2).replace(/\.?0+$/, "");
  const sign = lag > 0 ? "+" : "-";
  return ` ${sign}${formatted}h`;
};

const formatLinkLabel = (type: TaskDependency["type"], lag: number) => `${type}${formatLag(lag)}`;

const areLinksEqual = (a: DependencyLink[], b: DependencyLink[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].type !== b[i].type ||
      a[i].path !== b[i].path ||
      a[i].label !== b[i].label ||
      a[i].labelX !== b[i].labelX ||
      a[i].labelY !== b[i].labelY
    ) {
      return false;
    }
  }
  return true;
};

type TimelineSectionProps = {
  tasks: Task[];
  timeline: TimelineBounds | null;
  axisTicks: AxisTick[];
};

const TimelineSection = ({ tasks, timeline, axisTicks }: TimelineSectionProps) => {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [links, setLinks] = useState<DependencyLink[]>([]);
  const [chartSize, setChartSize] = useState<{ width: number; height: number } | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const linksRef = useRef<DependencyLink[]>([]);
  const sizeRef = useRef<{ width: number; height: number } | null>(null);

  const activeTaskId = selectedTaskId ?? hoveredTaskId;
  const allDependencies = useMemo(() => collectDependencies(tasks), [tasks]);
  const activeDependencies = useMemo(() => {
    if (!activeTaskId) return [];
    return allDependencies.filter(
      (dep) => dep.predecessor_task_id === activeTaskId || dep.successor_task_id === activeTaskId,
    );
  }, [activeTaskId, allDependencies]);
  const linkedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    activeDependencies.forEach((dep) => {
      ids.add(dep.predecessor_task_id);
      ids.add(dep.successor_task_id);
    });
    return ids;
  }, [activeDependencies]);

  useEffect(() => {
    const handleResize = () => setLayoutTick((prev) => prev + 1);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const node = chartRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setLayoutTick((prev) => prev + 1));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!activeTaskId || !chartRef.current) {
      if (linksRef.current.length > 0) {
        linksRef.current = [];
        setLinks([]);
      }
      return;
    }

    const chartRect = chartRef.current.getBoundingClientRect();
    const nextSize = { width: chartRect.width, height: chartRect.height };
    if (!sizeRef.current || sizeRef.current.width !== nextSize.width || sizeRef.current.height !== nextSize.height) {
      sizeRef.current = nextSize;
      setChartSize(nextSize);
    }

    const getMetrics = (taskId: string): BarMetrics | null => {
      const node = barRefs.current.get(taskId);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        x: rect.left - chartRect.left,
        y: rect.top - chartRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const nextLinks: DependencyLink[] = [];
    activeDependencies.forEach((dep) => {
      const fromMetrics = getMetrics(dep.predecessor_task_id);
      const toMetrics = getMetrics(dep.successor_task_id);
      if (!fromMetrics || !toMetrics) return;
      const { from, to } = dependencyAnchors(dep.type);
      const start = clampPoint(anchorPoint(fromMetrics, from), nextSize.width, nextSize.height);
      const end = clampPoint(anchorPoint(toMetrics, to), nextSize.width, nextSize.height);
      const { path, labelX, labelY } = buildLinkPath(start, end);
      const labelPadding = 12;
      const labelMaxX = Math.max(labelPadding, nextSize.width - labelPadding);
      const labelMaxY = Math.max(labelPadding, nextSize.height - labelPadding);
      nextLinks.push({
        id: dep.id,
        type: dep.type,
        path,
        label: formatLinkLabel(dep.type, dep.lag),
        labelX: clamp(labelX, labelPadding, labelMaxX),
        labelY: clamp(labelY, labelPadding, labelMaxY),
      });
    });

    if (!areLinksEqual(linksRef.current, nextLinks)) {
      linksRef.current = nextLinks;
      setLinks(nextLinks);
    }
  }, [activeTaskId, activeDependencies, layoutTick, timeline]);

  const renderGanttBar = (task: Task) => {
    if (!timeline) return null;

    const total = timeline.max - timeline.min;
    const start = toTs(task.planned_start);
    const plannedEnd = toTs(task.planned_end);
    const deadlineTs = task.deadline ? toTs(task.deadline) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(plannedEnd) || total <= 0) return null;

    const offset = Math.max(0, ((start - timeline.min) / total) * 100);
    const safeEnd = Math.max(plannedEnd, start);
    const width = Math.max(3, ((safeEnd - start) / total) * 100);
    const deadlineOffset = Number.isFinite(deadlineTs) ? ((deadlineTs - timeline.min) / total) * 100 : null;
    const statusCls = statusClass(task.status);
    const isActive = task.id === activeTaskId;
    const isLinked = linkedTaskIds.has(task.id);
    const barClassName = `gantt-bar ${statusCls}${isActive ? " gantt-bar--active" : ""}${!isActive && isLinked ? " gantt-bar--linked" : ""}`;

    return (
      <div key={task.id} className="gantt-row">
        <div className="gantt-row__label">
          <span className="gantt-row__title">{task.title}</span>
          <span className="gantt-row__meta">
            {task.completion_rule} · <span className={`tag ${statusCls.replace("gantt-bar", "tag")}`}>{task.status}</span>
          </span>
        </div>
        <div className="gantt-row__track">
          <div
            className={barClassName}
            style={{ left: `${offset}%`, width: `${width}%` }}
            role="button"
            tabIndex={0}
            aria-pressed={selectedTaskId === task.id}
            ref={(node) => {
              if (node) {
                barRefs.current.set(task.id, node);
              } else {
                barRefs.current.delete(task.id);
              }
            }}
            onMouseEnter={() => setHoveredTaskId(task.id)}
            onMouseLeave={() => setHoveredTaskId((prev) => (prev === task.id ? null : prev))}
            onFocus={() => setHoveredTaskId(task.id)}
            onBlur={() => setHoveredTaskId((prev) => (prev === task.id ? null : prev))}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedTaskId((prev) => (prev === task.id ? null : task.id));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedTaskId((prev) => (prev === task.id ? null : task.id));
              }
            }}
          >
            <span className="gantt-bar__label">{task.title}</span>
          </div>
          {deadlineOffset !== null && (
            <div
              className="gantt-deadline"
              style={{ left: `${Math.min(100, Math.max(0, deadlineOffset))}%` }}
              title="Deadline"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="card">
      <div className="table-header">
        <div>
          <h3>Диаграмма задач</h3>
          <p className="muted">Как задачи распределены по времени</p>
        </div>
      </div>
      {!timeline || tasks.length === 0 ? (
        <p className="muted">Пока нет данных для диаграммы: добавьте задачи.</p>
      ) : (
        <div className="stack" style={{ gap: "12px" }}>
          <div className="gantt-legend">
            <span className="legend-item">
              <span className="legend-dot legend-dot--planned" />
              План
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot--progress" />
              В работе
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot--done" />
              Готово
            </span>
          </div>
          <div className="gantt-wrapper">
            <div className="gantt-scroll">
              <div className="gantt-chart" ref={chartRef} onClick={() => setSelectedTaskId(null)}>
                <div className="gantt-axis">
                  {axisTicks.map((tick) => (
                    <div key={tick.left} className="gantt-axis__tick" style={{ left: `${tick.left}%` }}>
                      <span className="gantt-axis__line" />
                      <span className="gantt-axis__label">{tick.label}</span>
                    </div>
                  ))}
                </div>
                {tasks.map((task) => renderGanttBar(task))}
                {activeTaskId && chartSize && links.length > 0 && (
                  <svg
                    className="gantt-links"
                    width={chartSize.width}
                    height={chartSize.height}
                    viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
                  >
                    <defs>
                      <marker
                        id="gantt-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                        markerUnits="strokeWidth"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {links.map((link) => (
                      <g key={link.id} className={`gantt-link--${link.type.toLowerCase()}`}>
                        <path className="gantt-link" d={link.path} markerEnd="url(#gantt-arrow)" />
                        <text className="gantt-link__label" x={link.labelX} y={link.labelY}>
                          {link.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export type { TimelineBounds, AxisTick };
export default TimelineSection;
