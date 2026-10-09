import { NextResponse } from 'next/server';
import { store, validate, ValidationError } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function PUT(req, { params }) {
  const { id } = await params;
  try {
    const row = await store.update(id, validate(await req.json()));
    if (!row) return NextResponse.json({ error: 'El cambio ya no existe.' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: 'No se pudo actualizar el cambio.' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  try {
    const ok = await store.remove(id);
    if (!ok) return NextResponse.json({ error: 'El cambio ya no existe.' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'No se pudo borrar el cambio.' }, { status: 500 });
  }
}
