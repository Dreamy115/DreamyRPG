import { AutocompleteInteraction, Client } from "discord.js";
import Mongoose from "mongoose";
import { Handler, Manager } from "./HandleManagers";


export default new Manager<AutocompleteHandler>(); 

export class AutocompleteHandler extends Handler {
  declare executor: (interaction: AutocompleteInteraction, Bot: Client, db: typeof Mongoose) => Promise<void>
  declare data: {
    name: string
  }

  constructor(name: string, executor: AutocompleteHandler["executor"]) {
    super({
      name
    }, executor)
  }
}