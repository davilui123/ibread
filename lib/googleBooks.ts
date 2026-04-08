export const searchBookByTitle = async (title: string) => {
  if (!title) return null;
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`
    );
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const info = data.items[0].volumeInfo;
      return {
        title: info.title,
        author: info.authors ? info.authors.join(', ') : "Autor desconhecido",
        description: info.description || "",
        pageCount: info.pageCount || 0,
        coverUrl: info.imageLinks?.thumbnail?.replace('http:', 'https:') || ""
      };
    }
  } catch (error) {
    console.error("Erro ao buscar livro no Google:", error);
  }
  return null;
};