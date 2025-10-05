import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const genres = await prisma.genre.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(genres);
}