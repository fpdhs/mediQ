import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';

const filePath = 'C:\\Users\\user\\Downloads\\medlineplus_ko_1017.jsonl';
const fileStream = createReadStream(filePath);
const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

for await (const l of rl) {
  const d = JSON.parse(l);
  if (d.title_en === "Children's Health" || d.title_ko === "어린이 건강") {
    console.log(JSON.stringify(d.segments, null, 2));
    break;
  }
}
