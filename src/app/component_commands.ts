import { ApplicationCommandData, Client, CommandInteraction, MessageComponentInteraction } from "discord.js";
import Mongoose from "mongoose";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default class ComponentCommandManager {
  map = new Map<string, ComponentCommandHandler>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof ComponentCommandHandler) {
        this.map.set(loadedFile.name, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof ComponentCommandHandler) {
              this.map.set(subfile.name, subfile);
            }
          }
        }
      }
    }
  }
}

export class ComponentCommandHandler {
  run: (interaction: MessageComponentInteraction, Bot: Client, db: typeof Mongoose, args: string[]) => Promise<void>
  name: string

  constructor(name: ComponentCommandHandler["name"], executor: ComponentCommandHandler["run"]) {
    this.name = name;
    this.run = executor;
  }
}