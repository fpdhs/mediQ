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
