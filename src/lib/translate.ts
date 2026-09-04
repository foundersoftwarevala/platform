export type LangCode = "en" | "hi" | "es" | "fr" | "de" | "ar" | "ja";

/**
 * Offline demo translator: sentence-level dictionary for the seeded conversation
 * content, with a word-level fallback so any typed message still translates.
 */
const sentences: Record<string, Partial<Record<LangCode, string>>> = {
  "Hello Amit! 👋 How can I assist you today?": {
    hi: "नमस्ते अमित! 👋 मैं आपकी किस प्रकार सहायता कर सकता हूँ?",
    es: "¡Hola Amit! 👋 ¿Cómo puedo ayudarte hoy?",
    fr: "Bonjour Amit ! 👋 Comment puis-je vous aider aujourd'hui ?",
    de: "Hallo Amit! 👋 Wie kann ich Ihnen heute helfen?",
    ar: "مرحبا أميت! 👋 كيف يمكنني مساعدتك اليوم؟",
    ja: "こんにちは、アミットさん！👋 本日はどのようなご用件でしょうか？",
  },
  "I need help with my school management software. Can you give me the key features?": {
    hi: "मुझे अपने स्कूल मैनेजमेंट सॉफ़्टवेयर में मदद चाहिए। क्या आप मुख्य विशेषताएँ बता सकते हैं?",
    es: "Necesito ayuda con mi software de gestión escolar. ¿Puedes darme las funciones clave?",
    fr: "J'ai besoin d'aide avec mon logiciel de gestion scolaire. Pouvez-vous me donner les fonctionnalités clés ?",
    de: "Ich brauche Hilfe mit meiner Schulverwaltungssoftware. Können Sie mir die wichtigsten Funktionen nennen?",
    ar: "أحتاج مساعدة في برنامج إدارة المدرسة. هل يمكنك ذكر الميزات الرئيسية؟",
    ja: "学校管理ソフトについて助けが必要です。主な機能を教えてもらえますか？",
  },
  "Sure! Our School Management Software includes:": {
    hi: "बिल्कुल! हमारे स्कूल मैनेजमेंट सॉफ़्टवेयर में शामिल है:",
    es: "¡Claro! Nuestro software de gestión escolar incluye:",
    fr: "Bien sûr ! Notre logiciel de gestion scolaire comprend :",
    de: "Sicher! Unsere Schulverwaltungssoftware umfasst:",
    ar: "بالتأكيد! يتضمن برنامج إدارة المدرسة لدينا:",
    ja: "もちろんです！当社の学校管理ソフトには次が含まれます：",
  },
  "Yes, please share the demo.": {
    hi: "हाँ, कृपया डेमो साझा करें।",
    es: "Sí, comparte la demostración por favor.",
    fr: "Oui, partagez la démo s'il vous plaît.",
    de: "Ja, bitte teilen Sie die Demo.",
    ar: "نعم، يرجى مشاركة العرض التجريبي.",
    ja: "はい、デモを共有してください。",
  },
  "Here is the demo. Let me know if you need anything else! 🙂": {
    hi: "यह डेमो है। कुछ और चाहिए तो बताइए! 🙂",
    es: "Aquí está la demostración. ¡Avísame si necesitas algo más! 🙂",
    fr: "Voici la démo. Dites-moi si vous avez besoin d'autre chose ! 🙂",
    de: "Hier ist die Demo. Sagen Sie mir, wenn Sie noch etwas brauchen! 🙂",
    ar: "هذا هو العرض التجريبي. أخبرني إذا احتجت أي شيء آخر! 🙂",
    ja: "こちらがデモです。他に必要なことがあればお知らせください！🙂",
  },
};

const words: Record<string, Partial<Record<LangCode, string>>> = {
  hello: { hi: "नमस्ते", es: "hola", fr: "bonjour", de: "hallo", ar: "مرحبا", ja: "こんにちは" },
  hi: { hi: "नमस्ते", es: "hola", fr: "salut", de: "hallo", ar: "مرحبا", ja: "こんにちは" },
  thanks: { hi: "धन्यवाद", es: "gracias", fr: "merci", de: "danke", ar: "شكرا", ja: "ありがとう" },
  please: { hi: "कृपया", es: "por favor", fr: "s'il vous plaît", de: "bitte", ar: "من فضلك", ja: "お願いします" },
  yes: { hi: "हाँ", es: "sí", fr: "oui", de: "ja", ar: "نعم", ja: "はい" },
  no: { hi: "नहीं", es: "no", fr: "non", de: "nein", ar: "لا", ja: "いいえ" },
  help: { hi: "मदद", es: "ayuda", fr: "aide", de: "Hilfe", ar: "مساعدة", ja: "助け" },
  demo: { hi: "डेमो", es: "demostración", fr: "démo", de: "Demo", ar: "عرض", ja: "デモ" },
  team: { hi: "टीम", es: "equipo", fr: "équipe", de: "Team", ar: "فريق", ja: "チーム" },
  report: { hi: "रिपोर्ट", es: "informe", fr: "rapport", de: "Bericht", ar: "تقرير", ja: "レポート" },
  invoice: { hi: "चालान", es: "factura", fr: "facture", de: "Rechnung", ar: "فاتورة", ja: "請求書" },
  software: { hi: "सॉफ़्टवेयर", es: "software", fr: "logiciel", de: "Software", ar: "برمجيات", ja: "ソフトウェア" },
  student: { hi: "छात्र", es: "estudiante", fr: "étudiant", de: "Student", ar: "طالب", ja: "学生" },
  today: { hi: "आज", es: "hoy", fr: "aujourd'hui", de: "heute", ar: "اليوم", ja: "今日" },
  good: { hi: "अच्छा", es: "bueno", fr: "bon", de: "gut", ar: "جيد", ja: "良い" },
  meeting: { hi: "बैठक", es: "reunión", fr: "réunion", de: "Besprechung", ar: "اجتماع", ja: "会議" },
};

export function translateText(text: string, lang: LangCode): string {
  if (lang === "en") return text;
  const direct = sentences[text.trim()]?.[lang];
  if (direct) return direct;

  return text
    .split(/(\s+)/)
    .map((token) => {
      const core = token.toLowerCase().replace(/[^a-z']/g, "");
      const hit = core && words[core]?.[lang];
      return hit ?? token;
    })
    .join("");
}
