const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Simple dotenv parser
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf-8");
  env.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  });
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const EXTRACTION_PROMPT = `Extract a structured technical profile from the supplied resume. This stage adapts the section extraction approach from HackerRank Hiring Agent.

Rules:
- Copy only explicitly supported facts. Never infer links, technologies, employers, dates, or achievements.
- Exclude the candidate's name, email, phone, location, school names, and grades because they are not needed for technical scoring.
- Preserve work achievements and metrics exactly as stated.
- Extract only explicit profile URLs. Use "Not provided" for a missing scalar string and [] for a missing collection.
- Normalize dates when clear; otherwise preserve the source wording.

Return only JSON with exactly this structure:
{"summary":"...","profiles":[{"network":"...","url":"...","username":"..."}],"work":[{"company":"...","position":"...","startDate":"...","endDate":"...","summary":"...","highlights":["..."]}],"skills":[{"category":"...","keywords":["..."]}],"projects":[{"name":"...","description":"...","url":"...","technologies":["..."]}],"awards":[{"title":"...","date":"...","awarder":"..."}]}`;

const resume = `# Elias Renawi
**Phone:** 0528423617 | **Email:** eliasrenawi23@gmail.com
**Links:** [LinkedIn](https://linkedin.com) | [GitHub](https://github.com/eliasrenawi23) | [Portfolio](https://example.com)

## Professional Summary
Mid-level Full-Stack Software Engineer with C/C++ foundations, expert in React/Next.js and Python Flask, and a track record of delivering AI-powered document workflows and RAG pipelines (Azure OpenAI, Claude); now seeking new opportunities.

## Work Experience

### Full-Stack & AI Agent Engineer | Galil Software, Nazareth, IL
*April 2023 – Present*
- **Front-end:** Build and maintain high performance and responsive React/Next.js interfaces in TypeScript.
- **User Experience:** Partner with back-end engineers and UX/UI designers to ship pixel-perfect, accessible features.
- **Back-end:** Design REST APIs with Python Flask; containerized services with Docker and setup CI/CD via GitHub Actions.
- **LLM Chat-bots:** Deploy production assistants using LLMs (Claude, GPT, Azure OpenAI, etc.).
- **OCR RAG Pipeline:** Built a Python service that ingests invoices with Azure Document Intelligence and stores context.

### Tutor | ORT Braude College
*2021 – 2022*
- Tutored first-year students in advanced mathematics courses.

## Education

### B.Sc. in Software Engineering | ORT Braude College of Engineering
*2017 – 2022*
- **Graduate GPA:** 83
- **Selected Coursework Grades:** Computer Networks: 98, OOP (Java): 96, Architecture and Computer Structure: 88, Data Security and Cryptology: 85, Data Structures: 83

## Technical Projects

- **Similar Text Search Technology (Final Project):** Part of research on finding similarity between 2 large texts using the TextRank algorithm to extract significant sentences. Implemented using C# and .NET framework.
- **Braude Employee/Student System:** Client-Server application developed using JavaFX, JDBC, MySQL, and OCSF.
- **Chess Game:** Fully functional Chess Game implemented in C++ using SDL2.
- **Secure Email Exchange:** Custom secure email protocol using Serpent cipher (OFB mode) and El Gamal signature, implemented in Python.
- **Online Restaurant Menus:** Created multiple responsive online restaurant menus currently utilized by local businesses, built using Next.js.

## Professional Training

- **Full Stack Engineering Course (225 hours):** Comprehensive program covering HTML/CSS/JS, MongoDB, Express.js, React.js, and Node.js.
- **Kav Mashve Business Club:** Selected for a program exploring tech organizations and preparation for technical and soft-skill job interviews.

## Core Skills

- **Programming Languages:** Java, C, C++, Python (Flask), C#, .NET, TypeScript, Node.JS, Next.JS, MATLAB, DCMTK
- **Databases & IDEs:** PostgreSQL, MySQL, PyCharm
- **Soft Skills:** Teamwork, Team Building, Advanced Problem Solving, Project Organization
- **Languages:** Arabic (Mother Tongue), English (Fluent), Hebrew (Fluent)`;

async function run() {
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-3.5-flash", systemInstruction: EXTRACTION_PROMPT });
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `RESUME\n---\n${resume}\n---` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    console.log("Raw Gemini Response:");
    console.log(response.response.text());
    console.log("--- Candidate 0 Details ---");
    console.log("Finish Reason:", response.response.candidates[0].finishReason);
    console.log("Usage Metadata:", response.response.usageMetadata);
  } catch (err) {
    console.error("Error executing Gemini API:", err);
  }
}

run();
