import { NextResponse } from 'next/server';
import { AI_PROVIDERS, getProviderApiKey } from '@/app/lib/ai/config';

export async function GET() {
  const models = Object.values(AI_PROVIDERS).map((provider) => ({
    id: provider.id,
    name: provider.name,
    available: Boolean(getProviderApiKey(provider.id)),
  }));
  return NextResponse.json(models);
}
