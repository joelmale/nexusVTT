import { useEffect } from 'react';

const TTRPG_FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;700;900&family=MedievalSharp&family=Oswald:wght@400;700&family=Uncial+Antiqua&display=swap';

export const useTTRPGFonts = (): void => {
  useEffect(() => {
    const fontId = 'ttrpg-gothic-fonts';
    if (document.getElementById(fontId)) return;

    const link = document.createElement('link');
    link.id = fontId;
    link.href = TTRPG_FONT_STYLESHEET;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);
};
