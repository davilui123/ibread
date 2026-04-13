import Groq from "groq-sdk";
import { NextResponse } from "next/server";

// Inicializa o Groq com a chave do ambiente
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY não configurada na Vercel" }, { status: 500 });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um mentor literário sofisticado. Ajude o usuário a entender personagens e contextos de livros."
        },
        {
          role: "user",
          content: action === 'persona' 
            ? `Descreva brevemente o personagem "${text}" do livro "${bookTitle}". Fale sobre papel na trama e personalidade.`
            : `Explique o contexto ou significado de "${text}" no livro "${bookTitle}".`
        }
      ],
      model: "llama3-8b-8192", // Modelo ultra-rápido e gratuito
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || "Não consegui processar a informação.";

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("Erro Groq:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}