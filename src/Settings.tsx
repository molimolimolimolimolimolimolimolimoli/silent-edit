import { React, ReactNative, stylesheet } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { FormRow, FormSwitchRow, FormSection, FormDivider, FormInput } = Forms;

export default function SilentEditSettings() {
    useProxy(storage);

    storage.deleteOriginalMessage ??= true;
    storage.deleteDelay ??= 500;
    storage.suppressNotifications ??= false;
    storage.accentColor ??= "#ed4245";

    return (
        <>
            <FormSection title="Behavior">
                <FormSwitchRow
                    label="Delete Original Message"
                    subLabel="Deletes the server-side original after the silent edit. Disable to keep it (will reappear on reload)."
                    value={!!storage.deleteOriginalMessage}
                    onValueChange={(v: boolean) => (storage.deleteOriginalMessage = v)}
                />
                <FormDivider />
                <FormSwitchRow
                    label="Suppress Notifications"
                    subLabel="Sends with @silent flag — recommended in DMs to avoid pinging."
                    value={!!storage.suppressNotifications}
                    onValueChange={(v: boolean) => (storage.suppressNotifications = v)}
                />
            </FormSection>

            <FormSection title="Timing (milliseconds)">
                <FormInput
                    title="Delete Delay"
                    placeholder="500"
                    value={String(storage.deleteDelay ?? 500)}
                    keyboardType="numeric"
                    onChangeText={(v: string) => {
                        const n = parseInt(v);
                        if (!isNaN(n)) storage.deleteDelay = n;
                    }}
                />
            </FormSection>

            <FormSection title="Appearance">
                <FormInput
                    title="Accent Color"
                    placeholder="#ed4245"
                    value={storage.accentColor ?? "#ed4245"}
                    onChangeText={(v: string) => (storage.accentColor = v)}
                />
            </FormSection>
        </>
    );
}
