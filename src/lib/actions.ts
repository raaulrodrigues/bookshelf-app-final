"use server";

import { z } from "zod";
import prisma from "./prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Book } from "@prisma/client";
import { notFound } from "next/navigation";

const bookFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  author: z.string().min(2),
  coverUrl: z.string().url().optional().or(z.literal('')),
  year: z.coerce.number().optional(),
  pages: z.coerce.number().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  synopsis: z.string().optional(),
  isbn: z.string().optional(),
  notes: z.string().optional(),
  currentPage: z.coerce.number().optional(),
  status: z.enum(["QUERO_LER", "LENDO", "LIDO", "PAUSADO", "ABANDONADO"]),
  genreName: z.string().optional(),
});

export async function getBooks({
  query,
  genre,
}: {
  query?: string;
  genre?: string;
} = {}) {
  const books = await prisma.book.findMany({
    where: {
      genreName: genre || undefined,
      OR: query
        ? [
            { title: { contains: query } },
            { author: { contains: query } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { genre: true },
  });
  return books;
}

export async function getGenres() {
  const genres = await prisma.genre.findMany({
    orderBy: { name: "asc" },
  });
  return genres;
}

export async function getBook(id: string) {
  try {
    const book = await prisma.book.findUniqueOrThrow({
      where: { id },
      include: { genre: true },
    });
    return book;
  } catch (error) {
    notFound();
  }
}

export async function saveBook(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const validatedFields = bookFormSchema.safeParse(data);

  if (!validatedFields.success) {
    throw new Error("Validation failed");
  }

  const { id, genreName, ...bookData } = validatedFields.data;

  const dataToSave = {
    ...bookData,
    coverUrl: bookData.coverUrl || "",
    genre: genreName
      ? {
          connectOrCreate: {
            where: { name: genreName },
            create: { name: genreName },
          },
        }
      : {
          disconnect: true,
        },
  };
  
  if (id) {
    await prisma.book.update({
      where: { id },
      data: dataToSave,
    });
  } else {
    await prisma.book.create({
      data: dataToSave,
    });
  }

  revalidatePath("/library");
  if (id) {
    revalidatePath(`/library/${id}`);
  }
  redirect("/library");
}

export async function deleteBook(id: string) {
  await prisma.book.delete({
    where: { id },
  });
  revalidatePath("/library");
  redirect("/library");
}

const genreSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
});

export async function createGenre(formData: FormData) {
  const validatedFields = genreSchema.safeParse({
    name: formData.get("name"),
  });

  if (!validatedFields.success) {
    throw new Error("Validation failed");
  }
  
  await prisma.genre.create({
    data: { name: validatedFields.data.name },
  });

  revalidatePath("/genres");
}

export async function deleteGenre(name: string) {
  await prisma.genre.delete({
    where: { name },
  });

  revalidatePath("/genres");
  revalidatePath("/library");
}