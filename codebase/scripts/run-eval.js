import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const endpoint = process.env.VSHARE_URL || "http://localhost:3000";
const health = await fetch(`${endpoint}/api/health`).then((response) => response.json());
const runMode = health.mockMode ? "mock" : "gemini";

function parseCsv(text) {
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c==='"'&&quoted&&n==='"'){cell+='"';i++}
    else if(c==='"')quoted=!quoted;
    else if(c===","&&!quoted){row.push(cell);cell=""}
    else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=""}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  const [headers,...data]=rows;
  return data.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||""])));
}
const csvCell=value=>`"${String(value??"").replaceAll('"','""')}"`;
const source=await fs.readFile(path.join(root,"eval/golden-set.csv"),"utf8");
const cases=parseCsv(source);
const results=[];
for(const testCase of cases){
  let output,error="";
  try{
    const response=await fetch(`${endpoint}/api/search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:testCase.input})});
    output=await response.json();if(!response.ok)error=output.error||`HTTP ${response.status}`;
  }catch(err){error=err.message}
  const returnedIds=(output?.results||[]).map(item=>item.document?.id);
  const expected=testCase.expected_doc;
  const behaviorPass =
    expected==="clarify" ? output?.status==="clarify" :
    expected==="refuse" ? output?.status==="refuse" :
    expected==="none" ? ["none","refuse"].includes(output?.status) :
    expected==="insufficient" ? output?.status!=="results" :
    returnedIds.includes(expected);
  results.push({...testCase,status:output?.status||"error",returned_ids:returnedIds.join("|"),behavior_pass:behaviorPass,error,raw_output:JSON.stringify(output||{})});
  console.log(`${testCase.case_id}: ${behaviorPass?"PASS":"FAIL"} (${output?.status||error})`);
}
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const out=path.join(root,`eval/run-${runMode}-${stamp}.csv`);
const headers=["case_id","type","source_ref","input","expected_doc","status","returned_ids","behavior_pass","error","raw_output"];
await fs.writeFile(out,[headers.join(","),...results.map(r=>headers.map(h=>csvCell(r[h])).join(","))].join("\n"),"utf8");
const passed=results.filter(r=>r.behavior_pass).length;
console.log(`Result: ${passed}/${results.length} = ${Math.round(passed/results.length*100)}%`);
console.log(`Mode: ${runMode}${runMode==="mock"?" (không dùng làm kết quả CP3)":""}`);
console.log(`Saved: ${out}`);
