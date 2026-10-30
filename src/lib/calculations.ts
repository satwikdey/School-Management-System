export type MarkStatus = 'PRESENT' | 'ABSENT' | 'MISSING';

export interface ComponentConfig {
  id: string;
  code: string;
  name: string;
  maxMarks: number;
  passMarks: number;
  isMandatory: boolean;
}

export interface GradeBandConfig {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint?: number | null;
  remark: string;
  isPassing: boolean;
}

export interface RawComponentMarkInput {
  componentId: string;
  status: MarkStatus;
  marksObtained: number | null;
}

export interface EvaluatedComponentMark {
  componentId: string;
  code: string;
  name: string;
  status: MarkStatus;
  numericScore: number;
  displayValue: string;
  maxMarks: number;
  isMissingMandatory: boolean;
}

export interface EvaluatedSubjectResult {
  subjectId: string;
  subjectName: string;
  components: EvaluatedComponentMark[];
  obtainedMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  remark: string;
  isPassed: boolean;
  hasMissingMandatory: boolean;
  isAllAbsent: boolean;
}

export function roundToTwo(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePercentage(obtained: number, max: number): number {
  if (max <= 0) return 0;
  return roundToTwo((obtained / max) * 100);
}

export function resolveGradeBand(
  percentage: number,
  gradeBands: GradeBandConfig[]
): GradeBandConfig {
  const rounded = roundToTwo(percentage);
  const sorted = [...gradeBands].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const band of sorted) {
    if (rounded >= band.minPercentage && rounded <= band.maxPercentage) {
      return band;
    }
  }
  // Fallback if bands have gaps at boundaries
  const closest = sorted.find((b) => rounded >= b.minPercentage);
  if (closest) return closest;
  return (
    sorted[sorted.length - 1] ?? {
      grade: 'N/A',
      minPercentage: 0,
      maxPercentage: 100,
      remark: 'Unclassified',
      isPassing: rounded >= 33,
    }
  );
}

export function evaluateSubjectMarks(
  subjectId: string,
  subjectName: string,
  components: ComponentConfig[],
  entries: RawComponentMarkInput[],
  gradeBands: GradeBandConfig[],
  passPercentage: number
): EvaluatedSubjectResult {
  const entryByComp = new Map(entries.map((e) => [e.componentId, e]));
  const evaluatedComponents: EvaluatedComponentMark[] = [];

  let obtainedMarks = 0;
  let maxMarks = 0;
  let hasMissingMandatory = false;
  let absentCount = 0;
  let hasFailedComponentMinimum = false;

  for (const comp of components) {
    maxMarks += comp.maxMarks;
    const entry = entryByComp.get(comp.id);
    const status: MarkStatus = entry?.status ?? 'MISSING';

    if (status === 'MISSING') {
      if (comp.isMandatory) {
        hasMissingMandatory = true;
      }
      evaluatedComponents.push({
        componentId: comp.id,
        code: comp.code,
        name: comp.name,
        status: 'MISSING',
        numericScore: 0,
        displayValue: '—',
        maxMarks: comp.maxMarks,
        isMissingMandatory: comp.isMandatory,
      });
    } else if (status === 'ABSENT') {
      // Absence contributes 0 to totals and remains visibly marked as AB
      absentCount += 1;
      if (comp.passMarks > 0) hasFailedComponentMinimum = true;
      evaluatedComponents.push({
        componentId: comp.id,
        code: comp.code,
        name: comp.name,
        status: 'ABSENT',
        numericScore: 0,
        displayValue: 'AB',
        maxMarks: comp.maxMarks,
        isMissingMandatory: false,
      });
    } else {
      // PRESENT — zero (0) is a valid score and must be counted as 0, never missing
      const rawScore = entry?.marksObtained;
      if (rawScore === null || rawScore === undefined || Number.isNaN(Number(rawScore))) {
        if (comp.isMandatory) hasMissingMandatory = true;
        evaluatedComponents.push({
          componentId: comp.id,
          code: comp.code,
          name: comp.name,
          status: 'MISSING',
          numericScore: 0,
          displayValue: '—',
          maxMarks: comp.maxMarks,
          isMissingMandatory: comp.isMandatory,
        });
      } else {
        const score = Number(rawScore);
        if (!Number.isFinite(score) || score < 0 || score > comp.maxMarks) {
          throw new RangeError(
            `${comp.code} score must be between 0 and ${comp.maxMarks}.`
          );
        }
        if (score < comp.passMarks) hasFailedComponentMinimum = true;
        obtainedMarks += score;
        evaluatedComponents.push({
          componentId: comp.id,
          code: comp.code,
          name: comp.name,
          status: 'PRESENT',
          numericScore: roundToTwo(score),
          displayValue: roundToTwo(score).toFixed(score % 1 === 0 ? 0 : 2),
          maxMarks: comp.maxMarks,
          isMissingMandatory: false,
        });
      }
    }
  }

  obtainedMarks = roundToTwo(obtainedMarks);
  maxMarks = roundToTwo(maxMarks);
  const percentage = calculatePercentage(obtainedMarks, maxMarks);
  const matchedBand = resolveGradeBand(percentage, gradeBands);
  const isAllAbsent = components.length > 0 && absentCount === components.length;
  const isPassed =
    !hasMissingMandatory &&
    !hasFailedComponentMinimum &&
    matchedBand.isPassing &&
    percentage >= passPercentage;

  return {
    subjectId,
    subjectName,
    components: evaluatedComponents,
    obtainedMarks,
    maxMarks,
    percentage,
    grade: matchedBand.grade,
    remark: isAllAbsent ? 'Absent' : matchedBand.remark,
    isPassed,
    hasMissingMandatory,
    isAllAbsent,
  };
}

export interface StudentTermInput {
  studentId: string;
  enrollmentId: string;
  sectionId: string;
  subjectResults: EvaluatedSubjectResult[];
}

export interface StudentExamSummaryComputed {
  studentId: string;
  enrollmentId: string;
  sectionId: string;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  overallGrade: string;
  gradeRemark: string;
  isPassed: boolean;
  canPublish: boolean;
  sectionRank: number;
  classRank: number;
}

/**
 * Assigns shared competition ranks ("1224" standard ranking):
 * Tied students receive the exact same rank, and the next student receives (1 + number of students strictly ahead).
 */
export function assignSharedCompetitionRanks<
  T extends { percentage: number; totalObtained: number }
>(items: T[]): Array<T & { rank: number }> {
  const sorted = [...items].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return b.totalObtained - a.totalObtained;
  });

  let currentRank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0) {
      const prev = sorted[idx - 1];
      if (
        item.percentage < prev.percentage ||
        item.totalObtained < prev.totalObtained
      ) {
        currentRank = idx + 1;
      }
    }
    return { ...item, rank: currentRank };
  });
}

export function computeClassExamSummaries(
  students: StudentTermInput[],
  gradeBands: GradeBandConfig[],
  passPercentage: number
): StudentExamSummaryComputed[] {
  const baseSummaries = students.map((st) => {
    const totalObtained = roundToTwo(
      st.subjectResults.reduce((acc, s) => acc + s.obtainedMarks, 0)
    );
    const totalMax = roundToTwo(
      st.subjectResults.reduce((acc, s) => acc + s.maxMarks, 0)
    );
    const percentage = calculatePercentage(totalObtained, totalMax);
    const band = resolveGradeBand(percentage, gradeBands);
    const anyMissingMandatory = st.subjectResults.some((s) => s.hasMissingMandatory);
    const allSubjectsPassed = st.subjectResults.every((s) => s.isPassed);
    const isPassed =
      !anyMissingMandatory &&
      allSubjectsPassed &&
      band.isPassing &&
      percentage >= passPercentage;

    return {
      studentId: st.studentId,
      enrollmentId: st.enrollmentId,
      sectionId: st.sectionId,
      totalObtained,
      totalMax,
      percentage,
      overallGrade: band.grade,
      gradeRemark: band.remark,
      isPassed,
      canPublish: !anyMissingMandatory,
      sectionRank: 1,
      classRank: 1,
    };
  });

  // Class-wide shared competition ranks
  const classRanked = assignSharedCompetitionRanks(baseSummaries);
  const classRankMap = new Map(classRanked.map((r) => [r.enrollmentId, r.rank]));

  // Section-wise shared competition ranks
  const bySection = new Map<string, typeof baseSummaries>();
  for (const s of baseSummaries) {
    const list = bySection.get(s.sectionId) ?? [];
    list.push(s);
    bySection.set(s.sectionId, list);
  }
  const sectionRankMap = new Map<string, number>();
  for (const list of Array.from(bySection.values())) {
    const ranked = assignSharedCompetitionRanks(list);
    for (const r of ranked) {
      sectionRankMap.set(r.enrollmentId, r.rank);
    }
  }

  return baseSummaries.map((s) => ({
    ...s,
    classRank: classRankMap.get(s.enrollmentId) ?? 1,
    sectionRank: sectionRankMap.get(s.enrollmentId) ?? 1,
  }));
}

export interface TermWeightedInput {
  termCode: string;
  percentage: number;
  weightPercent: number;
}

export function calculateWeightedAnnualPercentage(
  terms: TermWeightedInput[]
): number {
  const validTerms = terms.filter((t) => t.weightPercent > 0);
  const totalWeight = validTerms.reduce((acc, t) => acc + t.weightPercent, 0);
  if (totalWeight <= 0) return 0;
  const weightedSum = validTerms.reduce(
    (acc, t) => acc + t.percentage * t.weightPercent,
    0
  );
  return roundToTwo(weightedSum / totalWeight);
}

export interface ImmutableSummarySnapshot {
  total_obtained: number;
  total_max: number;
  percentage: number;
  annual_weighted_percentage?: number | null;
  overall_grade: string;
  grade_remark: string;
  is_passed: boolean;
  section_rank: number;
  class_rank: number;
  config?: {
    board_code?: string;
    custom_board_name?: string | null;
    version?: number;
    pass_percentage?: number;
  };
}

/**
 * Ensures published historical results always read from their immutable snapshot
 * so later edits to assessment configurations never alter published historical report cards.
 */
export function resolveImmutableResultSummary(row: {
  isPublished: boolean;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  annualWeightedPercentage?: number | null;
  overallGrade: string | null;
  gradeRemark: string | null;
  isPassed: boolean;
  sectionRank: number | null;
  classRank: number | null;
  publishedSnapshot?: ImmutableSummarySnapshot | null;
}) {
  if (row.isPublished && row.publishedSnapshot) {
    const snap = row.publishedSnapshot;
    return {
      totalObtained: roundToTwo(Number(snap.total_obtained)),
      totalMax: roundToTwo(Number(snap.total_max)),
      percentage: roundToTwo(Number(snap.percentage)),
      annualWeightedPercentage:
        snap.annual_weighted_percentage != null
          ? roundToTwo(Number(snap.annual_weighted_percentage))
          : row.annualWeightedPercentage ?? null,
      overallGrade: snap.overall_grade || row.overallGrade || 'N/A',
      gradeRemark: snap.grade_remark || row.gradeRemark || '',
      isPassed: Boolean(snap.is_passed),
      sectionRank: snap.section_rank ?? row.sectionRank ?? 1,
      classRank: snap.class_rank ?? row.classRank ?? 1,
      isFromImmutableSnapshot: true,
    };
  }

  return {
    totalObtained: roundToTwo(Number(row.totalObtained)),
    totalMax: roundToTwo(Number(row.totalMax)),
    percentage: roundToTwo(Number(row.percentage)),
    annualWeightedPercentage:
      row.annualWeightedPercentage != null
        ? roundToTwo(Number(row.annualWeightedPercentage))
        : null,
    overallGrade: row.overallGrade || 'N/A',
    gradeRemark: row.gradeRemark || '',
    isPassed: Boolean(row.isPassed),
    sectionRank: row.sectionRank ?? 1,
    classRank: row.classRank ?? 1,
    isFromImmutableSnapshot: false,
  };
}
