import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    // FORÇANDO API V1 (ESTÁVEL)
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: 'v1' } 
    );

    const prompt = action === 'persona' 
      ? `Descreva o personagem "${text}" no livro "${bookTitle}".`
      : `Explique o contexto de "${text}" no livro "${bookTitle}".`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("DEBUG:", error);
    return NextResponse.json({ error: "Erro: " + error.message }, { status: 500 });
  }
}