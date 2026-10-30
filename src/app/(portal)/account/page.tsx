import { requireAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { changeOwnPasswordAction, updateOwnProfileAction } from '@/lib/actions/auth';
import { ActionForm } from '@/components/ui/action-form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Textarea,
  Label,
} from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/utils';
import { UserCircle, KeyRound, Camera } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const profile = await requireAuth();

  let signedAvatarUrl: string | null = null;
  if (profile.photo_path) {
    const serviceClient = createServiceRoleClient();
    const { data } = await serviceClient.storage
      .from('profile-photos')
      .createSignedUrl(profile.photo_path, 3600);
    signedAvatarUrl = data?.signedUrl || null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-blue-700" />
          My Profile &amp; Security
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Manage your contact details, profile photograph (`profile-photos` private bucket ≤ 2 MB), and account password
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Identity Summary</CardTitle>
            <CardDescription>Verified institutional account record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {signedAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedAvatarUrl}
                  alt={profile.full_name}
                  className="h-16 w-16 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-800 text-xl font-bold">
                  {profile.full_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="font-bold text-slate-900">{profile.full_name}</h2>
                <p className="text-xs text-slate-500">@{profile.username}</p>
                <Badge variant="default" className="mt-1">
                  {ROLE_LABELS[profile.role]}
                </Badge>
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs pt-2">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Account Code</span>
                <span className="font-mono font-semibold text-slate-800">{profile.code}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-800">{profile.email}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium text-slate-800">{profile.phone || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-700" />
              Update Contact &amp; Photograph
            </CardTitle>
            <CardDescription>
              Upload a JPEG or PNG photograph (maximum 2 MB) to private Supabase Storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={updateOwnProfileAction}
              submitLabel="Save Profile Changes"
              className="space-y-3"
            >
              <div>
                <Label htmlFor="prof-phone">Mobile / Phone Number (+91)</Label>
                <Input
                  id="prof-phone"
                  name="phone"
                  defaultValue={profile.phone || ''}
                  placeholder="+91 98300 00000"
                />
              </div>
              <div>
                <Label htmlFor="prof-addr">Residential Address</Label>
                <Textarea
                  id="prof-addr"
                  name="address"
                  defaultValue={profile.address || ''}
                  placeholder="Street, Locality, City, PIN Code"
                />
              </div>
              <div>
                <Label htmlFor="prof-photo">Profile Photograph (JPEG/PNG ≤ 2 MB)</Label>
                <Input
                  id="prof-photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                />
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-700" />
              Change Account Password
            </CardTitle>
            <CardDescription>
              Requires at least 8 characters. Recorded in the security audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={changeOwnPasswordAction}
              submitLabel="Update Password"
              resetOnSuccess
              className="space-y-3"
            >
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
