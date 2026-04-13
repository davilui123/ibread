import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { bookTitle, author } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Liste 10 personagens do livro "${bookTitle}". Responda APENAS com um array JSON puro: [{"name": "Nome", "role": "Papel", "description": "Bio"}]. Sem markdown ou textos extras.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text().trim();
    
    // Limpeza de possíveis formatações que a IA coloca
    const jsonString = rawText.replace(/```json|```/g, "").trim();
    
    return NextResponse.json(JSON.parse(jsonString));
  } catch (error: any) {
    console.error("Erro Scan:", error);
    // Se der erro, retorna um array vazio para não quebrar o leitor
    return NextResponse.json([]);
  }
}