import fs from 'node:fs/promises';
import path from 'node:path';

export async function dirExists(_path: string) {
  try {
    const stat = await fs.stat(_path);
    return stat.isDirectory();
  } catch (e) {
    return false;
  }
}

export async function createDataFolder(p?: string[]) {
  const config = useRuntimeConfig();
  const dataFolder = path.join(config.data_path, ...(p || []));
  if (!(await dirExists(dataFolder))) {
    await fs.mkdir(dataFolder, { recursive: true });
  }
}
