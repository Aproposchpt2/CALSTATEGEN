const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const moduleUrl=pathToFileURL(path.resolve(__dirname,'../netlify/functions/_shared/apropos-procurement-intelligence-v1.mjs')).href;

test('authoritative procurement intelligence register is complete and internally consistent',async()=>{
  const source=await import(moduleUrl);
  assert.equal(source.SOURCE_OF_TRUTH.version,'1.0');
  assert.equal(source.REQUIREMENT_CATALOG.length,54);
  assert.equal(new Set(source.REQUIREMENT_CATALOG.map(item=>item.id)).size,54);
  assert.equal(source.HARD_GATES.length,9);
  assert.equal(source.FIT_FACTORS.reduce((sum,item)=>sum+item.weight,0),100);
  assert.equal(source.CONFIDENCE_FACTORS.reduce((sum,item)=>sum+item.weight,0),100);
  assert.equal(source.BUYER_INTENTS.length,15);
  assert.match(source.sourceOfTruthPrompt(),/Missing text is UNKNOWN, never false/);
  assert.match(source.sourceOfTruthPrompt(),/REQ-SUB-003 \| Submission \| Response deadline compliance/);
});
