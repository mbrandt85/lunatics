import admin from "firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";
import { GoogleGenAI } from "@google/genai";

/**
 * TRIGGER ARTICLE GENERATION LOCALLY AGAINST PROD
 * 
 * Usage: 
 * GEMINI_API_KEY=your_key npx tsx scratch/generate_article.ts
 */

const PROJECT_ID = "lunatics-d8b5a";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: GEMINI_API_KEY environment variable is not set.");
  process.exit(1);
}

// Initialize Admin SDK (uses local credentials)
admin.initializeApp({
  projectId: PROJECT_ID
});

const bq = new BigQuery({
  projectId: PROJECT_ID,
  location: "EU"
});
const db = admin.firestore();

async function run() {
  const argDate = process.argv[2]; // Target publish date, e.g., "2024-04-20"
  
  let targetDate: Date;
  if (argDate) {
    targetDate = new Date(argDate);
    if (isNaN(targetDate.getTime())) {
      console.error(`❌ Error: Invalid date format "${argDate}". Use YYYY-MM-DD.`);
      process.exit(1);
    }
  } else {
    targetDate = new Date();
  }

  const todayStr = targetDate.toISOString().split("T")[0];
  
  // Stats are always from the day before the target publish date
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  console.log(`🚀 Starting local article generation...`);
  console.log(`📅 Publishing for Date: ${todayStr}`);
  console.log(`📊 Reporting on Stats from: ${yesterdayStr}`);
  console.log(`🔍 Syncing BigQuery data for ${yesterdayStr} and ${todayStr}...`);

  try {
    const bqDataset = "lunatics";
    const bqTable = "fct_daily_stats";

    const query = `
      SELECT * FROM \`${bqDataset}.${bqTable}\`
      WHERE date IN (@yesterday, @today)
      ORDER BY date ASC
    `;
    
    const [rows] = await bq.query({
      query,
      params: { yesterday: yesterdayStr, today: todayStr }
    });

    if (rows.length === 0) {
      console.log("⚠️ No stats found in BigQuery.");
      return;
    }

    const yesterdayStatsRaw = rows.find(r => (r.date?.value || r.date) === yesterdayStr);
    const todayStatsRaw = rows.find(r => (r.date?.value || r.date) === todayStr);

    if (!yesterdayStatsRaw) {
      console.log(`⚠️ No stats found for yesterday (${yesterdayStr}).`);
      return;
    }

    const yesterdayStats = { 
      ...yesterdayStatsRaw, 
      date: yesterdayStatsRaw.date?.value || yesterdayStatsRaw.date 
    };
    const todayStats = todayStatsRaw ? { 
      ...todayStatsRaw, 
      date: todayStatsRaw.date?.value || todayStatsRaw.date 
    } : null;

    console.log(`🔍 Fetching specific events for ${yesterdayStr}...`);
    const eventsQuery = `
      SELECT type, city, area, timestamp, link
      FROM \`lunatics-d8b5a.lunatics.stg_crimes\`
      WHERE CAST(timestamp AS DATE) = @yesterday
      LIMIT 15
    `;
    const [events] = await bq.query({
      query: eventsQuery,
      params: { yesterday: yesterdayStr }
    });

    const eventSummary = events.map(e => 
      `- ${e.type} in ${e.city}${e.area ? ' ('+e.area+')' : ''} at ${new Date(e.timestamp.value || e.timestamp).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit', hour12: false})} (Source: ${e.link})`
    ).join('\n');

    console.log(`🤖 Generating article via Gemini...`);
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `You are a data journalist specialized in the correlation between moon phases and crime.
    Write a compelling news article in English.
    
    STRUCTURE:
    1. Title: Catchy and related to the moon.
    2. Lede: Summary of yesterday's findings.
    3. Body: Detailed report on yesterday's crimes and how they correlate with the ${yesterdayStats.moon_phase}.
       Use these SPECIFIC EVENTS to make the article more descriptive. 
       IMPORTANT: Use HTML links (<a href="URL">...</a>) when mentioning these events so readers can click through to the police report.
       
       EVENTS:
       ${eventSummary || "No specific major events recorded."}
       
    4. The Vibe (Tonight): A prediction/forecast for tonight based on today's moon phase (${todayStats?.moon_phase || "unknown"}) and context.
    
    STATISTICS FOR YESTERDAY (${yesterdayStr}):
    - Total violent crimes: ${yesterdayStats.total_crimes}
    - Moon phase: ${yesterdayStats.moon_phase}
    - Deviation score: ${yesterdayStats.deviation_score}
    
    Respond with JSON: { title: string, lede: string, body: string, vibe_tonight: string, risk_level: number }
    `;

    const result = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    const articleData = JSON.parse(result.text || "{}");

    console.log(`💾 Saving article to Firestore for ${todayStr}...`);
    const article = {
      ...articleData,
      stats_snapshot: yesterdayStats,
      today_moon: todayStats?.moon_phase,
      published_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("daily_articles").doc(todayStr).set(article);
    console.log(`✅ Success! Article published to production.`);

  } catch (error) {
    console.error("❌ Error during execution:", error);
  }
}

run();
