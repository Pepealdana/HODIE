import assert from "node:assert/strict";
import { auditActivityCoverage } from "../src/linguistic-activity-links.js";
const audit=auditActivityCoverage();
assert.equal(audit.unlinked.length,0,"Unlinked activities: "+audit.unlinked.join(", "));
assert.equal(audit.linked,audit.total);
assert.ok(audit.directCanDo>0);
console.log("HODIE activity linkage audit: PASS",JSON.stringify({total:audit.total,linked:audit.linked,directCanDo:audit.directCanDo,tagLinked:audit.tagLinked,levelFallback:audit.levelFallback}));
