import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { BigQuery } from "@google-cloud/bigquery";
import { GoogleGenAI } from "@google/genai";
import * as logger from "firebase-functions/logger";

const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

// Set global options to Gen 2 and Europe
setGlobalOptions({ 
  region: "europe-west1",
  memory: "256MiB"
});

admin.initializeApp();

const bq = new BigQuery({
  projectId: "lunatics-d8b5a",
  location: "EU"
});
const db = admin.firestore();

/**
 * Scheduled: Hourly
 * Logic: Fetch from Polisen API, filter processed links, analyze via Gemini, stream to BigQuery.
 */
export const fetchAndAnalyze = onSchedule({
  schedule: "0 */3 * * *", // Standard cron är ofta stabilare i v2
  timeZone: "Europe/Stockholm",
  secrets: [geminiApiKeySecret],
  memory: "512MiB",       // 🛡️ FIX 3: Ge maskinen lite mer andrum
  timeoutSeconds: 300,    // 🛡️ FIX 3: Låt Gemini ta sin tid (upp till 5 min)
  retryCount: 3
}, async (event) => {
  logger.info("Starting fetchAndAnalyze", { structuredData: true });

  try {
    // 🛡️ FIX 2: Hämta alltid dagens datum i SVENSK tid, oavsett UTC
    const today = new Intl.DateTimeFormat('sv-SE', { 
      timeZone: 'Europe/Stockholm' 
    }).format(new Date()); // Ger formatet "YYYY-MM-DD"

    // 1. Fetch JSON from polisen.se
    const response = await fetch(`[https://polisen.se/api/events?DateTime=$](https://polisen.se/api/events?DateTime=$){today}`);
    const events = await response.json() as any[];

    // 2. Read today's cache from Firestore
    const cacheRef = db.collection("processed_events").doc(today);
    const cacheDoc = await cacheRef.get();
    const processedEvents = new Set<number>(cacheDoc.exists ? cacheDoc.data()?.events || [] : []);

    // 3. Filter out already processed links
    const newEvents = events.filter(event => !processedEvents.has(event.id));

    if (newEvents.length === 0) {
      logger.info("No new events to process.");
      return;
    }

    // 4. Batch-send new events to Gemini
    const geminiApiKey = geminiApiKeySecret.value();
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY not set");

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    
    const prompt = `Extract only violent crimes (assault, robbery, murder, threats, sexual offenses, etc.) from the following JSON list. Respond with a Structured Output ARRAY.
    Each object must follow the schema: { id: number, type: string, severity: number, description: string }.
    Do not include any other crime types.
    
    DATA:
    ${JSON.stringify(newEvents.map(e => ({ id: e.id, name: e.name, summary: e.summary })))}`;

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Stabilare modellnamn
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    // 🛡️ FIX 1: Tvätta strängen från eventuell Markdown innan parse
    let rawJsonText = result.text || "[]";
    rawJsonText = rawJsonText.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    const analyzedData = JSON.parse(rawJsonText) as any[];
    const analysisMap = new Map(analyzedData.map(item => [item.id, item]));

    // 5. Filter and Map only violent crimes for BigQuery
    const bqDataset = "lunatics_raw";
    const bqTable = "raw_crimes";
    
    const rowsToInsert = newEvents
      .map(event => {
        const analysis = analysisMap.get(event.id);
        if (!analysis) return null; // Ignorera icke-våldsamma brott

        // Defensive mapping för Polisen-datumet
        let timestamp: string;
        try {
          const dateParts = event.datetime.split(" ");
          const isoStr = `${dateParts[0]}T${dateParts[1]}${dateParts[2] || "Z"}`;
          timestamp = new Date(isoStr).toISOString();
        } catch (e) {
          timestamp = new Date().toISOString(); 
        }

        return {
          id: String(event.id),
          type: String(analysis.type || event.name),
          city: String(event.location?.name || "Okänd"),
          area: String(event.location?.gps || ""),
          timestamp: timestamp,
          severity: Number(analysis.severity) || 0,
          link: "[https://polisen.se](https://polisen.se)" + event.url,
          fetch_time: new Date().toISOString()
        };
      })
      .filter((row): row is Exclude<typeof row, null> => row !== null);

    // Insert till BigQuery
    if (rowsToInsert.length > 0) {
      logger.info(`Attempting to insert ${rowsToInsert.length} violent crimes into BigQuery.`);
      try {
        await bq.dataset(bqDataset).table(bqTable).insert(rowsToInsert);
      } catch (err: any) {
        logger.error("!!! BIGQUERY FATAL ERROR !!!", err.errors ? err.errors : err.message);
        throw err;
      }
    }

    // 6. Update Firestore cache with ALL new IDs
    await cacheRef.set({
      events: admin.firestore.FieldValue.arrayUnion(...newEvents.map(e => e.id)),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))
    }, { merge: true });

    logger.info(`Marked ${newEvents.length} events as processed in cache.`);
    
  } catch (error) {
    logger.error("Error in fetchAndAnalyze", error);
    throw error; // Kasta felet vidare så att 'retryCount' triggas av GCP!
  }
});

/**
 * Scheduled: Daily 01:00
 * Logic: Fetch daily stats from BQ, generate article via Gemini, save to Firestore.
 */
export const articlePublisher = onSchedule({
  schedule: "0 1 * * *",
  timeZone: "Europe/Stockholm",
  secrets: [geminiApiKeySecret],
  timeoutSeconds: 300, // Låt Gemini tänka ostört
  retryCount: 3        // Om API:et hickar, försök igen
}, async (event) => {
  logger.info("Starting articlePublisher", { structuredData: true });
    
  try {
    const bqDataset = "lunatics";
    const bqTable = "fct_daily_stats";
    
    // 🛡️ FIX 1: Tidszons-säker datumhantering!
    // Vi skapar en funktion som formaterar svensk tid "YYYY-MM-DD"
    const getSwedishDateString = (dateObj: Date) => {
      return new Intl.DateTimeFormat('sv-SE', { 
        timeZone: 'Europe/Stockholm',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(dateObj); // Ger alltid "YYYY-MM-DD" i svensk tid
    };

    // "Idag"
    const now = new Date();
    const todayStr = getSwedishDateString(now);

    // "Igår" (Dra av 24 timmar från NU)
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getSwedishDateString(yesterdayDate);

    // Fortsätt som vanligt med dina säkra datum!
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
      logger.info("No stats found.");
      return;
    }

    const yesterdayStatsRaw = rows.find(r => (r.date?.value || r.date) === yesterdayStr);
    const todayStatsRaw = rows.find(r => (r.date?.value || r.date) === todayStr);

    if (!yesterdayStatsRaw) {
      logger.info(`No stats found for yesterday (${yesterdayStr}).`);
      return;
    }

    // Clean data for Firestore
    const yesterdayStats = { 
      ...yesterdayStatsRaw, 
      date: yesterdayStatsRaw.date?.value || yesterdayStatsRaw.date 
    };
    const todayStats = todayStatsRaw ? { 
      ...todayStatsRaw, 
      date: todayStatsRaw.date?.value || todayStatsRaw.date 
    } : null;

    // 1.1 Fetch specific events from yesterday for detail
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

    const eventSummary = events.map(e => {
      // Formatera tidsstämpeln snyggt för prompten
      const timeStr = new Date(e.timestamp.value || e.timestamp).toLocaleTimeString('sv-SE', {
        timeZone: 'Europe/Stockholm', // Viktigt även här!
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      return `- ${e.type} in ${e.city}${e.area ? ' ('+e.area+')' : ''} at ${timeStr} (Source: ${e.link})`;
    }).join('\n');

    // 2. Determine Context
    // Vi måste använda den svenska dagen/månaden, annars kan kl 01:00 strula till det
    const parts = todayStr.split('-'); // ["2026", "05", "06"]
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    // För att få veckodagen lokalt i Sverige kan vi fuska fram det via Intl
    const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(now);
    const isWeekend = ['Fri', 'Sat', 'Sun'].includes(weekdayStr);
    const isPaydayWeekend = (day >= 24 && day <= 28 && isWeekend);
    
    let specialContext = "";
    if (isPaydayWeekend) specialContext += "It is payday weekend in Sweden. ";
    if (month === 4 && day === 30) specialContext += "It is Walpurgis Night (Valborgsmässoafton). ";
    if (month === 6 && day >= 19 && day <= 25 && weekdayStr === 'Fri') specialContext += "It is Midsummer Eve. ";
    if (month === 12 && day === 31) specialContext += "It is New Year's Eve. ";

    // 3. Generate enriched article via Gemini
    const geminiApiKey = geminiApiKeySecret.value();
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

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
       
    4. The Vibe (Tonight): A prediction/forecast for tonight based on today's moon phase (${todayStats?.moon_phase || "unknown"}) and context: ${specialContext || "Regular night"}.
    
    STATISTICS FOR YESTERDAY (${yesterdayStr}):
    - Total violent crimes: ${yesterdayStats.total_crimes}
    - Moon phase: ${yesterdayStats.moon_phase}
    - Deviation score: ${yesterdayStats.deviation_score}
    
    Respond with JSON: { "title": "string", "lede": "string", "body": "string", "vibe_tonight": "string", "risk_level": "number" }
    `;

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Uppdaterat modellnamn
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    // 🛡️ FIX 2: Tvätta Markdown från LLM-svaret!
    let rawText = result.text || "{}";
    rawText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const articleData = JSON.parse(rawText);

    // 4. Save to Firestore
    const article = {
      ...articleData,
      stats_snapshot: yesterdayStats,
      today_moon: todayStats?.moon_phase,
      context: specialContext,
      published_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("daily_articles").doc(todayStr).set(article);
    logger.info(`Published enriched article for ${todayStr}.`);

  } catch (error) {
    logger.error("Error in articlePublisher", error);
    throw error; // 🛡️ FIX 3: Tvinga Cloud Scheduler att starta 'retryCount'
  }
});
