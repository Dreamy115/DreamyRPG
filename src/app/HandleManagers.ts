import fs from "fs";
import path from "path";

export abstract class Handler {
  data: {
    name: string
  }
  executor: (...args: any[]) => Promise<any>

  constructor(data: Handler["data"], executor: Handler["executor"]) {
    this.data = data;
    this.executor = executor;
  }
}

export class Manager<T extends Handler> {
  map = new Map<string, T>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile}: {default: T | T[]} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof Handler) {
        this.map.set(loadedFile.data.name, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof Handler) {
              this.map.set(subfile.data.name, subfile);
            }
          }
        }
      }
    }
  }
}