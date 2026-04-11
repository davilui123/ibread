import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { bookTitle, author } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Identifique os 10 personagens mais importantes do livro "${bookTitle}" de "${author}". 
    Para cada personagem, forneça:
    1. Nome exato (como aparece no texto).
    2. Papel na trama (Protagonista, Antagonista, etc).
    3. Breve descrição de personalidade e características físicas.
    Retorne apenas um array JSON puro, sem formatação markdown, com os campos: name, role, description.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "");
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    return NextResponse.json({ error: "Erro ao escanear personagens" }, { status: 500 });
  }
}