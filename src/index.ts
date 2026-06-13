import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";
import Settings from "./Settings";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");
const MessageActions = findByProps("editMessage", "startEditMessage");

// Try several icon names used across Discord versions for a pencil/edit icon
const EditIcon =
    getAssetIDByName("ic_edit_24px") ??
    getAssetIDByName("PencilIcon") ??
    getAssetIDByName("ic_pencil") ??
    getAssetIDByName("pencil");

async function silentEditMessage(channelId: string, messageId: string, newContent: string) {
    const RestAPI = findByProps("get", "post", "del", "patch");
    try {
        const suppressNotifications: boolean = storage.suppressNotifications ?? false;
        const deleteDelay: number = storage.deleteDelay ?? 500;
        const deleteOriginal: boolean = storage.deleteOriginalMessage ?? true;

        // Send a new message with the original message's ID as the nonce.
        // Discord's client-side nonce deduplication causes this new message to
        // visually replace the original without going through the edit system.
        const response = await RestAPI.post({
            url: `/channels/${channelId}/messages`,
            body: {
                content: newContent,
                flags: suppressNotifications ? 4096 : 0,
                mobile_network_type: "unknown",
                nonce: messageId,
                tts: false,
            },
        });

        await sleep(deleteDelay);

        if (deleteOriginal) {
            await RestAPI.del({ url: `/channels/${channelId}/messages/${messageId}` });
        }

        logger.log("[SilentEdit] Success!");
        return true;
    } catch (err) {
        logger.log("[SilentEdit] Error: " + String(err));
        return false;
    }
}

let unpatchOpenLazy: (() => void) | null = null;

export default {
    onLoad() {
        storage.deleteOriginalMessage ??= true;
        storage.deleteDelay ??= 500;
        storage.suppressNotifications ??= false;

        unpatchOpenLazy = before("openLazy", ActionSheet, ([comp, args, msg]) => {
            if (args !== "MessageLongPressActionSheet" || !msg?.message) return;

            const UserStore = findByProps("getCurrentUser");
            const currentUser = UserStore?.getCurrentUser();
            if (!currentUser || msg.message.author?.id !== currentUser.id) return;

            const channelId: string = msg.message.channel_id;
            const messageId: string = msg.message.id;
            const originalContent: string = msg.message.content ?? "";

            comp.then((instance: any) => {
                const unpatch = after("default", instance, (_: any, component: any) => {
                    React.useEffect(() => () => { unpatch(); }, []);

                    const groups: any[] = findInReactTree(
                        component,
                        (c: any) => Array.isArray(c) && c[0]?.type?.name === "ActionSheetRowGroup"
                    );

                    if (!groups?.length) {
                        logger.warn("[SilentEdit] Could not find ActionSheetRowGroups");
                        return;
                    }

                    const silentEditButton = React.createElement(ActionSheetRow, {
                        label: "Silent Edit",
                        icon: React.createElement(ActionSheetRow.Icon, {
                            source: EditIcon,
                            color: storage.accentColor ?? "#ed4245",
                        }),
                        onPress: () => {
                            ActionSheet.hideActionSheet();

                            // Open Discord's native edit UI, then intercept the submit
                            MessageActions.startEditMessage(channelId, messageId, originalContent);

                            const originalEditMessage = MessageActions.editMessage;
                            MessageActions.editMessage = async function(
                                cId: string,
                                mId: string,
                                body: { content: string },
                                ...rest: unknown[]
                            ) {
                                // Restore immediately to avoid permanently hijacking editMessage
                                MessageActions.editMessage = originalEditMessage;

                                // Only intercept our specific message
                                if (mId !== messageId) {
                                    return originalEditMessage.call(this, cId, mId, body, ...rest);
                                }

                                await silentEditMessage(cId, mId, body.content);
                            };
                        },
                    });

                    // Insert just above the existing Edit row if present, otherwise prepend to first group
                    let inserted = false;
                    for (let gi = 0; gi < groups.length; gi++) {
                        const groupChildren: any[] = findInReactTree(
                            groups[gi],
                            (c: any) => Array.isArray(c) && c.some((child: any) =>
                                child?.type?.name === "ActionSheetRow"
                            )
                        );
                        if (!groupChildren) continue;

                        const editRowIndex = groupChildren.findIndex((c: any) =>
                            c?.props?.label?.toLowerCase?.()?.includes?.("edit")
                        );

                        if (editRowIndex >= 0) {
                            groupChildren.splice(editRowIndex, 0, silentEditButton);
                            inserted = true;
                            break;
                        }
                    }

                    if (!inserted) {
                        logger.warn("[SilentEdit] Edit row not found, inserting at start of first group");
                        const firstGroupChildren: any[] = findInReactTree(
                            groups[0],
                            (c: any) => Array.isArray(c) && c.some((child: any) =>
                                child?.type?.name === "ActionSheetRow"
                            )
                        );
                        if (firstGroupChildren) {
                            firstGroupChildren.unshift(silentEditButton);
                        } else {
                            groups.unshift(
                                React.createElement(ActionSheetRow.Group, null, silentEditButton)
                            );
                        }
                    }
                });
            });
        });

        logger.log("[SilentEdit] Loaded.");
    },

    onUnload() {
        unpatchOpenLazy?.();
        unpatchOpenLazy = null;
        logger.log("[SilentEdit] Unloaded.");
    },

    settings: Settings,
};
