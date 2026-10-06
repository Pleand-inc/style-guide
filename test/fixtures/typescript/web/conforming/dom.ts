export const headings = () => {
  const texts: string[] = [];
  for (const heading of document.querySelectorAll("h1")) {
    texts.push(heading.textContent ?? "");
  }
  return texts;
};
