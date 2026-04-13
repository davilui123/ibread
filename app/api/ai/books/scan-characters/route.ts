import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { bookTitle, author } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Liste os 10 personagens principais do livro "${bookTitle}" de "${author}". Retorne APENAS um array JSON puro com objetos contendo: name, role, description. Não use markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json|```/g, "").trim();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}