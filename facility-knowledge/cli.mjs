#!/usr/bin/env node
import nextEnv from "@next/env";
import { resolve } from "node:path";
import { collect } from "./src/collector.mjs";
import { migrate, openDatabase } from "./src/db.mjs";
import { coverageReport } from "./src/report.mjs";

nextEnv.loadEnvConfig(process.cwd());
const args=process.argv.slice(2); const command=args.shift();
const option=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};
const dbPath=resolve(option("--db",process.env.FACILITY_KNOWLEDGE_DB_PATH||".local/facility-knowledge.sqlite"));
const db=openDatabase(dbPath);

try {
  if(command==="migrate") { const files=migrate(db); console.log(JSON.stringify({ok:true,database:dbPath,migrations:files},null,2)); }
  else if(command==="collect") {
    migrate(db); const now=new Date(); const month=option("--month",`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`); const rate=Number(option("--rate-ms","350"));
    const result=await collect(db,{apiKey:process.env.SEOUL_OPEN_API_KEY,month,rateLimitMs:Math.max(250,rate),refresh:args.includes("--refresh"),onProgress:(value)=>{if(value.phase==='facility-feed'||value.completed%10===0||value.completed===value.total) console.error(`[facility-knowledge] ${value.phase} ${value.completed}/${value.total}${value.failures?` failures=${value.failures}`:''}`);}});
    console.log(JSON.stringify({...result,database:dbPath,coverage:coverageReport(db)},null,2));
  } else if(command==="coverage") { migrate(db); console.log(JSON.stringify(coverageReport(db),null,2)); }
  else { console.error("Usage: node facility-knowledge/cli.mjs <migrate|collect|coverage> [--db PATH] [--month YYYY-MM] [--rate-ms N] [--refresh]"); process.exitCode=2; }
} finally { db.close(); }
