export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'No file provided' });

    const GEMINI_KEY = process.env.VITE_GEMINI_KEY;
    if (!GEMINI_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const ALL_ORGS = [
      "เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย",
      "เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ",
      "เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ",
      "เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง",
      "เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง",
      "อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน",
      "อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล",
      "อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง",
      "อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน",
      "อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี"
    ];

    const prompt = `อ่านข้อมูลจากเอกสารนี้ แล้วตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

รายชื่อหน่วยงานในระบบ:
${ALL_ORGS.join("\n")}

รูปแบบ JSON ที่ต้องการ:
{"rows":[{"name":"ชื่อในเอกสาร","matched":"ชื่อที่ตรงกับรายชื่อในระบบมากที่สุด","count":0,"p97":0.0,"p3":0.0,"amount":0}],"total_count":0,"total_p97":0.0,"total_p3":0.0,"total_amount":0}

หมายเหตุ: p97 = คอลัมน์ 97%, p3 = คอลัมน์ 3%`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType || 'application/pdf', data: fileBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 4000 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Gemini error: ${err.slice(0, 200)}` });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'ไม่พบ JSON ในคำตอบ', raw: text.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
