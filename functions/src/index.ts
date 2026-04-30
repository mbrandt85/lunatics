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
  schedule: "every 3 hours",
  secrets: [geminiApiKeySecret],
  retryCount: 3
}, async (event) => {
  logger.info("Starting fetchAndAnalyze", { structuredData: true });

    try {
      // 1. Fetch JSON from polisen.se/api/events for TODAY only
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`https://polisen.se/api/events?DateTime=${today}`);
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

      // 4. Batch-send new events to Gemini for analysis
      const geminiApiKey = geminiApiKeySecret.value();
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY not set");
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      
      const prompt = `Extract only violent crimes (assault, robbery, murder, threats, sexual offenses, etc.) from the following JSON list. Respond with a Structured Output ARRAY.
      Each object must follow the schema: { id: number, type: string, severity: number, description: string }.
      Do not include any other crime types.
      
      DATA:
      ${JSON.stringify(newEvents.map(e => ({ id: e.id, name: e.name, summary: e.summary })))}
      `;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const analyzedData = JSON.parse(result.text || "[]") as any[];
      const analysisMap = new Map(analyzedData.map(item => [item.id, item]));

      // 5. Filter and Map only violent crimes for BigQuery
      const bqDataset = "lunatics_raw";
      const bqTable = "raw_crimes";
      
      const rowsToInsert = newEvents
        .map(event => {
          const analysis = analysisMap.get(event.id);
          if (!analysis) return null;

          // Defensive mapping
          let timestamp: string;
          try {
            // Polisen format: "2026-04-30 05:33:07 +02:00"
            // We want to ensure it's a valid ISO string
            const dateParts = event.datetime.split(" ");
            const isoStr = `${dateParts[0]}T${dateParts[1]}${dateParts[2] || "Z"}`;
            timestamp = new Date(isoStr).toISOString();
          } catch (e) {
            timestamp = new Date().toISOString(); // Fallback
          }

          return {
            id: String(event.id),
            type: String(analysis.type || event.name),
            city: String(event.location?.name || "Okänd"),
            area: String(event.location?.gps || ""),
            timestamp: timestamp,
            severity: Number(analysis.severity) || 0,
            link: "https://polisen.se" + event.url,
            fetch_time: new Date().toISOString()
          };
        })
        .filter((row): row is Exclude<typeof row, null> => row !== null);

      if (rowsToInsert.length > 0) {
        logger.info("Attempting to insert rows:", { count: rowsToInsert.length, sample: rowsToInsert[0] });
        try {
          await bq.dataset(bqDataset).table(bqTable).insert(rowsToInsert);
          logger.info(`Inserted ${rowsToInsert.length} violent crimes into BigQuery.`);
        } catch (err: any) {
          console.error("!!! BIGQUERY FATAL ERROR !!!");
          if (err.errors) {
            console.error("Detailed Errors:", JSON.stringify(err.errors, null, 2));
          } else {
            console.error("Error Message:", err.message);
          }
          throw err;
        }
      } else {
        functions.logger.info("No violent crimes detected in this batch.");
      }

      // 6. Update Firestore cache with ALL new IDs (so we don't re-analyze them)
      await cacheRef.set({
        events: admin.firestore.FieldValue.arrayUnion(...newEvents.map(e => e.id)),
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)) // Auto-delete after 7 days
      }, { merge: true });

      logger.info(`Marked ${newEvents.length} events as processed in cache.`);
    } catch (error) {
      logger.error("Error in fetchAndAnalyze", error);
    }

    return null;
  });

/**
 * Scheduled: Daily 01:00
 * Logic: Fetch daily stats from BQ, generate article via Gemini, save to Firestore.
 */
export const articlePublisher = onSchedule({
  schedule: "0 1 * * *",
  secrets: [geminiApiKeySecret]
}, async (event) => {
  logger.info("Starting articlePublisher", { structuredData: true });
    
    try {
      const bqDataset = "lunatics";
      const bqTable = "fct_daily_stats";
      
      // 1. Fetch yesterday's stats and today's moon phase
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      // Query both yesterday (for stats) and today (for moon phase/vibe)
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
        functions.logger.info(`No stats found for yesterday (${yesterdayStr}).`);
        return null;
      }

      // Clean data for Firestore (BigQueryDate -> string)
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

      const eventSummary = events.map(e => 
        `- ${e.type} in ${e.city}${e.area ? ' ('+e.area+')' : ''} at ${new Date(e.timestamp.value || e.timestamp).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit', hour12: false})} (Source: ${e.link})`
      ).join('\n');

      // 2. Determine Context (Payday, Holidays)
      const day = today.getDate();
      const month = today.getMonth() + 1;
      const isPaydayWeekend = (day >= 24 && day <= 28 && [5, 6, 0].includes(today.getDay()));
      
      let specialContext = "";
      if (isPaydayWeekend) specialContext += "It is payday weekend in Sweden. ";
      if (month === 4 && day === 30) specialContext += "It is Walpurgis Night (Valborgsmässoafton). ";
      if (month === 6 && day >= 19 && day <= 25 && today.getDay() === 5) specialContext += "It is Midsummer Eve. ";
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
      
      Respond with JSON: { title: string, lede: string, body: string, vibe_tonight: string, risk_level: number }
      `;

      const result = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const articleData = JSON.parse(result.text || "{}");

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
  }
    
    return null;
  });
