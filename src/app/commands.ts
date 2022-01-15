import { ApplicationCommandData, Client, CommandInteraction, ContextMenuInteraction } from "discord.js";
import mongoose from "mongoose";

import { Handler, Manager } from "./HandleManagers";

export default new Manager<ApplicationCommandHandler>();

export class ApplicationCommandHandler extends Handler {
  declare data: ApplicationCommandData
  declare executor: (interaction: CommandInteraction | ContextMenuInteraction, Bot: Client, db: typeof mongoose) => Promise<void>

  constructor(data: ApplicationCommandHandler["data"], executor: ApplicationCommandHandler["executor"]) {
    super(data, executor);
  }
}