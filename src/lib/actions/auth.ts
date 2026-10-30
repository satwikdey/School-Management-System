'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    identifier: formData.get('identifier'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid login input.' };
  }

  const supabase = createClient();
  const { identifier, password } = parsed.data;

  // Resolve username or email via database function
  let emailToUse = identifier;
  if (!identifier.includes('@')) {
    const { data: resolvedEmail, error: rpcErr } = await supabase.rpc('resolve_login_email', {
      p_identifier: identifier,
    });
    if (rpcErr || !resolvedEmail) {
      return { error: 'Invalid username/email or password.' };
    }
    emailToUse = resolvedEmail;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error) {
    return { error: 'Invalid username/email or password.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

const passwordChangeSchema = z
  .object({
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function changeOwnPasswordAction(formData: FormData) {
  const profile = await requireAuth();
  const parsed = passwordChangeSchema.safeParse({
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid password input.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: profile.id,
    actor_role: profile.role,
    action: 'USER_PASSWORD_CHANGED_SELF',
    entity_type: 'profiles',
    entity_id: profile.id,
  });

  revalidatePath('/account');
  return { success: 'Password updated successfully.' };
}

const recoverySchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
});

export async function requestPasswordRecoveryAction(formData: FormData) {
  const parsed = recoverySchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Valid email is required.' };
  }

  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/account`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      'If an account exists for that email address, a password recovery link has been dispatched.',
  };
}

const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
});

export async function updateOwnProfileAction(formData: FormData) {
  const profile = await requireAuth();
  const parsed = updateProfileSchema.safeParse({
    phone: formData.get('phone') || '',
    address: formData.get('address') || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid profile data.' };
  }

  const supabase = createClient();
  let photoPath = profile.photo_path;

  const photoFile = formData.get('photo') as File | null;
  if (photoFile && photoFile.size > 0) {
    if (photoFile.size > 2 * 1024 * 1024) {
      return { error: 'Profile photograph must not exceed 2 MB.' };
    }
    if (!['image/jpeg', 'image/png'].includes(photoFile.type)) {
      return { error: 'Profile photograph must be JPEG or PNG.' };
    }

    const ext = photoFile.type === 'image/png' ? 'png' : 'jpg';
    const targetPath = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const serviceClient = createServiceRoleClient();
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const { error: uploadErr } = await serviceClient.storage
      .from('profile-photos')
      .upload(targetPath, bytes, {
        contentType: photoFile.type,
        upsert: true,
      });

    if (uploadErr) {
      return { error: `Photo upload failed: ${uploadErr.message}` };
    }
    photoPath = targetPath;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      photo_path: photoPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/', 'layout');
  return { success: 'Profile updated successfully.' };
}
