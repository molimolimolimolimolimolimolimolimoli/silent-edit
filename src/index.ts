import { logger } from "@vendetta";

module.exports = {
    onLoad() {
        logger.log("[SilentEdit] Loaded.");
    },
    onUnload() {
        logger.log("[SilentEdit] Unloaded.");
    },
};
