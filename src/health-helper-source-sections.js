// Checks editorial section metadata against headings in the fixed source snapshot.
// HTML is treated as inert source text; nothing from it is executed or fetched here.
import {createHash} from 'node:crypto';
const normalize=value=>value.normalize('NFKC').replace(/\s+/gu,' ').trim().toLocaleLowerCase('en-US');

function decodeEntities(value){
 return value.replace(/&amp;/giu,'&').replace(/&quot;/giu,'"').replace(/&apos;|&#39;|&#x27;/giu,"'")
  .replace(/&nbsp;/giu,' ').replace(/&rsquo;|&#8217;/giu,'’').replace(/&ndash;/giu,'–').replace(/&mdash;/giu,'—')
  .replace(/&#(\d+);/gu,(_,number)=>decodeCodePoint(Number(number)))
  .replace(/&#x([\da-f]+);/giu,(_,number)=>decodeCodePoint(parseInt(number,16)));
}

function decodeCodePoint(value){
 return Number.isInteger(value)&&value>=0&&value<=0x10ffff&&!(value>=0xd800&&value<=0xdfff)?String.fromCodePoint(value):' ';
}

const monthNumbers=new Map(['january','february','march','april','may','june','july','august','september','october','november','december']
 .map((month,index)=>[month,index+1]));

// Extract only the page's explicit editorial update date. It is provenance metadata,
// not evidence that the page or its medical content has been clinically reviewed.
export function extractSourceUpdatedAt(html){
 if(typeof html!=='string'||!html)return null;
 const text=decodeEntities(html.replace(/<!--[\s\S]*?-->/gu,'')
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,'').replace(/<[^>]*>/gu,' '))
  .replace(/\s+/gu,' ');
 const matches=[...text.matchAll(/\bLast\s+updated\s*:?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/giu)];
 if(matches.length!==1)return null;
 const [,month,dayText,yearText]=matches[0],monthNumber=monthNumbers.get(month.toLowerCase()),day=Number(dayText),year=Number(yearText);
 if(!monthNumber||day<1||day>31||year<1900||year>9999)return null;
 const date=new Date(Date.UTC(year,monthNumber-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==monthNumber-1||date.getUTCDate()!==day)return null;
 return `${yearText}-${String(monthNumber).padStart(2,'0')}-${dayText.padStart(2,'0')}`;
}

function parseHeadings(html){
 const inertHtml=html.replace(/<!--[\s\S]*?-->/gu,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,'');
 return {inertHtml,headings:[...inertHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/giu)]
  .map(match=>({level:Number(match[1]),title:normalize(decodeEntities(match[2].replace(/<[^>]*>/gu,' '))),
   start:match.index,end:match.index+match[0].length}))};
}

function expectedSections(sectionPath){
 return typeof sectionPath==='string'?sectionPath.split('·').map(normalize).filter(Boolean):[];
}

export function sourceSectionsExist(html,sectionPath){
 if(typeof html!=='string'||!html||typeof sectionPath!=='string'||!sectionPath.trim())return false;
 const {headings}=parseHeadings(html),available=new Set(headings.map(heading=>heading.title));
 const expected=expectedSections(sectionPath);
 return expected.length>0&&expected.every(section=>available.has(section));
}

export function sourceSectionFingerprints(html,sectionPath){
 if(typeof html!=='string'||!html||typeof sectionPath!=='string'||!sectionPath.trim())return null;
 const {inertHtml,headings}=parseHeadings(html),expected=expectedSections(sectionPath);
 if(!expected.length)return null;
 const rows=[];
 for(const section of expected){
  const current=headings.find(heading=>heading.title===section);
  if(!current)return null;
  const boundary=headings.find(heading=>heading.start>current.end&&heading.level<=current.level)?.start??inertHtml.length;
  const content=inertHtml.slice(current.end,boundary);
  rows.push({sectionTitle:sectionPath.split('·').map(value=>value.trim()).find(value=>normalize(value)===section),
   sectionHtmlSha256:`sha256:${createHash('sha256').update(content).digest('hex')}`});
 }
 return rows;
}

// Returns stable paragraph references inside the requested heading sections.
// Text is hashed but not copied into reviewer artifacts; a locator is not a support judgment.
export function sourceSectionParagraphLocators(html,sectionPath){
 if(typeof html!=='string'||!html||typeof sectionPath!=='string'||!sectionPath.trim())return null;
 const {inertHtml,headings}=parseHeadings(html),expected=expectedSections(sectionPath);
 if(!expected.length)return null;
 const ranges=[];
 for(const section of expected){
  const current=headings.find(heading=>heading.title===section);
  if(!current)return null;
  const boundary=headings.find(heading=>heading.start>current.end&&heading.level<=current.level)?.start??inertHtml.length;
  ranges.push({title:sectionPath.split('·').map(value=>value.trim()).find(value=>normalize(value)===section),start:current.end,end:boundary});
 }
 const paragraphs=[...inertHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/giu)],byOrdinal=new Map();
 for(let index=0;index<paragraphs.length;index++){
  const match=paragraphs[index],text=decodeEntities(match[1].replace(/<[^>]*>/gu,' ')).replace(/\s+/gu,' ').trim();
  if(!text)continue;
  const sectionTitles=ranges.filter(range=>match.index>=range.start&&match.index<range.end).map(range=>range.title);
  if(!sectionTitles.length)continue;
  const paragraphSha256=`sha256:${createHash('sha256').update(text).digest('hex')}`;
  byOrdinal.set(index+1,{paragraphId:`p${index+1}-${paragraphSha256.slice(7,19)}`,paragraphOrdinal:index+1,
   paragraphSha256,visibleTextLength:[...text].length,sectionTitles});
 }
 return [...byOrdinal.values()];
}

// Resolves a one-based global <p> ordinal from the same inert snapshot representation.
export function sourceParagraphTextAt(html,paragraphOrdinal){
 if(typeof html!=='string'||!html||!Number.isInteger(paragraphOrdinal)||paragraphOrdinal<1)return null;
 const {inertHtml}=parseHeadings(html),match=[...inertHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/giu)][paragraphOrdinal-1];
 if(!match)return null;
 return decodeEntities(match[1].replace(/<[^>]*>/gu,' ')).replace(/\s+/gu,' ').trim()||null;
}
