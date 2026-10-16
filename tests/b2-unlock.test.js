import assert from "node:assert/strict";
import { evaluateB2Unlock } from "../src/b2-unlock.js";

const matrix = {
  canDos: [
    ...["speaking","listening","reading","writing","communication","grammar","vocabulary","pronunciation"].map((skill,i)=>({id:"A1-"+i,level:"A1",skill,canDoType:"communicative"})),
    ...["A2","A2+","B1"].flatMap((level)=>["speaking","listening","reading","writing","communication"].map((skill,i)=>({id:level+"-"+i,level,skill,canDoType:skill==="speaking"&&i===0?"meta":"communicative"}))),
    {id:"B1-transfer-2",level:"B1",skill:"speaking",canDoType:"communicative"},
    {id:"B1-transfer-3",level:"B1",skill:"writing",canDoType:"communicative"}
  ],
  metaCanDos:[]
};
const statusEvidence = (canDoId, contextId, level="consistent", confidence=4) => ({
  canDoId,contextId,level,independent:true,confidence,transfer:level==="transfer",
  dimensions:{taskCompletion:.9,clarity:.9,accuracy:.85}
});
const allEvidence = [];
for (const canDo of matrix.canDos) {
  allEvidence.push(statusEvidence(canDo.id,"context-one",canDo.level==="B1"&&canDo.id==="B1-0"?"transfer":"consistent"));
  allEvidence.push(statusEvidence(canDo.id,"context-two",canDo.level==="B1"&&canDo.id==="B1-transfer-2"?"transfer":"consistent"));
}
const ready = evaluateB2Unlock(matrix,{evidence:allEvidence,reviews:[]});
assert.equal(ready.unlocked,true,JSON.stringify(ready.reasons));
assert.equal(ready.gateId,"B2-READINESS-V1");

const noEvidence = evaluateB2Unlock(matrix,{evidence:[],reviews:[]});
assert.equal(noEvidence.unlocked,false);
assert.ok(noEvidence.reasons.length>=3);

const activityCountOnly = evaluateB2Unlock(matrix,{evidence:matrix.canDos.map((canDo)=>({canDoId:canDo.id,independent:false,confidence:5,dimensions:{taskCompletion:1},level:"attempt"}))});
assert.equal(activityCountOnly.unlocked,false,"Completing many attempts must not unlock B2");

const noTransfer = evaluateB2Unlock(matrix,{evidence:allEvidence.filter((item)=>item.level!=="transfer")});
assert.equal(noTransfer.unlocked,false,"B1 mastery without transfer evidence must not unlock B2");

console.log("HODIE B2 readiness gate: PASS");
