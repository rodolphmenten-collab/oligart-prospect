import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';
import { createVenueRecord } from '@/lib/venues';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tempEmail?: string; tempPassword?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/admin');
  if (!(await isPlatformAdminEmail(user.email))) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="font-display text-2xl italic text-bone">Not authorized.</p>
        <p className="mt-3 text-sm text-bone-dim">
          This account isn&rsquo;t on the Lucky admin team. Ask an existing admin to add
          you from the Team section of the back-office.
        </p>
      </main>
    );
  }

  // Service role: admin overview needs to see across every venue, bypassing RLS.
  const service = createServiceClient();

  const [
    { count: venueCount },
    { count: userCount },
    { count: activeCheckIns },
    { data: reports },
    { data: venues },
    { data: leads },
    { data: admins },
  ] =
    await Promise.all([
      service.from('venues').select('*', { count: 'exact', head: true }),
      service.from('profiles').select('*', { count: 'exact', head: true }),
      service
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .in('presence_status', ['verified_now', 'recently_verified']),
      service
        .from('reports')
        .select('id, reason, details, status, created_at, reporter_id, reported_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      service.from('venues').select('id, slug, name, city, type, plan, created_at').order('created_at', { ascending: false }),
      service
        .from('venue_leads')
        .select('id, contact_name, contact_email, venue_name, venue_city, venue_type, plan_interest, message, status, created_at')
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(20),
      service.from('platform_admins').select('id, email, added_at').order('added_at', { ascending: true }),
    ]);

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-brass">Admin</p>
        <h1 className="mt-2 font-display text-3xl italic text-bone">Back-office</h1>

        {searchParams.tempPassword && (
          <div className="mt-6 rounded-2xl border border-brass/50 bg-brass/5 p-5">
            <p className="text-sm text-bone">
              Account ready for <span className="text-brass">{searchParams.tempEmail}</span> — no email was sent.
            </p>
            <p className="mt-1 font-mono text-sm text-brass">Password: {searchParams.tempPassword}</p>
            <p className="mt-2 text-xs text-bone-faint">
              Share this manually (phone, Slack, in person). They can sign in at /venue-login
              and change it later from their dashboard. This is shown once and won&rsquo;t be
              stored anywhere retrievable.
            </p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-4">
          <StatCard label="Venues" value={venueCount ?? 0} />
          <StatCard label="Users" value={userCount ?? 0} />
          <StatCard label="Active check-ins" value={activeCheckIns ?? 0} />
        </div>

        <div className="mt-12 flex items-center justify-between">
          <h2 className="font-display text-xl italic text-bone">Venues</h2>
          <Link
            href="/admin/venues/new"
            className="rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-white/30"
          >
            + New venue
          </Link>
        </div>

        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(venues ?? []).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-bone">{v.name}</p>
                <p className="font-mono text-[11px] text-bone-faint">
                  {v.city} · {v.type} · {v.plan} · /venue/{v.slug}
                </p>
              </div>
              <Link href={`/admin/venues/${v.id}`} className="text-xs text-brass underline">
                Edit
              </Link>
            </div>
          ))}
          {(!venues || venues.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">No venues yet.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">New venue requests</h2>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(leads ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm text-bone">
                  {l.venue_name} {l.venue_city ? `— ${l.venue_city}` : ''}
                </p>
                <p className="mt-1 text-xs text-bone-dim">
                  {l.contact_name} · {l.contact_email} · {l.venue_type ?? 'n/a'} · plan: {l.plan_interest ?? 'n/a'}
                </p>
                {l.message && <p className="mt-1 text-xs text-bone-faint">{l.message}</p>}
                <p className="mt-1 font-mono text-[11px] text-bone-faint">
                  {new Date(l.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={setTempPassword}>
                  <input type="hidden" name="leadId" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-full border hairline px-3 py-2 text-[11px] text-bone-dim hover:border-brass hover:text-brass"
                  >
                    No email — give me a password
                  </button>
                </form>
                <form action={allowLeadAccess}>
                  <input type="hidden" name="leadId" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-full bg-bone px-4 py-2 text-[11px] font-medium text-ink hover:bg-brass-bright"
                  >
                    Allow access
                  </button>
                </form>
              </div>
            </div>
          ))}
          {(!leads || leads.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">No pending requests.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">Pending reports</h2>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(reports ?? []).map((r: any) => (
            <form key={r.id} action={reviewReport} className="flex items-center justify-between gap-4 px-5 py-4">
              <input type="hidden" name="reportId" value={r.id} />
              <div>
                <p className="text-sm text-bone">{r.reason}</p>
                {r.details && <p className="mt-1 text-xs text-bone-dim">{r.details}</p>}
                <p className="mt-1 font-mono text-[11px] text-bone-faint">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  formAction={dismissReport}
                  className="rounded-full border hairline px-3 py-1.5 text-[11px] text-bone-dim"
                >
                  Dismiss
                </button>
                <button
                  formAction={reviewReport}
                  className="rounded-full border border-brass/50 px-3 py-1.5 text-[11px] text-brass"
                >
                  Mark reviewed
                </button>
              </div>
            </form>
          ))}
          {(!reports || reports.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">No pending reports.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">Team</h2>
        <p className="mt-2 text-xs text-bone-faint">
          Anyone listed here can access this back-office once they sign in with that
          email (magic-link code, or password if they set one via /admin-login).
        </p>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(admins ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-bone">{a.email}</p>
                <p className="mt-0.5 font-mono text-[11px] text-bone-faint">
                  Added {new Date(a.added_at).toLocaleDateString()}
                </p>
              </div>
              {a.email.toLowerCase() !== user.email?.toLowerCase() && (
                <form action={removeAdmin}>
                  <input type="hidden" name="adminId" value={a.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
        <form action={addAdmin} className="mt-4 flex gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="colleague@lucky-app.io"
            className="flex-1 rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <button
            type="submit"
            className="rounded-full bg-bone px-5 py-3 text-sm font-medium text-ink hover:bg-brass-bright"
          >
            Add
          </button>
        </form>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border hairline p-5">
      <p className="font-display text-3xl text-bone">{value}</p>
      <p className="mt-1 text-xs text-bone-faint">{label}</p>
    </div>
  );
}

async function reviewReport(formData: FormData) {
  'use server';
  const id = formData.get('reportId') as string;
  const service = createServiceClient();
  await service.from('reports').update({ status: 'reviewed' }).eq('id', id);
  revalidatePath('/admin');
}

async function dismissReport(formData: FormData) {
  'use server';
  const id = formData.get('reportId') as string;
  const service = createServiceClient();
  await service.from('reports').update({ status: 'dismissed' }).eq('id', id);
  revalidatePath('/admin');
}

async function addAdmin(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  if (!email) return;

  const service = createServiceClient();
  await service.from('platform_admins').insert({ email }).select().maybeSingle();
  revalidatePath('/admin');
}

async function removeAdmin(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const adminId = formData.get('adminId') as string;
  const service = createServiceClient();
  await service.from('platform_admins').delete().eq('id', adminId);
  revalidatePath('/admin');
}

async function markLeadHandled(formData: FormData) {
  'use server';
  const id = formData.get('leadId') as string;
  const service = createServiceClient();
  await service.from('venue_leads').update({ status: 'handled' }).eq('id', id);
  revalidatePath('/admin');
}

async function setTempPassword(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const leadId = formData.get('leadId') as string;
  const service = createServiceClient();

  const { data: lead } = await service.from('venue_leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return;

  const { data: venue, error: venueError } = await createVenueRecord(service, {
    name: lead.venue_name,
    city: lead.venue_city,
    type: lead.venue_type,
    plan: lead.plan_interest,
  });
  if (venueError || !venue) return;

  const tempPassword = `Here-${Math.random().toString(36).slice(2, 10)}!`;

  const { data: userList } = await service.auth.admin.listUsers();
  let userId = userList?.users?.find((u: any) => u.email?.toLowerCase() === lead.contact_email.toLowerCase())?.id;

  if (userId) {
    await service.auth.admin.updateUserById(userId, { password: tempPassword });
  } else {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: lead.contact_email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError) return;
    userId = created?.user?.id;
  }

  if (userId) {
    await service.from('venue_admins').insert({ venue_id: venue.id, user_id: userId, role: 'owner' });
  }

  await service
    .from('venue_leads')
    .update({ status: 'handled' })
    .eq('id', leadId);

  revalidatePath('/admin');
  redirect(`/admin?tempEmail=${encodeURIComponent(lead.contact_email)}&tempPassword=${encodeURIComponent(tempPassword)}`);
}

async function allowLeadAccess(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const leadId = formData.get('leadId') as string;
  const service = createServiceClient();

  const { data: lead } = await service.from('venue_leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return;

  const { data: venue, error: venueError } = await createVenueRecord(service, {
    name: lead.venue_name,
    city: lead.venue_city,
    type: lead.venue_type,
    plan: lead.plan_interest,
  });

  if (venueError || !venue) return;

  // Find or create the contact's account, then send them a link that lets them
  // set a password and lands them on /venue-set-password. New contacts get a
  // Supabase "invite" email; contacts who already have an account (e.g. they'd
  // tried the consumer app first) get a password-reset email instead — both
  // land the same way, authenticated, ready to choose a password.
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent('/venue-set-password')}`;

  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(lead.contact_email, {
    redirectTo,
  });

  let userId = invited?.user?.id;

  if (inviteError) {
    // Most likely cause: this email is already registered. Fall back to a
    // password-reset email, which works the same way for an existing account.
    const { data: userList } = await service.auth.admin.listUsers();
    userId = userList?.users?.find((u: any) => u.email?.toLowerCase() === lead.contact_email.toLowerCase())?.id;
    await service.auth.resetPasswordForEmail(lead.contact_email, { redirectTo });
  }

  if (userId) {
    await service.from('venue_admins').insert({ venue_id: venue.id, user_id: userId, role: 'owner' });
  }

  await service.from('venue_leads').update({ status: 'handled' }).eq('id', leadId);
  revalidatePath('/admin');
}
