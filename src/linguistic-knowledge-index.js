import catalog from "../data/linguistic-catalog.json" with { type: "json" };
import blueprints from "../data/linguistic-activity-blueprints.json" with { type: "json" };
const LEVEL_RANK={A1:1,A2:2,B1:3,B2:4,C1:5,C2:6};
const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9+#'-]+/g," ").replace(/\s+/g," ").trim();
const tokens=v=>normalize(v).split(" ").filter(x=>x.length>1);
const rank=v=>LEVEL_RANK[String(v||"A2").toUpperCase()]||2;
const stages=["recognition","guided","independent","nuance","transfer"];
const records=[
 ...(catalog.grammarRules||[]).map(x=>({...x,recordType:"grammar",searchText:[x.id,x.implementation,x.category,x.level,x.title,x.titleEs,x.explanation,x.explanationEs,...(x.searchTerms||[]),...(x.examples||[]),...(x.examplesBilingual||[]).flatMap(y=>[y.en,y.es]),...(x.exceptions||[]),...(x.activityLinks?.tags||[])].join(" ")})),
 ...(catalog.vocabularyEntries||[]).map(x=>({...x,recordType:"vocabulary",searchText:[x.id,x.lemma,x.meaningEs,x.partOfSpeech,x.domain,x.level,...(x.searchTerms||[]),...(x.forms||[]),...(x.collocations||[]),...(x.examples||[]),...(x.examplesBilingual||[]).flatMap(y=>[y.en,y.es])].join(" ")})),
 ...(catalog.communicativeFunctions||[]).map(x=>({...x,recordType:"function",searchText:[x.id,x.label,x.labelEs,x.level,...(x.searchTerms||[]),...(x.structures||[]),...(x.vocabularyDomains||[]),...(x.contexts||[])].join(" ")})),
 ...(blueprints.categories||[]).map(x=>({...x,recordType:"activity-category",level:"A1",searchText:[x.id,x.label,x.labelEs,...(x.primaryModes||[]),...(x.skills||[]),...(x.progression||[]).flatMap(y=>[y.level,y.focus])].join(" ")}))
];
const inverted=new Map(),byKey=new Map();
for(const record of records){const key=record.recordType+":"+record.id;byKey.set(key,record);for(const token of new Set(tokens(record.searchText))){if(!inverted.has(token))inverted.set(token,new Set());inverted.get(token).add(key);}}
function getLearningDepth(item,learnerLevel="A2",evidence={}){
 const distance=rank(learnerLevel)-rank(item.targetLevel||item.level||"A1"),mastery=Number(evidence.mastery??evidence.masteryScore??0);
 const i=distance<=-2?0:distance===-1?1:distance===0?2:distance===1?(mastery>=.65?3:2):(mastery>=.8?4:3);
 return {targetLevel:item.targetLevel||item.level||"A1",learnerLevel:String(learnerLevel).toUpperCase(),availableForCorrection:true,searchable:true,practiceEligible:true,maxDepth:stages[i],stageIndex:i,requiresEvidenceForNextStage:i<4,masteryRequiredForNextStage:i===2?.65:i===3?.8:null};
}
function searchLinguisticKnowledge(query="",options={}){
 const q=normalize(query),qt=tokens(q),allowed=new Set(options.types||["grammar","vocabulary","function","activity-category"]),keys=new Set();
 if(!qt.length){for(const r of records)if(allowed.has(r.recordType))keys.add(r.recordType+":"+r.id);}
 else for(const t of qt){if(inverted.has(t)){for(const k of inverted.get(t))keys.add(k);}else for(const [word,ids] of inverted)if(word.startsWith(t)||t.startsWith(word))for(const k of ids)keys.add(k);}
 const score=r=>{const title=normalize([r.title,r.titleEs,r.label,r.labelEs,r.lemma,r.id,r.category].filter(Boolean).join(" ")),text=normalize(r.searchText);let n=q&&title===q?100:0;if(q&&title.includes(q))n+=45;if(q&&text.includes(q))n+=25;for(const t of qt){if(title.split(" ").includes(t))n+=12;else if(title.includes(t))n+=7;else if(text.split(" ").includes(t))n+=4;else if(text.includes(t))n+=1;}if(r.recordType==="grammar"&&r.status==="tested")n+=3;return n;};
 return [...keys].map(k=>byKey.get(k)).filter(Boolean).filter(r=>allowed.has(r.recordType)).map(item=>({item,score:score(item)})).filter(x=>!q||x.score>0).filter(({item})=>!options.level||String(item.level||"").split("-").includes(options.level)||item.recordType==="activity-category").filter(({item})=>!options.domain||normalize(item.domain||"").includes(normalize(options.domain))||normalize(item.vocabularyDomains||"").includes(normalize(options.domain))).filter(({item})=>!options.skill||item.skills?.includes(options.skill)||item.activityLinks?.skills?.includes(options.skill)||["grammar","vocabulary"].includes(item.recordType)).filter(({item})=>options.includeDrafts!==false||item.recordType!=="grammar"||item.status==="tested").map(({item,score})=>({...item,score,depth:getLearningDepth(item,options.learnerLevel||"A2",options.evidence),availableForCorrection:item.recordType==="grammar"&&item.status==="tested",correctionMode:item.recordType!=="grammar"?"knowledge-only":item.status==="tested"?"automatic-tested":"feedback-only"})).sort((a,b)=>b.score-a.score||String(a.level).localeCompare(String(b.level))||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(1,Math.min(Number(options.limit)||20,100)));
}
function getCorrectionRuleSet(){return (catalog.grammarRules||[]).filter(x=>x.status==="tested"&&x.correctionPolicy!=="disabled").sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.priority]||0)-({critical:4,high:3,medium:2,low:1}[a.priority]||0));}
function getGlobalKnowledgeStats(){return {grammarRules:catalog.grammarRules.length,correctableRules:getCorrectionRuleSet().length,draftRules:catalog.grammarRules.filter(x=>x.status==="draft").length,vocabularyEntries:catalog.vocabularyEntries.length,communicativeFunctions:catalog.communicativeFunctions.length,activityCategories:(blueprints.categories||[]).length,indexedTokens:inverted.size,globalAvailability:true,activityIndependentCorrection:true};}
function getActivityBlueprint(category,learnerLevel="A2"){const item=(blueprints.categories||[]).find(x=>x.id===category);if(!item)return null;const p=(item.progression||[]).filter(x=>rank(x.level)<=rank(learnerLevel)).at(-1)||item.progression?.[0]||null;return {...item,currentProgression:p,learnerLevel,depth:getLearningDepth({level:p?.level||"A1"},learnerLevel)};}
export {searchLinguisticKnowledge,getCorrectionRuleSet,getGlobalKnowledgeStats,getLearningDepth,getActivityBlueprint,linguisticKnowledgeRecords:records};
