import type { Command } from "commander";
import type { RegisterAction } from "../core/command.ts";
import { registerDraftCommands } from "./drafts.ts";
import { registerModerationCommands } from "./moderation.ts";
import { registerOperationCommands } from "./operations.ts";
import { registerSiteCommands } from "./site.ts";
import { registerTaxonomyCommands } from "./taxonomies.ts";

function registerAdminCommands(program: Command, action: RegisterAction) {
  registerOperationCommands(program, action);
  registerTaxonomyCommands(program, action);
  registerDraftCommands(program, action);
  registerModerationCommands(program, action);
  registerSiteCommands(program, action);
}

export { registerAdminCommands };
