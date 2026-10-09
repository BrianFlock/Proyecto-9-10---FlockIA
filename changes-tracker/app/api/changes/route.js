import { NextResponse } from 'next/server';
import { store, storageKind, validate, ValidationError } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // On Vercel the filesystem is read-only, so file storage there means the DB isn't connected yet.
    const storage = process.env.VERCEL && storageKind === 'file' ? 'missing-db' : storageKind;
    return NextResponse.json({ storage, changes: await store.list() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudieron leer los cambios.' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const data = validate(await req.json());
    return NextResponse.json(await store.create(data), { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 });
  }
}
