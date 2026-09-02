import "./core/buffManager";
import "./ui/components/mainUi";
import "./systems/autoCollect";
import "./systems/newPlayerRewards";
import "./systems/scoreboard";
import "./systems/ownerSetup";
import "./systems/statSystem";
import "./systems/playerLevel";
import "./systems/combatAttributes";
import "./systems/affinitySystem";
import "./systems/effectResetOnJoinLeave";
import "./commands/registerCommands";

import { world } from "@minecraft/server";
import { onWorldLoad } from "./core/worldLoad";

onWorldLoad(() => {
    world.getDimension("overworld")
        .runCommand("gamerule sendcommandfeedback false");
});
