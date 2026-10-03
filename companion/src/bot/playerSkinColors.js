import { inflateSync } from "node:zlib";

// Average colours of the parts of a player's skin texture, so the drawn
// first-person view can show a player character in the player's own colours.
// Minecraft skins are 64x64 (or legacy 64x32) 8-bit RGBA PNG files; the front
// faces of the parts sit at fixed places in the texture.
const SKIN_FRONT_FACES = {
  head: { left: 8, top: 8, width: 8, height: 8 },
  torso: { left: 20, top: 20, width: 8, height: 12 },
  arms: { left: 44, top: 20, width: 4, height: 12 },
  legs: { left: 4, top: 20, width: 4, height: 12 },
};

// Neutral greys for a player whose skin is not reported. The default skin
// depends on the player's identifier, so drawing Steve's colours would invent
// a look the player may not have.
export const UNKNOWN_SKIN_COLORS = {
  head: [170, 170, 170],
  torso: [130, 130, 130],
  arms: [150, 150, 150],
  legs: [95, 95, 95],
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceAbove = Math.abs(estimate - above);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);
  if (distanceLeft <= distanceAbove && distanceLeft <= distanceUpperLeft) return left;
  if (distanceAbove <= distanceUpperLeft) return above;
  return upperLeft;
}

// Decode an 8-bit, non-interlaced RGBA or RGB PNG. Returns null for any other
// PNG layout, so an unusual skin degrades to the unknown-skin colours.
export function decodeSkinPng(pngBytes) {
  const bytes = Buffer.from(pngBytes);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let channelCount = 0;
  const compressedParts = [];
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    const chunkData = bytes.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      const bitDepth = chunkData[8];
      const colorType = chunkData[9];
      const interlace = chunkData[12];
      if (bitDepth !== 8 || interlace !== 0) return null;
      if (colorType === 6) channelCount = 4;
      else if (colorType === 2) channelCount = 3;
      else return null;
    } else if (chunkType === "IDAT") {
      compressedParts.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
    offset += 12 + chunkLength;
  }
  if (!width || !height || !channelCount || !compressedParts.length) {
    return null;
  }
  const filtered = inflateSync(Buffer.concat(compressedParts));
  const rowLength = width * channelCount;
  const pixels = Buffer.alloc(width * height * 4);
  const previousRow = Buffer.alloc(rowLength);
  const currentRow = Buffer.alloc(rowLength);
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * (rowLength + 1);
    const filterType = filtered[rowStart];
    for (let i = 0; i < rowLength; i += 1) {
      const raw = filtered[rowStart + 1 + i];
      const left = i >= channelCount ? currentRow[i - channelCount] : 0;
      const above = previousRow[i];
      const upperLeft = i >= channelCount ? previousRow[i - channelCount] : 0;
      let value = raw;
      if (filterType === 1) value = raw + left;
      else if (filterType === 2) value = raw + above;
      else if (filterType === 3) value = raw + Math.floor((left + above) / 2);
      else if (filterType === 4) value = raw + paethPredictor(left, above, upperLeft);
      currentRow[i] = value & 0xff;
    }
    for (let column = 0; column < width; column += 1) {
      const target = (row * width + column) * 4;
      const source = column * channelCount;
      pixels[target] = currentRow[source];
      pixels[target + 1] = currentRow[source + 1];
      pixels[target + 2] = currentRow[source + 2];
      pixels[target + 3] = channelCount === 4 ? currentRow[source + 3] : 255;
    }
    currentRow.copy(previousRow);
  }
  return { width, height, pixels };
}

// Average the opaque pixels of each front face; a fully transparent face keeps
// the unknown-skin colour for that part.
export function skinColorsFromTexture(texture) {
  const colors = { ...UNKNOWN_SKIN_COLORS };
  if (!texture) {
    return colors;
  }
  const scale = texture.width / 64;
  for (const [partName, face] of Object.entries(SKIN_FRONT_FACES)) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let opaqueCount = 0;
    for (let row = face.top * scale; row < (face.top + face.height) * scale; row += 1) {
      for (let column = face.left * scale; column < (face.left + face.width) * scale; column += 1) {
        if (row >= texture.height || column >= texture.width) continue;
        const index = (row * texture.width + column) * 4;
        if (texture.pixels[index + 3] < 128) continue;
        red += texture.pixels[index];
        green += texture.pixels[index + 1];
        blue += texture.pixels[index + 2];
        opaqueCount += 1;
      }
    }
    if (opaqueCount) {
      colors[partName] = [red / opaqueCount, green / opaqueCount, blue / opaqueCount].map(Math.round);
    }
  }
  return colors;
}

const skinColorsByUrl = new Map();

// Fetch and summarise a skin once per texture address. Any failure (offline
// server, network error, unusual PNG) gives the unknown-skin colours.
export async function skinColorsForUrl(skinUrl, { fetchImplementation = globalThis.fetch } = {}) {
  if (!skinUrl) {
    return UNKNOWN_SKIN_COLORS;
  }
  if (skinColorsByUrl.has(skinUrl)) {
    return skinColorsByUrl.get(skinUrl);
  }
  let colors = UNKNOWN_SKIN_COLORS;
  try {
    const response = await fetchImplementation(skinUrl, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      colors = skinColorsFromTexture(decodeSkinPng(Buffer.from(await response.arrayBuffer())));
    }
  } catch {
    colors = UNKNOWN_SKIN_COLORS;
  }
  skinColorsByUrl.set(skinUrl, colors);
  return colors;
}
