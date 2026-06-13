import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");
const EditIcon = getAssetIDByName("ic_edit_24px") ?? getAssetIDByName("PencilIcon") ?? getAssetIDByName("ic_pencil") ?? getAssetIDByName("pencil");

async function silentEditMessage(channelId: string, messageId: string, newContent: string) {
    const RestAPI = findByProps("get", "post", "del", "patch");
    try {
        await RestAPI.post({ url: `/channels/${channelId}/messages`, body: { content: newContent, flags: 0, mobile_network_type: "unknown", nonce: messageId, tts: false } });
        await sleep(500);
        await RestAPI.del({ url: `/channels/${channelId}/messages/${messageId}` });
        logger.log("[SilentEdit] Success!");
        return true;
    } catch (err) {
        logger.log("[SilentEdit] Error: " + String(err));
        return false;
    }
}

let unpatchOpenLazy: (() => void) | null = null;

module.exports = {
    onLoad() {
        unpatchOpenLazy = before("openLazy", ActionSheet, ([comp, args, msg]) => {
            if (args !== "MessageLongPressActionSheet" || !msg?.message) return;
            const currentUser = findByProps("getCurrentUser")?.getCurrentUser();
            if (!currentUser || msg.message.author?.id !== currentUser.id) return;
            const channelId: string = msg.message.channel_id;
            const messageId: string = msg.message.id;
            const originalContent: string = msg.message.content ?? "";
            comp.then((instance: any) => {
                const unpatch = after("default", instance, (_: any, component: any) => {
                    React.useEffect(() => () => { unpatch(); }, []);
                    const groups: any[] = findInReactTree(component, (c: any) => Array.isArray(c) && c[0]?.type?.name === "ActionSheetRowGroup");
                    if (!groups?.length) return;
                    const btn = React.createElement(ActionSheetRow, {
                        label: "Silent Edit",
                        icon: React.createElement(ActionSheetRow.Icon, { source: EditIcon, color: "#ed4245" }),
                        onPress: () => {
                            ActionSheet.hideActionSheet();
                            const MA = findByProps("startEditMessage", "editMessage");
                            MA.startEditMessage(channelId, messageId, originalContent);
                            const orig = MA.editMessage;
                            MA.editMessage = async function(cId: string, mId: string, body: any, ...rest: any[]) {
                                MA.editMessage = orig;
                                if (mId !== messageId) return orig.call(this, cId, mId, body, ...rest);
                                await silentEditMessage(cId, mId, body.content);
                            };
                        },
                    });
                    let inserted = false;
                    for (let gi = 0; gi < groups.length; gi++) {
                        const gc: any[] = findInReactTree(groups[gi], (c: any) => Array.isArray(c) && c.some((x: any) => x?.type?.name === "ActionSheetRow"));
                        if (!gc) continue;
                        const idx = gc.findIndex((c: any) => c?.props?.label?.toLowerCase?.()?.includes?.("edit"));
                        if (idx >= 0) { gc.splice(idx, 0, btn); inserted = true; break; }
                    }
                    if (!inserted) groups.splice(Math.max(0, groups.length - 1), 0, React.createElement(ActionSheetRow.Group, null, btn));
                });
            });
        });
        logger.log("[SilentEdit] Loaded.");
    },
    onUnload() { unpatchOpenLazy?.(); unpatchOpenLazy = null; },
};
