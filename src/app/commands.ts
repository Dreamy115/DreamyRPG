import { ApplicationCommandData, Client, CommandInteraction } from "discord.js";
import Mongoose from "mongoose";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default class ApplicationCommandManager {
  map = new Map<string, ApplicationCommand>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof ApplicationCommand) {
        this.map.set(loadedFile.data.name, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof ApplicationCommand) {
              this.map.set(subfile.data.name, subfile);
            }
          }
        }
      }
    }
  }
}

export class ApplicationCommand {
  data: ApplicationCommandData
  run: (interaction: CommandInteraction, Bot: Client, db: typeof Mongoose) => Promise<void>

  constructor(data: ApplicationCommand["data"], executor: ApplicationCommand["run"]) {
    this.data = data;
    this.run = executor;
  }
}