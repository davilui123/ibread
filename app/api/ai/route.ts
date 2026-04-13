import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "API Key faltando na Vercel" }, { status: 500 });
    }

    // Usando a versão mais estável do modelo
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = "";
    if (action === 'persona') {
      prompt = `Aja como um guia literário. No livro "${bookTitle}", descreva quem é o personagem "${text}". Fale sobre sua personalidade e papel na história de forma elegante.`;
    } else {
      prompt = `Explique o significado ou contexto de "${text}" dentro do livro "${bookTitle}". Seja breve e sofisticado.`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    if (!responseText) {
      return NextResponse.json({ result: "A IA não conseguiu analisar este trecho." });
    }

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("ERRO IA:", error);
    // Retorna o erro detalhado para você ver na tela o que está bloqueando
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}