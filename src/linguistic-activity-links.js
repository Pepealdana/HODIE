import catalog from "../data/linguistic-catalog.json" with { type: "json" };
import contentLibrary from "../data/content-library.json" with { type: "json" };
import microLibrary from "../data/micro-practice-library.json" with { type: "json" };
const ALIASES={"question-forms":["question-forms","indirect-questions"],"modals":["modals"],"past-simple":["past-simple"],"present-perfect":["present-perfect"],"passive-voice":["passive-voice"],"there-is-are":["there-is-are"],"plurals":["plurals"],"present-continuous":["present-continuous"]};
const norm=v=>String(v??"").toLowerCase().replace(/[^a-z0-9 -]/g," ").replace(/\s+/g," ").trim();
const rank=l=>({A1:1,A2:2,B1:3,B2:4,C1:5,C2:6})[String(l||"").toUpperCase()]||2;
function getLinguisticResourcesForActivity(activity={}) {
 const all=catalog.communicativeFunctions||[];
 const text=norm([activity.id,activity.canDoId,activity.level,activity.skill,activity.type,activity.activityType,activity.title,activity.titleEs,activity.objective,activity.prompt,activity.promptEs,activity.task,activity.languageResource,...(activity.tags||[]),...(activity.reviewTargets||[]),...(activity.resources||[])].filter(Boolean).join(" "));
 let functions=all.filter(fn=>(fn.canDoIds||[]).includes(activity.canDoId));
 let matchQuality=functions.length?"can-do":"unmatched";
 if(!functions.length){functions=all.filter(fn=>[...(fn.structures||[]),...(fn.vocabularyDomains||[]),...(fn.contexts||[])].some(v=>{const n=norm(v);return n.length>3&&text.includes(n)}));if(functions.length)matchQuality="content-tags";}
 if(!functions.length){functions=all.filter(fn=>rank(fn.level.split("-")[0])===rank(activity.level)).slice(0,3);if(functions.length)matchQuality="level-fallback";}
 const structures=new Set(functions.flatMap(fn=>fn.structures||[]));
 const tags=new Set([...(activity.tags||[]),...(activity.reviewTargets||[]),...(activity.resources||[]),activity.languageResource,activity.errorTarget].filter(Boolean).map(norm));
 const rules=(catalog.grammarRules||[]).filter(rule=>rule.status!=="deprecated"&&(
  structures.has(rule.implementation)||structures.has(rule.category)||
  [...structures].some(s=>(ALIASES[s]||[]).includes(rule.category)||(ALIASES[s]||[]).includes(rule.implementation))||
  [rule.id,rule.implementation,rule.category].map(norm).some(n=>n&&(text.includes(n)||tags.has(n)))||
  (rule.activityLinks?.tags||[]).map(norm).some(tag=>tags.has(tag)||(tag.length>4&&text.includes(tag)))
 ));
 const domains=new Set(functions.flatMap(fn=>fn.vocabularyDomains||[]).map(norm));
 const vocabulary=(catalog.vocabularyEntries||[]).filter(v=>{const near=Math.abs(rank(v.level)-rank(activity.level))<=1;const lemma=norm(v.lemma);return (domains.has(norm(v.domain))&&near)||(lemma&&(text.includes(lemma)||(v.forms||[]).some(f=>text.includes(norm(f)))));});
 return {activityId:activity.id||null,canDoId:activity.canDoId||null,matchQuality,functionIds:functions.map(f=>f.id),ruleIds:rules.map(r=>r.id),vocabularyIds:vocabulary.map(v=>v.id),skills:[...new Set(functions.flatMap(f=>f.skills||[]))],hasLinguisticLink:Boolean(functions.length||rules.length||vocabulary.length)};
}
function auditActivityCoverage(){
 const activities=[...(contentLibrary.activities||[]).map(a=>({...a,sourceLibrary:"content"})),...(microLibrary.activities||[]).map(a=>({...a,sourceLibrary:"micro"})),{id:"HODIE-CONVERSATION-SURFACE",canDoId:"SP-A2-01",level:"A2",skill:"speaking",type:"conversation",sourceLibrary:"surface"},{id:"HODIE-WRITING-SURFACE",canDoId:"SP-A2-01",level:"A2",skill:"writing",type:"mini-production",sourceLibrary:"surface"},{id:"HODIE-LISTENING-SURFACE",canDoId:"LI-A2-03",level:"A2",skill:"listening",type:"listening",sourceLibrary:"surface"},{id:"HODIE-READING-SURFACE",canDoId:"LI-A2-05",level:"A2",skill:"reading",type:"reading",sourceLibrary:"surface"}];
 const rows=activities.map(a=>({...getLinguisticResourcesForActivity(a),sourceLibrary:a.sourceLibrary}));
 return {total:rows.length,linked:rows.filter(r=>r.hasLinguisticLink).length,directCanDo:rows.filter(r=>r.matchQuality==="can-do").length,tagLinked:rows.filter(r=>r.matchQuality==="content-tags").length,levelFallback:rows.filter(r=>r.matchQuality==="level-fallback").length,unlinked:rows.filter(r=>!r.hasLinguisticLink).map(r=>r.activityId),rows};
}
export {getLinguisticResourcesForActivity,auditActivityCoverage};
