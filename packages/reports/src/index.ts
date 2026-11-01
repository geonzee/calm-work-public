/** Derived from local upstream task/time projections; export never includes secrets. */
export interface TimeReportRow {
  readonly day: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly projectTitle: string;
  readonly trackedMs: number;
}

export interface ReportPort {
  timeReport(startDay: string, endDayExclusive: string, timeZone: string): Promise<readonly TimeReportRow[]>;
  export(format: 'csv' | 'json'): Promise<Uint8Array>;
}
