import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { bookTitle, author } = await req.json();

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um analista literário. Você deve responder estritamente com um objeto JSON puro."
        },
        {
          role: "user",
          content: `Liste os 10 personagens mais importantes do livro "${bookTitle}" de "${author}". 
          Retorne um objeto JSON com uma chave chamada "characters" contendo um array de objetos com: "name", "role" e "description". 
          Não inclua nenhum texto antes ou depois do JSON.`
        }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0]?.message?.content || '{"characters": []}';
    const parsedData = JSON.parse(rawContent);
    
    // Retornamos apenas o array para manter a compatibilidade com o frontend
    return NextResponse.json(parsedData.characters || []);
  } catch (error: any) {
    console.error("Erro Scan Personagens:", error);
    return NextResponse.json([]); // Retorna vazio em caso de erro para não travar o app
  }
}