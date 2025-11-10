import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/pregunta', async (req, res) => {
  const { pregunta } = req.body;
  if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta' });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: pregunta }],
      temperature: 0.7,
      max_tokens: 500
    });

    const respuesta = completion.choices[0].message.content;
    res.json({ respuesta });
  } catch (err) {
    console.error("💥 Error IA:", err);
    res.status(500).json({ error: "Ocurrió un error al generar la respuesta" });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`🧠 Worker IA corriendo en puerto ${PORT}`));
