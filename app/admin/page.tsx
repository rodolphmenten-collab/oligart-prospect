import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isPlatformAdminEmail } from '@/lib/admin';
import { createVenueRecord } from '@/lib/venues';
import { sendEmail, emailShell } from '@/lib/email';
import { ImpersonateButton } from '@/components/ImpersonateButton';

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/admin');
  if (!(await isPlatformAdminEmail(user.email))) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <p className="font-display text-2xl italic text-bone">Accès non autorisé.</p>
        <p className="mt-3 text-sm text-bone-dim">
          Ce compte ne fait pas partie de l&rsquo;équipe admin Lucky. Demande à un admin
          existant de t&rsquo;ajouter depuis la section Équipe du back-office.
        </p>
      </main>
    );
  }

  // Service role : la vue admin doit voir tous les établissements, en passant outre les RLS.
  const service = createServiceClient();

  const [
    { count: venueCount },
    { count: userCount },
    { count: activeCheckIns },
    { data: reports },
    { data: venues },
    { data: leads },
    { data: admins },
  ] = await Promise.all([
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
    service
      .from('venues')
      .select('id, slug, name, city, type, plan, contact_name, contact_email, invited_at, created_at')
      .order('created_at', { ascending: false }),
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

        <div className="mt-8 grid grid-cols-3 gap-4">
          <StatCard label="Établissements" value={venueCount ?? 0} />
          <StatCard label="Utilisateurs" value={userCount ?? 0} />
          <StatCard label="Présences actives" value={activeCheckIns ?? 0} />
        </div>

        <div className="mt-12 flex items-center justify-between">
          <h2 className="font-display text-xl italic text-bone">Établissements</h2>
          <Link
            href="/admin/venues/new"
            className="rounded-full border hairline px-4 py-2 text-xs tracking-wide text-bone-dim hover:border-white/30"
          >
            + Nouvel établissement
          </Link>
        </div>

        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(venues ?? []).map((v: any) => (
            <div key={v.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm text-bone">{v.name}</p>
                <p className="font-mono text-[11px] text-bone-faint">
                  {v.city} · {v.type} · {v.plan} · /venue/{v.slug}
                </p>
                {v.contact_name && (
                  <p className="mt-1 text-xs text-bone-dim">
                    {v.contact_name} · {v.contact_email}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {v.invited_at ? (
                  <>
                    <span className="text-[11px] text-signal-live">
                      Invité le {new Date(v.invited_at).toLocaleDateString('fr-FR')}
                    </span>
                    <ImpersonateButton venueId={v.id} />
                  </>
                ) : v.contact_email ? (
                  <form action={sendVenueInvite}>
                    <input type="hidden" name="venueId" value={v.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-bone px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-brass-bright"
                    >
                      Envoyer l&rsquo;invitation
                    </button>
                  </form>
                ) : null}
                <Link href={`/admin/venues/${v.id}`} className="text-xs text-brass underline">
                  Modifier
                </Link>
              </div>
            </div>
          ))}
          {(!venues || venues.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">Aucun établissement pour l&rsquo;instant.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">Nouvelles demandes</h2>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(leads ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm text-bone">
                  {l.venue_name} {l.venue_city ? `— ${l.venue_city}` : ''}
                </p>
                <p className="mt-1 text-xs text-bone-dim">
                  {l.contact_name} · {l.contact_email} · {l.venue_type ?? 'n/a'} · plan : {l.plan_interest ?? 'n/a'}
                </p>
                {l.message && <p className="mt-1 text-xs text-bone-faint">{l.message}</p>}
                <p className="mt-1 font-mono text-[11px] text-bone-faint">
                  {new Date(l.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={denyLead}>
                  <input type="hidden" name="leadId" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-400/40 px-4 py-2 text-[11px] text-red-400 hover:bg-red-400/10"
                  >
                    Refuser
                  </button>
                </form>
                <form action={allowLeadAccess}>
                  <input type="hidden" name="leadId" value={l.id} />
                  <button
                    type="submit"
                    className="rounded-full bg-bone px-4 py-2 text-[11px] font-medium text-ink hover:bg-brass-bright"
                  >
                    Autoriser l&rsquo;accès
                  </button>
                </form>
              </div>
            </div>
          ))}
          {(!leads || leads.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">Aucune demande en attente.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">Signalements en attente</h2>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(reports ?? []).map((r: any) => (
            <form key={r.id} action={reviewReport} className="flex items-center justify-between gap-4 px-5 py-4">
              <input type="hidden" name="reportId" value={r.id} />
              <div>
                <p className="text-sm text-bone">{r.reason}</p>
                {r.details && <p className="mt-1 text-xs text-bone-dim">{r.details}</p>}
                <p className="mt-1 font-mono text-[11px] text-bone-faint">
                  {new Date(r.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  formAction={dismissReport}
                  className="rounded-full border hairline px-3 py-1.5 text-[11px] text-bone-dim"
                >
                  Ignorer
                </button>
                <button
                  formAction={reviewReport}
                  className="rounded-full border border-brass/50 px-3 py-1.5 text-[11px] text-brass"
                >
                  Marquer comme traité
                </button>
              </div>
            </form>
          ))}
          {(!reports || reports.length === 0) && (
            <p className="px-5 py-6 text-center text-sm text-bone-faint">Aucun signalement en attente.</p>
          )}
        </div>

        <h2 className="mt-12 font-display text-xl italic text-bone">Équipe</h2>
        <p className="mt-2 text-xs text-bone-faint">
          Toute personne listée ici peut accéder à ce back-office dès qu&rsquo;elle se
          connecte avec cet email (code par email, ou mot de passe si elle en a défini
          un via /admin-login).
        </p>
        <div className="mt-4 divide-y hairline rounded-2xl border hairline">
          {(admins ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-bone">{a.email}</p>
                <p className="mt-0.5 font-mono text-[11px] text-bone-faint">
                  Ajouté le {new Date(a.added_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {a.email.toLowerCase() !== user.email?.toLowerCase() && (
                <form action={removeAdmin}>
                  <input type="hidden" name="adminId" value={a.id} />
                  <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                    Retirer
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
            placeholder="collegue@lucky-app.io"
            className="flex-1 rounded-full border hairline bg-transparent px-5 py-3 text-sm text-bone placeholder:text-bone-faint focus:border-brass"
          />
          <button
            type="submit"
            className="rounded-full bg-bone px-5 py-3 text-sm font-medium text-ink hover:bg-brass-bright"
          >
            Ajouter
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

function inviteEmailHtml(firstName: string, venueName: string, actionLink: string) {
  return emailShell(`
    <h1 style="font-size:22px; margin: 0 0 16px;">Bienvenue chez Lucky, ${firstName} !</h1>
    <p style="font-size:14px; line-height:1.6; color:#333;">
      Nous sommes ravis d'accueillir <strong>${venueName}</strong> au sein du réseau Lucky.
    </p>
    <p style="font-size:14px; line-height:1.6; color:#333;">
      Grâce à vous, les personnes présentes chez vous pourront se découvrir et
      entrer en contact les unes avec les autres, en toute confiance, pendant
      qu'elles profitent de votre établissement.
    </p>
    <p style="font-size:14px; line-height:1.6; color:#333;">
      Pour activer votre compte et accéder à votre tableau de bord, il ne vous
      reste qu'à choisir un mot de passe :
    </p>
    <p style="margin: 24px 0;">
      <a href="${actionLink}" style="display:inline-block; background:#0B0A08; color:#F4EFE6; padding:12px 24px; border-radius:999px; text-decoration:none; font-size:14px; font-weight:600;">
        Activer mon compte
      </a>
    </p>
    <p style="font-size:14px; color:#333;">À très vite,<br />L'équipe Lucky</p>
  `);
}

async function sendVenueInvite(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const venueId = formData.get('venueId') as string;
  const service = createServiceClient();

  const { data: venue } = await service
    .from('venues')
    .select('id, name, contact_name, contact_email')
    .eq('id', venueId)
    .maybeSingle();

  if (!venue || !venue.contact_email) return;

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent('/venue-set-password')}`;

  const { data: userList } = await service.auth.admin.listUsers();
  const existingUser = userList?.users?.find(
    (u: any) => u.email?.toLowerCase() === venue.contact_email.toLowerCase()
  );

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink(
    existingUser
      ? { type: 'recovery', email: venue.contact_email, options: { redirectTo } }
      : { type: 'invite', email: venue.contact_email, options: { redirectTo } }
  );

  if (linkError || !linkData?.properties?.action_link) return;

  const userId = existingUser?.id ?? linkData.user?.id;
  if (userId) {
    await service.from('venue_admins').insert({ venue_id: venue.id, user_id: userId, role: 'owner' }).select().maybeSingle();
  }

  const firstName = (venue.contact_name || '').split(' ')[0] || 'là-bas';

  await sendEmail({
    to: venue.contact_email,
    subject: `Bienvenue chez Lucky, ${firstName} !`,
    html: inviteEmailHtml(firstName, venue.name, linkData.properties.action_link),
  });

  await service.from('venues').update({ invited_at: new Date().toISOString() }).eq('id', venueId);
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

async function denyLead(formData: FormData) {
  'use server';
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdminEmail(user.email))) return;

  const id = formData.get('leadId') as string;
  const service = createServiceClient();
  await service.from('venue_leads').update({ status: 'denied' }).eq('id', id);
  revalidatePath('/admin');
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
    contactName: lead.contact_name,
    contactEmail: lead.contact_email,
  });

  if (venueError || !venue) return;

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent('/venue-set-password')}`;

  const { data: userList } = await service.auth.admin.listUsers();
  const existingUser = userList?.users?.find(
    (u: any) => u.email?.toLowerCase() === lead.contact_email.toLowerCase()
  );

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink(
    existingUser
      ? { type: 'recovery', email: lead.contact_email, options: { redirectTo } }
      : { type: 'invite', email: lead.contact_email, options: { redirectTo } }
  );

  const userId = existingUser?.id ?? linkData?.user?.id;
  if (userId) {
    await service.from('venue_admins').insert({ venue_id: venue.id, user_id: userId, role: 'owner' });
  }

  if (!linkError && linkData?.properties?.action_link) {
    const firstName = (lead.contact_name || '').split(' ')[0] || 'là-bas';
    await sendEmail({
      to: lead.contact_email,
      subject: `Bienvenue chez Lucky, ${firstName} !`,
      html: inviteEmailHtml(firstName, venue.name ?? lead.venue_name, linkData.properties.action_link),
    });
  }

  await service.from('venues').update({ invited_at: new Date().toISOString() }).eq('id', venue.id);
  await service.from('venue_leads').update({ status: 'handled' }).eq('id', leadId);
  revalidatePath('/admin');
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
