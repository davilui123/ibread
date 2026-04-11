import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, bookTitle, action } = await req.json();

    if (!text) return NextResponse.json({ error: "Sem texto" }, { status: 400 });

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    let prompt = "";

    if (action === 'persona') {
      prompt = `Aja como um concept artist de cinema. Com base no trecho do livro "${bookTitle}": "${text}", crie um perfil visual detalhado do personagem mencionado. Descreva vestimenta, traços faciais, aura e postura. Termine a resposta com um parágrafo em INGLÊS entre colchetes [ ] que sirva de prompt para um gerador de imagem realista.`;
    } else {
      prompt = `Você é o Mentor de Contexto do IBRead. Analise este trecho de "${bookTitle}": "${text}". 
      Se for uma palavra: dê o significado e etimologia. 
      Se for frase/parágrafo: explique o subtexto e a intenção literária sem spoilers. 
      Seja elegante e direto.`;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) throw new Error("Resposta vazia da IA");

    return NextResponse.json({ result: responseText });
  } catch (error: any) {
    console.error("ERRO IA:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}