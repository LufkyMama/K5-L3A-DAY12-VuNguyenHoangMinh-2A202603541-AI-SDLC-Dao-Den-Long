// MediaRecorder writes fragmented MP4 whose moov header only states the FIRST fragment's duration, so players
// show/seek only ~12 s. This rewrites the duration fields (mvhd, tkhd, mdhd, mehd) to the real total computed
// from the fragments (last tfdt + one fragment). Usage: node tools/mp4-fix-duration.mjs <file.mp4>
import fs from 'node:fs';

export function fixDuration(buf) {
  const boxes = (start, end) => { const out = []; let o = start; while (o + 8 <= end) { let size = buf.readUInt32BE(o); const type = buf.toString('latin1', o + 4, o + 8); let hdr = 8; if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16; } if (size < 8) break; out.push({ type, o, size, body: o + hdr }); o += size; } return out; };
  const child = (box, type) => boxes(box.body, box.o + box.size).find((b) => b.type === type);
  const top = boxes(0, buf.length);
  const moov = top.find((b) => b.type === 'moov');
  if (!moov) throw new Error('no moov box');
  const mvhd = child(moov, 'mvhd'), trak = child(moov, 'trak'), tkhd = child(trak, 'tkhd'), mdia = child(trak, 'mdia'), mdhd = child(mdia, 'mdhd');
  const ver = (b) => buf[b.body];
  const timescaleOf = (b) => (ver(b) === 1 ? buf.readUInt32BE(b.body + 20) : buf.readUInt32BE(b.body + 12));
  const movieTs = timescaleOf(mvhd), mediaTs = timescaleOf(mdhd);
  const tfdts = [];
  for (const moof of top.filter((b) => b.type === 'moof')) {
    for (const traf of boxes(moof.body, moof.o + moof.size).filter((b) => b.type === 'traf')) {
      const tfdt = child(traf, 'tfdt');
      if (tfdt) tfdts.push(ver(tfdt) === 1 ? Number(buf.readBigUInt64BE(tfdt.body + 4)) : buf.readUInt32BE(tfdt.body + 4));
    }
  }
  if (tfdts.length < 2) return { changed: false, seconds: null };
  const step = tfdts.at(-1) - tfdts.at(-2);
  const mediaDur = tfdts.at(-1) + step;
  const movieDur = Math.round((mediaDur / mediaTs) * movieTs);
  const put = (b, offV0, offV1, value) => { if (ver(b) === 1) buf.writeBigUInt64BE(BigInt(value), b.body + offV1); else buf.writeUInt32BE(value, b.body + offV0); };
  put(mvhd, 16, 24, movieDur); // version/flags(4) ctime mtime timescale | duration
  put(tkhd, 20, 28, movieDur); // version/flags(4) ctime mtime track_ID reserved | duration
  put(mdhd, 16, 24, mediaDur);
  const mvex = child(moov, 'mvex'); const mehd = mvex && child(mvex, 'mehd');
  if (mehd) put(mehd, 4, 4, movieDur);
  return { changed: true, seconds: mediaDur / mediaTs, fragments: tfdts.length };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/mp4-fix-duration.mjs')) {
  const f = process.argv[2]; const buf = fs.readFileSync(f); const r = fixDuration(buf); fs.writeFileSync(f, buf);
  console.log(`mp4-fix-duration: ${f} → ${r.seconds?.toFixed(1)} s (${r.fragments} fragments)`);
}
