import { ApplicationCommandData, AutocompleteInteraction, Client, CommandInteraction, MessageComponentInteraction } from "discord.js";
import Mongoose from "mongoose";

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default class AutocompleteManager {
  map = new Map<string, AutocompleteHandler>();
  async load(dir: fs.PathLike) {
    this.map.clear();

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;

      const {default: loadedFile} = await import(path.join(dir.toString(), file));

      if (loadedFile instanceof AutocompleteHandler) {
        this.map.set(loadedFile.name, loadedFile);
      } else {
        if (loadedFile instanceof Array) {
          for (const subfile of loadedFile) {
            if (subfile instanceof AutocompleteHandler) {
              this.map.set(subfile.name, subfile);
            }
          }
        }
      }
    }
  }
}

export class AutocompleteHandler {
  run: (interaction: AutocompleteInteraction, Bot: Client, db: typeof Mongoose) => Promise<void>
  name: string

  constructor(name: AutocompleteHandler["name"], executor: AutocompleteHandler["run"]) {
    this.name = name;
    this.run = executor;
  }
}