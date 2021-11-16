import { ApplicationCommandData, Client, CommandInteraction, ContextMenuInteraction } from "discord.js";
import mongoose from "mongoose";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default class ApplicationCommandManager {
  map = new Map<string, ApplicationCommandHandler>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof ApplicationCommandHandler) {
        this.map.set(loadedFile.data.name, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof ApplicationCommandHandler) {
              this.map.set(subfile.data.name, subfile);
            }
          }
        }
      }
    }
  }
}

export class ApplicationCommandHandler {
  data: ApplicationCommandData
  run: (interaction: CommandInteraction | ContextMenuInteraction, Bot: Client, db: typeof mongoose) => Promise<void>

  constructor(data: ApplicationCommandHandler["data"], executor: ApplicationCommandHandler["run"]) {
    this.data = data;
    this.run = executor;
  }
}