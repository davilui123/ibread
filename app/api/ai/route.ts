import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Inicializa a IA com a chave que você configurou na Vercel e no .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Nenhum texto fornecido" }, { status: 400 });
    }

    // Usamos o modelo Flash por ser extremamente rápido e eficiente para esse tipo de análise
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt mestre que define a personalidade do IBRead
    const prompt = `
      Você é o "Mentor de Contexto" integrado ao IBRead, um leitor de eBooks de luxo e minimalista.
      Sua missão é auxiliar o leitor a compreender profundamente o livro "${bookTitle || 'obra selecionada'}".

      Analise o seguinte trecho: "${text}"

      Diretrizes de resposta:
      1. SE O TEXTO FOR APENAS UMA PALAVRA: Aja como um dicionário contextual. Explique o significado, a etimologia e como ela se encaixa no tom do autor.
      2. SE O TEXTO FOR UMA FRASE OU PARÁGRAFO: Explique o subtexto, as intenções do personagem (se houver) e o impacto literário. 
      3. IMPORTANTE: Nunca forneça spoilers de eventos que acontecem após este trecho no livro.
      4. TOM DE VOZ: Use uma linguagem elegante, culta, porém acessível. Evite introduções clichês como "Aqui está a análise". Vá direto ao ponto com profundidade.

      Formate a resposta para ser lida em uma interface limpa, usando parágrafos curtos.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("Erro na API de IA:", error);
    return NextResponse.json(
      { error: "O Mentor de Contexto teve um problema ao ler este trecho." },
      { status: 500 }
    );
  }
}