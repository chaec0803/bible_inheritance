import { respondToRelayInviteRequest } from '@/lib/relay-invite-server';

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  return respondToRelayInviteRequest(request, projectId, 'decline');
}
