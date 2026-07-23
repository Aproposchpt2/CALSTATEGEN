'use strict';
const $=(id)=>document.getElementById(id);
const esc=(value)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const unique=(items)=>[...new Set(items.filter(Boolean).map((item)=>String(item).trim()).filter(Boolean))];
const splitLines=(value)=>unique(String(value||'').split(/[\n;,]+/));
function decode(value){try{let source=value.replace(/-/g,'+').replace(/_/g,'/');while(source.length%4)source+='=';const binary=atob(source);const bytes=Uint8Array.from(binary,(char)=>char.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}}
function encode(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';bytes.forEach((byte)=>{binary+=String.fromCharCode(byte)});return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
const intake=decode(new URLSearchParams(location.hash.slice(1)).get('profile')||'');
history.replaceState(null,'','/business-intake');
if(!intake?.business_name||!intake?.email||!intake?.phone){location.replace('/intake');throw new Error('Invalid Business DNA intake context.')}
const stages=['Business Snapshot','Document Intelligence','Business Roles','Business DNA','Qualifications','Capability Review'];
const roles=[
['Prime Contractor','Lead delivery, manage subcontractors, and accept prime responsibility.'],
['Subcontractor','Perform a defined portion of work under another prime.'],
['Professional Consultant','Deliver advisory, design, engineering, analytical, or specialist expertise.'],
['Service Provider','Perform recurring, project-based, operational, or field services.'],
['Product Supplier','Sell or furnish products, materials, equipment, or commodities.'],
['Manufacturer','Produce goods or equipment directly.'],
['Distributor','Source, warehouse, and deliver products from multiple manufacturers.'],
['Authorized Reseller','Resell named technology, equipment, or manufacturer products.'],
['Construction Contractor','Manage or perform general construction and public works.'],
['Specialty Trade Contractor','Perform licensed or specialized construction trades.'],
['Maintenance Provider','Provide preventive, corrective, inspection, repair, or on-call maintenance.'],
['Software Vendor','Provide licensed software, SaaS, platforms, or applications.'],
['Systems Integrator','Combine hardware, software, networks, controls, or operational systems.'],
['Staffing Provider','Provide temporary, contract, professional, or workforce personnel.'],
['Training Provider','Deliver instructional, workforce-development, or certification programs.']];
const deliveryMethods=['On-site service','Remote service','Field crews','Emergency response','On-call support','Recurring maintenance','Warehousing and fulfillment','Installation and commissioning','Professional deliverables'];
const taxonomy=[
{domain:'Construction & Infrastructure',category:'Building and Public Works',group:'General Construction',capabilities:['General Construction','Design-Build Construction','Construction Management','Site Preparation and Civil Work']},
{domain:'Construction & Infrastructure',category:'Specialty Trades',group:'Electrical and Controls',capabilities:['Commercial Electrical Installation','Lighting Systems','Generator Installation and Maintenance','Building Automation and Controls','EV Charging Station Installation']},
{domain:'Construction & Infrastructure',category:'Specialty Trades',group:'Mechanical and Building Systems',capabilities:['HVAC Installation and Repair','Plumbing and Water Systems','Fire Alarm and Life Safety Systems','Roofing and Building Envelope']},
{domain:'Facilities & Operations',category:'Facility Services',group:'Maintenance and Grounds',capabilities:['Preventive and Corrective Maintenance','Building Maintenance','Janitorial and Custodial Services','Landscaping and Grounds Maintenance','Pest Control','Waste Removal']},
{domain:'Facilities & Operations',category:'Operational Services',group:'Inspection and Response',capabilities:['Inspection and Testing Services','Emergency and On-Call Services','Environmental Services','Security and Monitoring Services']},
{domain:'Professional Services',category:'Business and Program Services',group:'Advisory and Administration',capabilities:['Management Consulting','Project Management','Program Management','Administrative Support','Accounting and Audit','Grant and Compliance Support']},
{domain:'Professional Services',category:'Workforce and Human Services',group:'People and Development',capabilities:['Temporary Staffing','Professional Staffing','Training Services','Workforce Development','Translation and Interpretation Services']},
{domain:'Technology & Digital',category:'Software and Data',group:'Applications and Intelligence',capabilities:['Software Development','SaaS and Cloud Services','Data Analytics','Artificial Intelligence Services','GIS and Mapping Services']},
{domain:'Technology & Digital',category:'Infrastructure and Security',group:'Enterprise Technology',capabilities:['Cybersecurity','Managed IT Services','Help Desk Services','Systems Integration','Telecommunications','Network Infrastructure']},
{domain:'Products & Supply',category:'Technology and Equipment',group:'Hardware and Systems',capabilities:['Computer Hardware','Electronic Components and Computer Chips','Security Cameras and Surveillance Equipment','Telecommunications Equipment','Industrial Equipment']},
{domain:'Products & Supply',category:'Materials and Commodities',group:'General Supply',capabilities:['Office Supplies','Medical Supplies','Safety Equipment','Electrical Supplies','Industrial Pipe and Fittings','Construction Materials']},
{domain:'Transportation & Logistics',category:'Movement and Fleet',group:'Logistics Operations',capabilities:['Transportation Services','Fleet Maintenance','Courier and Delivery Services','Warehousing and Distribution','Supply Chain Management']}];
const roleRecommendations={
'Construction Contractor':['General Construction','Design-Build Construction','Construction Management','Site Preparation and Civil Work'],
'Specialty Trade Contractor':['Commercial Electrical Installation','HVAC Installation and Repair','Plumbing and Water Systems','Fire Alarm and Life Safety Systems'],
'Maintenance Provider':['Preventive and Corrective Maintenance','Building Maintenance','Inspection and Testing Services','Emergency and On-Call Services'],
'Professional Consultant':['Management Consulting','Project Management','Program Management','Accounting and Audit','Grant and Compliance Support'],
'Software Vendor':['Software Development','SaaS and Cloud Services','Data Analytics','Artificial Intelligence Services'],
'Systems Integrator':['Systems Integration','Network Infrastructure','Building Automation and Controls','Telecommunications'],
'Product Supplier':['Office Supplies','Medical Supplies','Safety Equipment','Electrical Supplies','Industrial Equipment'],
'Distributor':['Warehousing and Distribution','Supply Chain Management','Industrial Equipment','Construction Materials'],
'Authorized Reseller':['Computer Hardware','Security Cameras and Surveillance Equipment','Telecommunications Equipment'],
'Staffing Provider':['Temporary Staffing','Professional Staffing','Workforce Development'],
'Training Provider':['Training Services','Workforce Development']};
const model={stage:1,roles:[],capabilities:[],capabilityEvidence:{},deliveryMethods:[],files:[],documentEvidence:[],agentSuggestions:null,domain:'All'};
$('businessName').value=intake.business_name;
$('snapshotName').textContent=intake.business_name;
$('heroTitle').textContent=`Building an intelligent understanding of ${intake.business_name}.`;
function setMessage(stage,text=''){const node=$('message'+stage);if(node)node.textContent=text}
function evidenceFor(capability){return model.capabilityEvidence[capability]||'manual'}
function recommendedCapabilities(){const fromRoles=model.roles.flatMap((role)=>roleRecommendations[role]||[]);const fromAgent=model.agentSuggestions?.capabilities||[];return new Set(unique([...fromRoles,...fromAgent]))}
function completionScore(){const checks=[$('description').value.trim().length>=30,Boolean($('years').value),Boolean($('employees').value),model.roles.length>0,model.capabilities.length>=2,model.deliveryMethods.length>0,Boolean($('pastPerformance').value.trim()),splitLines($('licenses').value).length>0||splitLines($('certifications').value).length>0||$('insurance').value!=='unknown'];return Math.round(checks.filter(Boolean).length/checks.length*100)}
function confidenceScore(){let score=22;if($('description').value.trim().length>=80)score+=14;if(model.files.length||$('evidenceNotes').value.trim().length>=40)score+=18;if(model.agentSuggestions)score+=8;if(model.capabilities.length>=3)score+=12;if($('pastPerformance').value.trim().length>=60)score+=12;if(splitLines($('licenses').value).length||splitLines($('certifications').value).length)score+=8;if($('qualitySystems').value.trim().length>=30)score+=6;return Math.min(100,score)}
function breadthScore(){return Math.min(100,18+model.capabilities.length*6+model.roles.length*3+model.deliveryMethods.length*2)}
function updateSnapshot(){const completion=completionScore();const confidence=confidenceScore();const breadth=breadthScore();$('completionText').textContent=completion+'%';$('completionBar').style.width=completion+'%';$('confidenceText').textContent=confidence>=80?'Strong':confidence>=58?'Developing':'Early';$('confidenceBar').style.width=confidence+'%';$('breadthText').textContent=breadth>=75?'Broad':breadth>=48?'Balanced':'Focused';$('breadthBar').style.width=breadth+'%';$('roleCount').textContent=model.roles.length;$('capCount').textContent=model.capabilities.length;$('documentCount').textContent=model.documentEvidence.length;const recommended=[...recommendedCapabilities()].filter((capability)=>!model.capabilities.includes(capability));if(!$('description').value.trim()){$('advisorTitle').textContent='Start with a clear business description.';$('advisorCopy').textContent='AOIS will recommend roles and capabilities as evidence develops.'}else if(!model.roles.length){$('advisorTitle').textContent='Classify how the business participates.';$('advisorCopy').textContent='Roles help AOIS separate performed work, supplied products, and teaming posture.'}else if(recommended.length){$('advisorTitle').textContent=`${recommended.length} capability recommendations are available.`;$('advisorCopy').textContent='Review recommendations rather than accepting broad labels automatically.'}else if(!$('pastPerformance').value.trim()){$('advisorTitle').textContent='Add one representative performance example.';$('advisorCopy').textContent='Comparable work materially improves evidence confidence and Analyze Fit explanations.'}else{$('advisorTitle').textContent='Business DNA is ready for confirmation.';$('advisorCopy').textContent='Review known, inferred, and unresolved evidence before building the dashboard.'}}
