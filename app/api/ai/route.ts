import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Forçamos a inicialização correta
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    // Tente usar 'gemini-1.5-flash-latest' ou apenas 'gemini-1.5-flash'
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });

    let prompt = "";
    if (action === 'persona') {
      prompt = `Aja como um especialista literário. Descreva o personagem "${text}" no contexto do livro "${bookTitle}". Se for um personagem conhecido, traga sua ficha técnica (papel, personalidade, aparência).`;
    } else {
      prompt = `Explique o contexto de "${text}" no livro "${bookTitle}" de forma elegante e sem spoilers.`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("ERRO DETALHADO:", error);
    return NextResponse.json({ error: "Erro na IA: " + error.message }, { status: 500 });
  }
}