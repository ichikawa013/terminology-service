import fs from 'fs-extra';

export async function loadJson(filePath) {
  try {
    return await fs.readJson(filePath);
    console.log(map.group)
  } catch (err) {
    console.error(`❌ Failed to load JSON from ${filePath}`, err.message);
    throw err;
  }
}
