import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { bookTitle, author } = await req.json();

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você deve responder apenas com JSON puro, sem explicações."
        },
        {
          role: "user",
          content: `Liste 10 personagens do livro "${bookTitle}" de "${author}". Retorne um array JSON: [{"name": "Nome", "role": "Papel", "description": "Bio"}].`
        }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" } // O Groq garante que venha JSON
    });

    const rawContent = completion.choices[0]?.message?.content || "[]";
    return NextResponse.json(JSON.parse(rawContent));
  } catch (error: any) {
    return NextResponse.json([]);
  }
}