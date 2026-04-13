import Groq from "groq-sdk";
import { NextResponse } from "next/server";

// Inicializa o Groq com a chave do ambiente (certifique-se de que está na Vercel e .env.local)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY não configurada." }, { status: 500 });
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um mentor literário sofisticado do app IBRead. Sua missão é ajudar o leitor a entender profundamente a obra, sem dar spoilers."
        },
        {
          role: "user",
          content: action === 'persona' 
            ? `Descreva detalhadamente o personagem "${text}" no contexto do livro "${bookTitle}". Fale sobre sua personalidade, motivações e papel na trama de forma elegante.`
            : `Explique o contexto ou o significado profundo do trecho "${text}" dentro do livro "${bookTitle}". Seja breve, sofisticado e vá direto ao ponto.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
    });

    const responseText = completion.choices[0]?.message?.content || "O Mentor não conseguiu analisar este trecho agora.";

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("Erro Groq AI:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}