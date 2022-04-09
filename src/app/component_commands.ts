import { Client, MessageComponentInteraction } from "discord.js";
import Mongoose from "mongoose";
import { Handler, Manager } from "./HandleManagers";


export default new Manager<ComponentCommandHandler>();

export class ComponentCommandHandler extends Handler {
  declare executor: (interaction: MessageComponentInteraction, Bot: Client, db: typeof Mongoose, args: string[]) => Promise<void>
  declare data: {
    name: string
  }

  constructor(name: string, executor: ComponentCommandHandler["executor"]) {
    super({
      name
    }, executor);
  }
}