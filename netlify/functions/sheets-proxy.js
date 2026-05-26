// ════════════════════════════════════════════════════════
//  Netlify Serverless Function: Google Sheets Proxy
//  Saves & loads all grocery data to YOUR Google Sheet
//  so data works on any device / browser / phone
// ════════════════════════════════════════════════════════

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const API_KEY   = process.env.GOOGLE_API_KEY;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { action, token, data, monthKey } = JSON.parse(event.body || "{}");

    // ── READ: load all data from sheet ──
    if (action === "load") {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/AppData!A1:B1000?key=${API_KEY}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return { statusCode: res.status, headers, body: await res.text() };
      const json = await res.json();
      const rows = json.values || [];
      const result = {};
      rows.forEach(([key, val]) => { try { result[key] = JSON.parse(val); } catch (e) {} });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: result }) };
    }

    // ── WRITE: save one month's data ──
    if (action === "save") {
      // First read existing to find row number
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/AppData!A:A?key=${API_KEY}`;
      const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } });
      const readJson = await readRes.json();
      const rows = readJson.values || [];
      let rowIndex = rows.findIndex(r => r[0] === monthKey);
      
      let range, values;
      if (rowIndex === -1) {
        // Append new row
        range = "AppData!A:B";
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=RAW&key=${API_KEY}`;
        const appendRes = await fetch(appendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ values: [[monthKey, JSON.stringify(data)]] }),
        });
        if (!appendRes.ok) return { statusCode: appendRes.status, headers, body: await appendRes.text() };
      } else {
        // Update existing row
        range = `AppData!A${rowIndex + 1}:B${rowIndex + 1}`;
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;
        const updateRes = await fetch(updateUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ values: [[monthKey, JSON.stringify(data)]] }),
        });
        if (!updateRes.ok) return { statusCode: updateRes.status, headers, body: await updateRes.text() };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
