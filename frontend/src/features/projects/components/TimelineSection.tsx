import type { Task } from "../../tasks/api/taskApi";

type TimelineBounds = {
  min: number;
  max: number;
};

type AxisTick = {
  left: number;
  label: string;
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

type TimelineSectionProps = {
  tasks: Task[];
  timeline: TimelineBounds | null;
  axisTicks: AxisTick[];
};

const TimelineSection = ({ tasks, timeline, axisTicks }: TimelineSectionProps) => {
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

    return (
      <div key={task.id} className="gantt-row">
        <div className="gantt-row__label">
          <span className="gantt-row__title">{task.title}</span>
          <span className="gantt-row__meta">
            {task.completion_rule} · <span className={`tag ${statusCls.replace("gantt-bar", "tag")}`}>{task.status}</span>
          </span>
        </div>
        <div className="gantt-row__track">
          <div className={`gantt-bar ${statusCls}`} style={{ left: `${offset}%`, width: `${width}%` }}>
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
              <div className="gantt-chart">
                <div className="gantt-axis">
                  {axisTicks.map((tick) => (
                    <div key={tick.left} className="gantt-axis__tick" style={{ left: `${tick.left}%` }}>
                      <span className="gantt-axis__line" />
                      <span className="gantt-axis__label">{tick.label}</span>
                    </div>
                  ))}
                </div>
                {tasks.map((task) => renderGanttBar(task))}
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
