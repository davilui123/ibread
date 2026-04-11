import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, action } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompts = {
      explain: `Explique o seguinte trecho de forma simples e didática para um estudante: "${text}"`,
      summarize: `Resuma os pontos principais deste trecho de livro: "${text}"`,
      insight: `Crie um insight prático ou uma aplicação real para este pensamento: "${text}"`,
    };

    const prompt = prompts[action as keyof typeof prompts] || prompts.explain;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return NextResponse.json({ result: response.text() });
  } catch (error) {
    return NextResponse.json({ error: "Erro na IA" }, { status: 500 });
  }
}