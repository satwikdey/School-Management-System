import { describe, it, expect } from 'vitest';
import {
  roundToTwo,
  calculatePercentage,
  resolveGradeBand,
  evaluateSubjectMarks,
  assignSharedCompetitionRanks,
  computeClassExamSummaries,
  calculateWeightedAnnualPercentage,
  resolveImmutableResultSummary,
  type ComponentConfig,
  type GradeBandConfig,
} from '@/lib/calculations';

const CBSE_BANDS: GradeBandConfig[] = [
  { grade: 'A1', minPercentage: 91, maxPercentage: 100, gradePoint: 10, remark: 'Outstanding', isPassing: true },
  { grade: 'A2', minPercentage: 81, maxPercentage: 90.99, gradePoint: 9, remark: 'Excellent', isPassing: true },
  { grade: 'B1', minPercentage: 71, maxPercentage: 80.99, gradePoint: 8, remark: 'Very Good', isPassing: true },
  { grade: 'B2', minPercentage: 61, maxPercentage: 70.99, gradePoint: 7, remark: 'Good', isPassing: true },
  { grade: 'C1', minPercentage: 51, maxPercentage: 60.99, gradePoint: 6, remark: 'Fair', isPassing: true },
  { grade: 'C2', minPercentage: 41, maxPercentage: 50.99, gradePoint: 5, remark: 'Average', isPassing: true },
  { grade: 'D', minPercentage: 33, maxPercentage: 40.99, gradePoint: 4, remark: 'Marginal Pass', isPassing: true },
  { grade: 'E', minPercentage: 0, maxPercentage: 32.99, gradePoint: 0, remark: 'Needs Improvement', isPassing: false },
];

const WBBSE_BANDS: GradeBandConfig[] = [
  { grade: 'AA', minPercentage: 90, maxPercentage: 100, remark: 'Outstanding', isPassing: true },
  { grade: 'A+', minPercentage: 80, maxPercentage: 89.99, remark: 'Excellent', isPassing: true },
  { grade: 'A', minPercentage: 60, maxPercentage: 79.99, remark: 'Very Good', isPassing: true },
  { grade: 'B+', minPercentage: 45, maxPercentage: 59.99, remark: 'Good', isPassing: true },
  { grade: 'B', minPercentage: 35, maxPercentage: 44.99, remark: 'Satisfactory', isPassing: true },
  { grade: 'C', minPercentage: 25, maxPercentage: 34.99, remark: 'Marginal Pass', isPassing: true },
  { grade: 'D', minPercentage: 0, maxPercentage: 24.99, remark: 'Disqualified', isPassing: false },
];

const STANDARD_COMPONENTS: ComponentConfig[] = [
  { id: 'c-ia', code: 'IA', name: 'Internal Assessment', maxMarks: 20, passMarks: 7, isMandatory: true },
  { id: 'c-th', code: 'THEORY', name: 'Theory Written', maxMarks: 80, passMarks: 26, isMandatory: true },
];

describe('Assessment & Examination Calculation Engine', () => {
  it('rounds percentages and component totals to two decimals', () => {
    expect(roundToTwo(66.66666)).toBe(66.67);
    expect(roundToTwo(88.124)).toBe(88.12);
    expect(calculatePercentage(100, 150)).toBe(66.67);
    expect(calculatePercentage(0, 100)).toBe(0);
  });

  it('distinguishes PRESENT zero (0), ABSENT (AB -> 0), and MISSING (blocks publication)', () => {
    // 1. Valid zero (0) in IA + 40 in Theory -> Complete, can publish, total 40/100
    const zeroResult = evaluateSubjectMarks(
      'sub-math',
      'Mathematics',
      STANDARD_COMPONENTS,
      [
        { componentId: 'c-ia', status: 'PRESENT', marksObtained: 0 },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 40 },
      ],
      CBSE_BANDS,
      33
    );
    expect(zeroResult.hasMissingMandatory).toBe(false);
    expect(zeroResult.obtainedMarks).toBe(40);
    expect(zeroResult.components[0].displayValue).toBe('0');
    expect(zeroResult.isPassed).toBe(false); // IA 0 is below its configured pass minimum of 7.

    // 2. ABSENT in IA + 50 in Theory -> Complete (does not block publication), IA displays AB and contributes 0
    const absentResult = evaluateSubjectMarks(
      'sub-math',
      'Mathematics',
      STANDARD_COMPONENTS,
      [
        { componentId: 'c-ia', status: 'ABSENT', marksObtained: null },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 50 },
      ],
      CBSE_BANDS,
      33
    );
    expect(absentResult.hasMissingMandatory).toBe(false);
    expect(absentResult.obtainedMarks).toBe(50);
    expect(absentResult.components[0].displayValue).toBe('AB');
    expect(absentResult.components[0].numericScore).toBe(0);

    // 3. MISSING in IA + 75 in Theory -> Blocks publication (hasMissingMandatory = true)
    const missingResult = evaluateSubjectMarks(
      'sub-math',
      'Mathematics',
      STANDARD_COMPONENTS,
      [
        { componentId: 'c-ia', status: 'MISSING', marksObtained: null },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 75 },
      ],
      CBSE_BANDS,
      33
    );
    expect(missingResult.hasMissingMandatory).toBe(true);
    expect(missingResult.isPassed).toBe(false);
    expect(missingResult.components[0].displayValue).toBe('—');
  });

  it('enforces component minima, ignores untouched optional components, and rejects out-of-range scores', () => {
    const optionalComponents: ComponentConfig[] = [
      ...STANDARD_COMPONENTS,
      { id: 'c-opt', code: 'VIVA', name: 'Optional Viva', maxMarks: 10, passMarks: 4, isMandatory: false },
    ];
    const untouchedOptional = evaluateSubjectMarks(
      'sub-science',
      'Science',
      optionalComponents,
      [
        { componentId: 'c-ia', status: 'PRESENT', marksObtained: 15 },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 55 },
        { componentId: 'c-opt', status: 'MISSING', marksObtained: null },
      ],
      CBSE_BANDS,
      33
    );
    expect(untouchedOptional.hasMissingMandatory).toBe(false);
    expect(untouchedOptional.isPassed).toBe(true);

    const attemptedOptionalFailure = evaluateSubjectMarks(
      'sub-science',
      'Science',
      optionalComponents,
      [
        { componentId: 'c-ia', status: 'PRESENT', marksObtained: 15 },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 55 },
        { componentId: 'c-opt', status: 'PRESENT', marksObtained: 2 },
      ],
      CBSE_BANDS,
      33
    );
    expect(attemptedOptionalFailure.isPassed).toBe(false);

    expect(() => evaluateSubjectMarks(
      'sub-science',
      'Science',
      STANDARD_COMPONENTS,
      [
        { componentId: 'c-ia', status: 'PRESENT', marksObtained: 21 },
        { componentId: 'c-th', status: 'PRESENT', marksObtained: 50 },
      ],
      CBSE_BANDS,
      33
    )).toThrow(/between 0 and 20/);
  });

  it('evaluates grade boundaries accurately across CBSE and WBBSE board profiles', () => {
    expect(resolveGradeBand(91.0, CBSE_BANDS).grade).toBe('A1');
    expect(resolveGradeBand(90.99, CBSE_BANDS).grade).toBe('A2');
    expect(resolveGradeBand(33.0, CBSE_BANDS).grade).toBe('D');
    expect(resolveGradeBand(32.99, CBSE_BANDS).isPassing).toBe(false);

    expect(resolveGradeBand(90, WBBSE_BANDS).grade).toBe('AA');
    expect(resolveGradeBand(25, WBBSE_BANDS).grade).toBe('C');
    expect(resolveGradeBand(24.99, WBBSE_BANDS).grade).toBe('D');
    expect(resolveGradeBand(24.99, WBBSE_BANDS).isPassing).toBe(false);
  });

  it('assigns shared competition ranks (1, 1, 3) for ties at class and section levels', () => {
    const items = [
      { id: 'stu-1', percentage: 92.5, totalObtained: 185 },
      { id: 'stu-2', percentage: 92.5, totalObtained: 185 },
      { id: 'stu-3', percentage: 88.0, totalObtained: 176 },
      { id: 'stu-4', percentage: 88.0, totalObtained: 176 },
      { id: 'stu-5', percentage: 75.0, totalObtained: 150 },
    ];
    const ranked = assignSharedCompetitionRanks(items);
    expect(ranked.map((r) => ({ id: r.id, rank: r.rank }))).toEqual([
      { id: 'stu-1', rank: 1 },
      { id: 'stu-2', rank: 1 },
      { id: 'stu-3', rank: 3 },
      { id: 'stu-4', rank: 3 },
      { id: 'stu-5', rank: 5 },
    ]);

    // Verify computeClassExamSummaries computes both sectionRank and classRank with shared ties
    const makeSubResult = (obtained: number) =>
      evaluateSubjectMarks(
        'sub-1',
        'Mathematics',
        STANDARD_COMPONENTS,
        [
          { componentId: 'c-ia', status: 'PRESENT', marksObtained: 20 },
          { componentId: 'c-th', status: 'PRESENT', marksObtained: obtained - 20 },
        ],
        CBSE_BANDS,
        33
      );

    const summaries = computeClassExamSummaries(
      [
        { studentId: 's1', enrollmentId: 'e1', sectionId: 'sec-A', subjectResults: [makeSubResult(95)] },
        { studentId: 's2', enrollmentId: 'e2', sectionId: 'sec-A', subjectResults: [makeSubResult(95)] },
        { studentId: 's3', enrollmentId: 'e3', sectionId: 'sec-A', subjectResults: [makeSubResult(84)] },
        { studentId: 's4', enrollmentId: 'e4', sectionId: 'sec-B', subjectResults: [makeSubResult(95)] },
      ],
      CBSE_BANDS,
      33
    );

    const byEnrollment = new Map(summaries.map((s) => [s.enrollmentId, s]));
    expect(byEnrollment.get('e1')?.classRank).toBe(1);
    expect(byEnrollment.get('e2')?.classRank).toBe(1);
    expect(byEnrollment.get('e4')?.classRank).toBe(1);
    // 3 students tied at 95 -> next student (e3 at 84) is classRank #4, sectionRank #3 in sec-A
    expect(byEnrollment.get('e3')?.classRank).toBe(4);
    expect(byEnrollment.get('e3')?.sectionRank).toBe(3);
  });

  it('calculates multi-term weighted annual percentages (WBCHSE Sem I/II and CBSE Term 1/2)', () => {
    // WBCHSE Class XI Semester I (50%) + Semester II (50%)
    const wbchseAnnual = calculateWeightedAnnualPercentage([
      { termCode: 'SEM1', percentage: 82.5, weightPercent: 50 },
      { termCode: 'SEM2', percentage: 87.5, weightPercent: 50 },
    ]);
    expect(wbchseAnnual).toBe(85);

    // Custom 40% Half-Yearly + 60% Annual
    const weighted = calculateWeightedAnnualPercentage([
      { termCode: 'TERM1', percentage: 75, weightPercent: 40 },
      { termCode: 'TERM2', percentage: 90, weightPercent: 60 },
    ]);
    expect(weighted).toBe(84);
  });

  it('preserves immutable historical result snapshots when later board configurations change', () => {
    const publishedRow = {
      isPublished: true,
      // Live mutable columns artificially altered later:
      totalObtained: 120,
      totalMax: 200,
      percentage: 60,
      annualWeightedPercentage: 60,
      overallGrade: 'C1',
      gradeRemark: 'Fair',
      isPassed: true,
      sectionRank: 9,
      classRank: 15,
      // Immutable snapshot locked at publication time:
      publishedSnapshot: {
        total_obtained: 184,
        total_max: 200,
        percentage: 92,
        annual_weighted_percentage: 92,
        overall_grade: 'A1',
        grade_remark: 'Outstanding',
        is_passed: true,
        section_rank: 1,
        class_rank: 1,
        config: {
          board_code: 'CBSE',
          version: 1,
          pass_percentage: 33,
        },
      },
    };

    const resolved = resolveImmutableResultSummary(publishedRow);
    expect(resolved.isFromImmutableSnapshot).toBe(true);
    expect(resolved.percentage).toBe(92);
    expect(resolved.overallGrade).toBe('A1');
    expect(resolved.sectionRank).toBe(1);
    expect(resolved.classRank).toBe(1);
  });
});
