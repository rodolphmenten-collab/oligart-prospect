import { redirect } from 'next/navigation';

// Self-serve instant signup was replaced by the request-access + admin-approval
// flow (see the landing page's #request-access form and /admin's "Allow access").
// This route stays as a redirect so old links/bookmarks don't dead-end.
export default function VenueSignupRedirect() {
  redirect('/#request-access');
}
