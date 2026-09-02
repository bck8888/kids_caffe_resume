import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const checks=[];
const add=(name,ok,detail)=>checks.push({name,ok,detail});
const present=name=>Boolean(process.env[name]?.trim());

add("Seoul Open API key",present("SEOUL_OPEN_API_KEY"),present("SEOUL_OPEN_API_KEY")?"configured":"missing SEOUL_OPEN_API_KEY");
add("Kakao JavaScript key",present("NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY"),present("NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY")?"configured":"missing NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY");
add("Kakao REST API key",present("KAKAO_REST_API_KEY"),present("KAKAO_REST_API_KEY")?"configured":"missing KAKAO_REST_API_KEY");
add("Session secret",(process.env.APP_SESSION_SECRET?.length??0)>=32,(process.env.APP_SESSION_SECRET?.length??0)>=32?"configured":"APP_SESSION_SECRET must be at least 32 characters");
let appUrl=null;
try { appUrl=new URL(process.env.NEXT_PUBLIC_APP_URL??""); add("Alpha app URL",["http:","https:"].includes(appUrl.protocol),appUrl.origin); } catch { add("Alpha app URL",false,"missing or invalid NEXT_PUBLIC_APP_URL"); }
add("Fixture isolation",process.env.ALPHA_USE_FIXTURES!=="true",process.env.ALPHA_USE_FIXTURES==="true"?"fixtures enabled; do not use for connected alpha":"fixtures disabled");

console.log("Seoul Kids Cafe connected-alpha preflight\n");
for(const check of checks) console.log(`${check.ok?"PASS":"FAIL"}  ${check.name} — ${check.detail}`);
if(appUrl) console.log(`INFO  Kakao redirect URI — ${new URL("/api/auth/kakao/callback",appUrl).toString()}`);
console.log("INFO  Seoul credentials are intentionally unsupported and were not checked.");

const failed=checks.filter(check=>!check.ok);
if(failed.length){console.error(`\nBLOCKED: ${failed.length} connected-alpha prerequisite(s) missing.`);process.exitCode=1;}else console.log("\nREADY: configuration prerequisites are present. Run device scenarios before declaring alpha complete.");
