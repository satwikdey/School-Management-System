'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { UserRole, BoardCode } from '@/lib/utils';

const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, digits, dots, hyphens, and underscores'),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['super_admin', 'admin', 'teacher', 'accountant', 'librarian', 'student', 'parent']),
  phone: z.string().trim().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  designation: z.string().trim().optional(),
  department: z.string().trim().optional(),
  qualification: z.string().trim().optional(),
});

export async function createUserAccountAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);

  const parsed = createUserSchema.safeParse({
    fullName: formData.get('fullName'),
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    phone: formData.get('phone') || undefined,
    gender: formData.get('gender') || undefined,
    designation: formData.get('designation') || undefined,
    department: formData.get('department') || undefined,
    qualification: formData.get('qualification') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid user details.' };
  }

  const data = parsed.data;
  if (actor.role !== 'super_admin' && (data.role === 'super_admin' || data.role === 'admin')) {
    return {
      error: 'Only a Super Administrator can create Administrator or Super Administrator accounts.',
    };
  }

  const adminSupabase = createServiceRoleClient();
  const createdAuth = await adminSupabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName,
      role: data.role,
      username: data.username,
    },
  });

  if (createdAuth.error || !createdAuth.data.user) {
    return { error: createdAuth.error?.message || 'Failed to create Auth user.' };
  }

  const newUserId = createdAuth.data.user.id;
  const codePrefix = data.role.slice(0, 3).toUpperCase();
  const code = `${codePrefix}-${Date.now().toString().slice(-6)}`;

  const { error: profileError } = await adminSupabase.from('profiles').insert({
    id: newUserId,
    username: data.username,
    email: data.email,
    full_name: data.fullName,
    role: data.role as UserRole,
    code,
    phone: data.phone || null,
    gender: data.gender || 'Male',
    nationality: 'Indian',
    state: 'West Bengal',
    district: 'Kolkata',
    is_active: true,
  });

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(newUserId);
    return { error: profileError.message };
  }

  if (['super_admin', 'admin', 'teacher', 'accountant', 'librarian'].includes(data.role)) {
    await adminSupabase.from('staff_records').insert({
      user_id: newUserId,
      employee_code: code,
      designation: data.designation || data.role.replace('_', ' ').toUpperCase(),
      department: data.department || 'General',
      qualification: data.qualification || 'Graduate',
    });
  }

  await adminSupabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'USER_ACCOUNT_CREATED',
    entity_type: 'profiles',
    entity_id: newUserId,
    after_state: { username: data.username, email: data.email, role: data.role },
  });

  revalidatePath('/users');
  revalidatePath('/dashboard');
  return { success: `User account ${data.fullName} (${data.username}) created successfully.` };
}

const resetPasswordSchema = z.object({
  targetUserId: z.string().uuid('Invalid user ID'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export async function adminResetUserPasswordAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = resetPasswordSchema.safeParse({
    targetUserId: formData.get('targetUserId'),
    newPassword: formData.get('newPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid password reset request.' };
  }

  const adminSupabase = createServiceRoleClient();
  const { data: targetProfile } = await adminSupabase
    .from('profiles')
    .select('id, username, role')
    .eq('id', parsed.data.targetUserId)
    .single();

  if (!targetProfile) {
    return { error: 'Target user not found.' };
  }

  if (
    actor.role !== 'super_admin' &&
    (targetProfile.role === 'super_admin' || targetProfile.role === 'admin')
  ) {
    return { error: 'Only a Super Administrator can reset passwords for privileged accounts.' };
  }

  const { error } = await adminSupabase.auth.admin.updateUserById(parsed.data.targetUserId, {
    password: parsed.data.newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  await adminSupabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'ADMIN_PASSWORD_RESET',
    entity_type: 'profiles',
    entity_id: targetProfile.id,
    after_state: { target_username: targetProfile.username },
  });

  revalidatePath('/users');
  return { success: `Password reset completed for @${targetProfile.username}.` };
}

const admitStudentSchema = z.object({
  fullName: z.string().trim().min(2, 'Student full name is required'),
  username: z.string().trim().min(3, 'Username is required'),
  email: z.string().trim().email('Valid student email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  admissionNo: z.string().trim().min(3, 'Admission number is required'),
  classId: z.string().uuid('Class is required'),
  sectionId: z.string().uuid('Section is required'),
  academicYearId: z.string().uuid('Academic year is required'),
  rollNo: z.coerce.number().int().positive('Roll number must be a positive integer'),
  gender: z.enum(['Male', 'Female', 'Other']).default('Male'),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).default('O+'),
  house: z.string().trim().optional(),
  hostelId: z.string().uuid().optional().or(z.literal('')),
  hostelRoomNo: z.string().trim().optional(),
  parentId: z.string().uuid().optional().or(z.literal('')),
  relationship: z.enum(['Father', 'Mother', 'Guardian']).default('Guardian'),
});

export async function admitStudentAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = admitStudentSchema.safeParse({
    fullName: formData.get('fullName'),
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    admissionNo: formData.get('admissionNo'),
    classId: formData.get('classId'),
    sectionId: formData.get('sectionId'),
    academicYearId: formData.get('academicYearId'),
    rollNo: formData.get('rollNo'),
    gender: formData.get('gender') || 'Male',
    dateOfBirth: formData.get('dateOfBirth') || undefined,
    bloodGroup: formData.get('bloodGroup') || 'O+',
    house: formData.get('house') || undefined,
    hostelId: formData.get('hostelId') || '',
    hostelRoomNo: formData.get('hostelRoomNo') || undefined,
    parentId: formData.get('parentId') || '',
    relationship: formData.get('relationship') || 'Guardian',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid admission form input.' };
  }

  const d = parsed.data;
  const adminSupabase = createServiceRoleClient();

  const createdAuth = await adminSupabase.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: {
      full_name: d.fullName,
      role: 'student',
      username: d.username,
    },
  });

  if (createdAuth.error || !createdAuth.data.user) {
    return { error: createdAuth.error?.message || 'Failed creating student auth account.' };
  }

  const userId = createdAuth.data.user.id;
  const code = `STU-${Date.now().toString().slice(-6)}`;

  const { error: profErr } = await adminSupabase.from('profiles').insert({
    id: userId,
    username: d.username,
    email: d.email,
    full_name: d.fullName,
    role: 'student',
    code,
    gender: d.gender,
    date_of_birth: d.dateOfBirth || null,
    blood_group: d.bloodGroup,
    nationality: 'Indian',
    state: 'West Bengal',
    district: 'Kolkata',
    is_active: true,
  });

  if (profErr) {
    await adminSupabase.auth.admin.deleteUser(userId);
    return { error: profErr.message };
  }

  const { data: studentRow, error: stErr } = await adminSupabase
    .from('students')
    .insert({
      user_id: userId,
      admission_no: d.admissionNo,
      house: d.house || 'Tagore House',
      hostel_id: d.hostelId || null,
      hostel_room_no: d.hostelRoomNo || null,
    })
    .select('id')
    .single();

  if (stErr || !studentRow) {
    await adminSupabase.auth.admin.deleteUser(userId);
    return { error: stErr?.message || 'Failed creating student record.' };
  }

  const { error: enrollErr } = await adminSupabase.from('student_enrollments').insert({
    student_id: studentRow.id,
    academic_year_id: d.academicYearId,
    class_id: d.classId,
    section_id: d.sectionId,
    roll_no: d.rollNo,
    status: 'active',
  });

  if (enrollErr) {
    await adminSupabase.auth.admin.deleteUser(userId);
    return { error: enrollErr.message };
  }

  if (d.parentId) {
    await adminSupabase.from('parent_student_links').insert({
      parent_id: d.parentId,
      student_id: studentRow.id,
      relationship: d.relationship,
      is_primary: true,
    });
  }

  await adminSupabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'STUDENT_ADMITTED',
    entity_type: 'students',
    entity_id: studentRow.id,
    after_state: {
      full_name: d.fullName,
      admission_no: d.admissionNo,
      class_id: d.classId,
      section_id: d.sectionId,
    },
  });

  revalidatePath('/students');
  revalidatePath('/dashboard');
  return { success: `Student ${d.fullName} (${d.admissionNo}) admitted successfully.` };
}

const linkParentSchema = z.object({
  parentId: z.string().uuid('Select a valid parent account'),
  studentId: z.string().uuid('Select a valid student'),
  relationship: z.enum(['Father', 'Mother', 'Guardian']),
});

export async function linkParentToStudentAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = linkParentSchema.safeParse({
    parentId: formData.get('parentId'),
    studentId: formData.get('studentId'),
    relationship: formData.get('relationship') || 'Guardian',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid parent-student link data.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('parent_student_links').upsert(
    {
      parent_id: parsed.data.parentId,
      student_id: parsed.data.studentId,
      relationship: parsed.data.relationship,
      is_primary: true,
    },
    { onConflict: 'parent_id,student_id' }
  );

  if (error) {
    return { error: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'PARENT_STUDENT_LINKED',
    entity_type: 'parent_student_links',
    entity_id: `${parsed.data.parentId}:${parsed.data.studentId}`,
    after_state: parsed.data,
  });

  revalidatePath('/students');
  return { success: 'Parent linked to student successfully.' };
}

const promoteBatchSchema = z.object({
  fromAcademicYearId: z.string().uuid(),
  toAcademicYearId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  fromSectionId: z.string().uuid(),
  toClassId: z.string().uuid(),
  toSectionId: z.string().uuid(),
  decisionsJson: z.string().min(2),
});

export async function promoteStudentsAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const parsed = promoteBatchSchema.safeParse({
    fromAcademicYearId: formData.get('fromAcademicYearId'),
    toAcademicYearId: formData.get('toAcademicYearId'),
    fromClassId: formData.get('fromClassId'),
    fromSectionId: formData.get('fromSectionId'),
    toClassId: formData.get('toClassId'),
    toSectionId: formData.get('toSectionId'),
    decisionsJson: formData.get('decisionsJson'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid promotion batch parameters.' };
  }

  let decisions: Array<{ student_id: string; action: 'PROMOTE' | 'RETAIN' | 'GRADUATE'; remarks?: string }>;
  try {
    decisions = JSON.parse(parsed.data.decisionsJson);
  } catch {
    return { error: 'Invalid decisions payload.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('promote_students_tx', {
    p_from_academic_year_id: parsed.data.fromAcademicYearId,
    p_to_academic_year_id: parsed.data.toAcademicYearId,
    p_from_class_id: parsed.data.fromClassId,
    p_from_section_id: parsed.data.fromSectionId,
    p_to_class_id: parsed.data.toClassId,
    p_to_section_id: parsed.data.toSectionId,
    p_decisions: decisions,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/students');
  revalidatePath('/dashboard');
  return {
    success: `Processed promotion/retention/graduation for ${(data as { processed_count?: number })?.processed_count ?? decisions.length} student(s).`,
  };
}

const reversePromotionSchema = z.object({
  promotionId: z.string().uuid('Invalid promotion ID'),
  reason: z.string().trim().min(3, 'Please enter a reason for reversing this promotion'),
});

export async function reversePromotionAction(formData: FormData) {
  await requireRole(['super_admin']);
  const parsed = reversePromotionSchema.safeParse({
    promotionId: formData.get('promotionId'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid promotion reversal input.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('reverse_promotion_tx', {
    p_promotion_id: parsed.data.promotionId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/students');
  revalidatePath('/settings');
  return { success: 'Promotion reversed and prior enrollment restored.' };
}

const schoolSettingsSchema = z.object({
  settingsId: z.string().uuid(),
  schoolName: z.string().trim().min(3),
  schoolAcronym: z.string().trim().min(2),
  schoolMotto: z.string().trim().optional(),
  address: z.string().trim().min(5),
  phone: z.string().trim().min(5),
  email: z.string().trim().email(),
  defaultBoardCode: z.enum(['CBSE', 'ICSE', 'WBBSE', 'WBCHSE', 'CUSTOM']),
  defaultCustomBoardName: z.string().trim().optional(),
  currentAcademicYearId: z.string().uuid(),
  requireResultPin: z.boolean(),
  defaultLoanDays: z.coerce.number().int().min(1).max(90),
});

export async function updateSchoolSettingsAction(formData: FormData) {
  const actor = await requireRole(['super_admin']);
  const parsed = schoolSettingsSchema.safeParse({
    settingsId: formData.get('settingsId'),
    schoolName: formData.get('schoolName'),
    schoolAcronym: formData.get('schoolAcronym'),
    schoolMotto: formData.get('schoolMotto') || '',
    address: formData.get('address'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    defaultBoardCode: formData.get('defaultBoardCode'),
    defaultCustomBoardName: formData.get('defaultCustomBoardName') || '',
    currentAcademicYearId: formData.get('currentAcademicYearId'),
    requireResultPin: formData.get('requireResultPin') === 'true' || formData.get('requireResultPin') === 'on',
    defaultLoanDays: formData.get('defaultLoanDays') || 14,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid school settings.' };
  }

  const d = parsed.data;
  if (d.defaultBoardCode === 'CUSTOM' && !d.defaultCustomBoardName) {
    return { error: 'Custom board display name is required when CUSTOM board is selected.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('school_settings')
    .update({
      school_name: d.schoolName,
      school_acronym: d.schoolAcronym,
      school_motto: d.schoolMotto || '',
      address: d.address,
      phone: d.phone,
      email: d.email,
      default_board_code: d.defaultBoardCode as BoardCode,
      default_custom_board_name: d.defaultBoardCode === 'CUSTOM' ? d.defaultCustomBoardName : null,
      current_academic_year_id: d.currentAcademicYearId,
      require_result_pin: d.requireResultPin,
      default_loan_days: d.defaultLoanDays,
      updated_at: new Date().toISOString(),
    })
    .eq('id', d.settingsId);

  if (error) {
    return { error: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'SCHOOL_SETTINGS_UPDATED',
    entity_type: 'school_settings',
    entity_id: d.settingsId,
    after_state: d,
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/boards');
  revalidatePath('/exams');
  return { success: 'School settings updated successfully.' };
}
